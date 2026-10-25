import { json, requireUser, route, sql } from "./_shared/auth";
import { UUID_RE } from "./_shared/customers";
import { buildInsights, type Totals } from "./_shared/performance";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// Performance commerciale per periodo. Unisce i numeri raccolti da LeadHub (automatici)
// a quelli inseriti a mano ("Zona/Network"). Chi non ha "stats.view_all" vede solo i propri.
export const handler = route("GET", async (event) => {
  const auth = await requireUser(event, ["stats.view_all", "stats.view_own", "stats.enter_others"]);
  if ("response" in auth) return auth.response;
  const { user } = auth;
  const viewAll = user.permissions.includes("stats.view_all");

  const q = event.queryStringParameters ?? {};
  const from = q.from ?? "";
  const to = q.to ?? "";
  if (!DATE_RE.test(from) || !DATE_RE.test(to) || from > to) return json(400, { error: "Periodo non valido" });

  let agentId: string | null = viewAll && q.agent_id && UUID_RE.test(q.agent_id) ? q.agent_id : null;
  const officeId: string | null = viewAll && q.office_id && UUID_RE.test(q.office_id) ? q.office_id : null;
  const enterOthers = user.permissions.includes("stats.enter_others");
  // chi puo' inserire i numeri di altri legge SOLO il singolo giorno dell'agente scelto (per correggerlo)
  const entryLookup = !viewAll && enterOthers && q.for_entry === "1" && from === to && q.agent_id && UUID_RE.test(q.agent_id);
  if (!viewAll) agentId = entryLookup ? q.agent_id! : user.id;
  if (!viewAll && !user.permissions.includes("stats.view_own") && !entryLookup) return json(403, { error: "Non hai il permesso per vedere la performance" });

  const byAgent = await sql`
    SELECT s.agent_id, u.first_name, u.last_name,
           sum(s.chiamate)::int AS chiamate, sum(s.contatti)::int AS contatti, sum(s.fissati)::int AS fissati,
           sum(s.visti)::int AS visti, sum(s.chiusi)::int AS chiusi, sum(s.pacchi)::int AS pacchi,
           sum(s.con_trattativa)::int AS con_trattativa, sum(s.senza_trattativa)::int AS senza_trattativa,
           sum(s.visti_non_chiusi)::int AS visti_non_chiusi, count(*)::int AS giorni
    FROM agent_stats_combined s JOIN users u ON u.id = s.agent_id
    WHERE s.stat_date BETWEEN ${from}::date AND ${to}::date
      AND (${agentId}::uuid IS NULL OR s.agent_id = ${agentId}::uuid)
      AND (${officeId}::uuid IS NULL OR u.office_id = ${officeId}::uuid)
    GROUP BY s.agent_id, u.first_name, u.last_name
    ORDER BY u.first_name, u.last_name`;

  const byDay = await sql`
    SELECT s.stat_date::text AS date,
           sum(s.chiamate)::int AS chiamate, sum(s.contatti)::int AS contatti, sum(s.fissati)::int AS fissati,
           sum(s.visti)::int AS visti, sum(s.chiusi)::int AS chiusi, sum(s.pacchi)::int AS pacchi,
           sum(s.con_trattativa)::int AS con_trattativa, sum(s.senza_trattativa)::int AS senza_trattativa,
           sum(s.visti_non_chiusi)::int AS visti_non_chiusi
    FROM agent_stats_combined s JOIN users u ON u.id = s.agent_id
    WHERE s.stat_date BETWEEN ${from}::date AND ${to}::date
      AND (${agentId}::uuid IS NULL OR s.agent_id = ${agentId}::uuid)
      AND (${officeId}::uuid IS NULL OR u.office_id = ${officeId}::uuid)
    GROUP BY s.stat_date ORDER BY s.stat_date`;

  const keys = ["chiamate", "contatti", "fissati", "visti", "chiusi", "pacchi", "con_trattativa", "senza_trattativa", "visti_non_chiusi"] as const;
  const totals = Object.fromEntries(keys.map((k) => [k, 0])) as Record<(typeof keys)[number], number>;
  for (const row of byAgent) for (const k of keys) totals[k] += Number(row[k]);

  // singolo giorno: parte manuale ("Zona/Network") e parte automatica, per la finestra "Inserisci numeri"
  let dayDetail: { manual: Record<string, number>; auto: Record<string, number> } | null = null;
  if (from === to && agentId) {
    const manual = (
      await sql`SELECT contatti, fissati, chiusi, con_trattativa, senza_trattativa, pacchi
                FROM daily_agent_stats WHERE agent_id = ${agentId}::uuid AND stat_date = ${from}::date`
    )[0] ?? { contatti: 0, fissati: 0, chiusi: 0, con_trattativa: 0, senza_trattativa: 0, pacchi: 0 };
    const total = byAgent[0] ?? {};
    const num = (v: unknown) => Number(v ?? 0);
    dayDetail = {
      manual: Object.fromEntries(Object.entries(manual).map(([k, v]) => [k, num(v)])),
      auto: {
        chiamate: num(total.chiamate),
        contatti: num(total.contatti) - num(manual.contatti),
        fissati: num(total.fissati) - num(manual.fissati),
        chiusi: num(total.chiusi) - num(manual.chiusi),
        con_trattativa: num(total.con_trattativa) - num(manual.con_trattativa),
        senza_trattativa: num(total.senza_trattativa) - num(manual.senza_trattativa),
        pacchi: num(total.pacchi) - num(manual.pacchi),
      },
    };
  }

  // criticita' rispetto alla media degli ALTRI agenti attivi (stesso periodo, senza filtri di ufficio/agente)
  const peerRows = await sql`
    SELECT s.agent_id, sum(s.chiamate)::int AS chiamate, sum(s.contatti)::int AS contatti, sum(s.fissati)::int AS fissati,
           sum(s.visti)::int AS visti, sum(s.chiusi)::int AS chiusi, sum(s.con_trattativa)::int AS con_trattativa,
           sum(s.senza_trattativa)::int AS senza_trattativa, count(*)::int AS giorni
    FROM agent_stats_combined s JOIN users u ON u.id = s.agent_id
    WHERE s.stat_date BETWEEN ${from}::date AND ${to}::date AND u.status = 'attivo'
    GROUP BY s.agent_id`;
  const asTotals = (r: Record<string, unknown>): Totals => ({
    chiamate: Number(r.chiamate), contatti: Number(r.contatti), fissati: Number(r.fissati), visti: Number(r.visti),
    chiusi: Number(r.chiusi), con_trattativa: Number(r.con_trattativa), senza_trattativa: Number(r.senza_trattativa), giorni: Number(r.giorni),
  });
  const peerMap = new Map(peerRows.map((r) => [r.agent_id as string, asTotals(r)]));
  const insights = byAgent.map((row) => ({
    agent_id: row.agent_id as string,
    name: `${row.first_name} ${row.last_name}`,
    items: buildInsights(
      peerMap.get(row.agent_id as string) ?? asTotals(row),
      [...peerMap.entries()].filter(([id]) => id !== row.agent_id).map(([, t]) => t),
    ),
  }));
  // chi non ha dati nel periodo ma guarda la propria pagina vede comunque il messaggio
  if (!viewAll && insights.length === 0) {
    insights.push({ agent_id: user.id, name: `${user.first_name} ${user.last_name}`, items: buildInsights({ chiamate: 0, contatti: 0, fissati: 0, visti: 0, chiusi: 0, con_trattativa: 0, senza_trattativa: 0, giorni: 0 }, []) });
  }

  const agents = viewAll
    ? await sql`SELECT id, first_name, last_name FROM users WHERE status = 'attivo' ORDER BY first_name, last_name`
    : [];
  const entryAgents =
    viewAll || enterOthers
      ? await sql`SELECT u.id, u.first_name, u.last_name FROM users u
         WHERE u.status = 'attivo'
           AND EXISTS (SELECT 1 FROM role_permissions rp WHERE rp.role = u.role AND rp.permission_key = 'stats.enter_own')
         ORDER BY u.first_name, u.last_name`
      : [];
  const offices = viewAll ? await sql`SELECT id, name FROM offices ORDER BY name` : [];

  return json(200, {
    totals, byAgent, byDay, agents, offices, insights, day_detail: dayDetail,
    entry_agents: entryAgents, can_enter_others: enterOthers, can_view_all: viewAll,
  });
});
