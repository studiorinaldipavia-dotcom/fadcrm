import { json, logAudit, parseBody, requireUser, route, sql } from "./_shared/auth";
import { UUID_RE } from "./_shared/customers";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// Inserimento (o correzione) dei numeri del giorno. Una riga per agente per giorno.
export const handler = route("POST", async (event) => {
  const auth = await requireUser(event, ["stats.enter_own", "stats.view_all", "stats.enter_others"]);
  if ("response" in auth) return auth.response;
  const { user } = auth;
  const viewAll = user.permissions.includes("stats.view_all");
  const enterOthers = viewAll || user.permissions.includes("stats.enter_others");

  const body = parseBody(event);
  const date = String(body.date ?? "");
  if (!DATE_RE.test(date)) return json(400, { error: "Data non valida" });

  const requested = String(body.agent_id ?? "");
  const agentId = requested && requested !== user.id ? requested : user.id;
  if (agentId !== user.id) {
    if (!enterOthers) return json(403, { error: "Puoi inserire solo i tuoi numeri" });
    if (!UUID_RE.test(agentId)) return json(400, { error: "Agente non valido" });
    const exists = await sql`SELECT 1 FROM users WHERE id = ${agentId} AND status = 'attivo'`;
    if (exists.length === 0) return json(400, { error: "Agente non valido" });
  } else if (!user.permissions.includes("stats.enter_own") && !viewAll) {
    return json(403, { error: "Non hai il permesso per inserire la performance" });
  }

  // Niente date future; gli agenti possono correggere solo gli ultimi 7 giorni
  const today = new Date().toISOString().slice(0, 10);
  if (date > today) return json(400, { error: "Non puoi inserire numeri per una data futura" });
  if (!viewAll) {
    const limit = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
    if (date < limit) return json(400, { error: "Puoi inserire o correggere solo gli ultimi 7 giorni" });
  }

  const read = (key: string) => {
    const value = Number(body[key] ?? 0);
    return Number.isInteger(value) && value >= 0 && value <= 9999 ? value : null;
  };
  // "Zona/Network": numeri raccolti fuori da LeadHub, si SOMMANO a quelli automatici
  const contatti = read("contatti");
  const fissati = read("fissati");
  const chiusi = read("chiusi"); // contratti conclusi
  const conTrattativa = read("con_trattativa");
  const senzaTrattativa = read("senza_trattativa");
  const pacchi = read("pacchi");
  if ([contatti, fissati, chiusi, conTrattativa, senzaTrattativa, pacchi].includes(null)) {
    return json(400, { error: "I numeri devono essere interi tra 0 e 9999" });
  }
  // visti = incontri avvenuti = contratti conclusi + incontrati con trattativa + incontrati senza trattativa
  const visti = chiusi! + conTrattativa! + senzaTrattativa!;

  await sql`
    INSERT INTO daily_agent_stats (agent_id, stat_date, contatti, fissati, visti, chiusi, pacchi, con_trattativa, senza_trattativa, entered_by)
    VALUES (${agentId}, ${date}::date, ${contatti}, ${fissati}, ${visti}, ${chiusi}, ${pacchi}, ${conTrattativa}, ${senzaTrattativa}, ${user.id})
    ON CONFLICT (agent_id, stat_date) DO UPDATE
      SET contatti = EXCLUDED.contatti, fissati = EXCLUDED.fissati, visti = EXCLUDED.visti,
          chiusi = EXCLUDED.chiusi, pacchi = EXCLUDED.pacchi, con_trattativa = EXCLUDED.con_trattativa,
          senza_trattativa = EXCLUDED.senza_trattativa, entered_by = EXCLUDED.entered_by`;
  await logAudit(user.id, "performance_inserita", "daily_agent_stats", null, {
    agent_id: agentId, date, contatti, fissati, chiusi, con_trattativa: conTrattativa, senza_trattativa: senzaTrattativa, pacchi,
  });
  return json(200, { ok: true });
});
