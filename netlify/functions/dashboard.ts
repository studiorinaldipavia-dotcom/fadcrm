import { json, requireUser, route, sql } from "./_shared/auth";
import { computeCoaching } from "./_shared/coaching";
import { averageAppointmentsToday } from "./_shared/performance";

const iso = (d: Date) => d.toISOString().slice(0, 10);

function rangeFor(range: string): { from: string; to: string } {
  const now = new Date();
  const to = iso(now);
  if (range === "week") return { from: iso(new Date(now.getTime() - 6 * 86400000)), to };
  if (range === "quarter") {
    const startMonth = Math.floor(now.getUTCMonth() / 3) * 3;
    return { from: iso(new Date(Date.UTC(now.getUTCFullYear(), startMonth, 1))), to };
  }
  return { from: iso(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))), to };
}

export const handler = route("GET", async (event) => {
  const auth = await requireUser(event);
  if ("response" in auth) return auth.response;
  const { user } = auth;
  const has = (key: string) => user.permissions.includes(key);

  const range = String(event.queryStringParameters?.range ?? "month");
  const { from, to } = rangeFor(range);

  const allCustomers = has("customers.view_all");
  const manageTasks = has("tasks.manage");
  const seeTasks = manageTasks || has("tasks.view_own");
  const allStats = has("stats.view_all");
  const uid = user.id;

  /* ----- numeri principali (nel proprio ambito) ----- */
  const customers = (
    await sql`
      SELECT count(*)::int AS total,
             count(*) FILTER (WHERE created_at::date BETWEEN ${from}::date AND ${to}::date)::int AS recent
      FROM customers WHERE ${allCustomers}::boolean OR agent_id = ${uid}
         OR EXISTS (SELECT 1 FROM customer_agents sa WHERE sa.customer_id = customers.id AND sa.agent_id = ${uid})`
  )[0];

  // Task della segreteria (nel proprio ambito: la segreteria le vede tutte, gli agenti solo le proprie)
  const taskCounts = seeTasks
    ? (
        await sql`
          SELECT count(*) FILTER (WHERE kind = 'ko' AND status = 'aperta')::int AS ko_open,
                 count(*) FILTER (WHERE kind = 'manuale' AND status = 'aperta')::int AS manual_open,
                 count(*) FILTER (WHERE status = 'aperta' AND due_date IS NOT NULL AND due_date < (now() AT TIME ZONE 'Europe/Rome')::date)::int AS overdue,
                 count(*) FILTER (WHERE kind = 'ko' AND status = 'completata' AND closed_at::date BETWEEN ${from}::date AND ${to}::date)::int AS ko_recovered
          FROM secretary_tasks WHERE ${manageTasks}::boolean OR agent_id = ${uid}::uuid`
      )[0]
    : { ko_open: 0, manual_open: 0, overdue: 0, ko_recovered: 0 };

  const stats = (
    await sql`
      SELECT coalesce(sum(contatti),0)::int AS contatti, coalesce(sum(fissati),0)::int AS fissati,
             coalesce(sum(visti),0)::int AS visti, coalesce(sum(chiusi),0)::int AS chiusi
      FROM agent_stats_combined
      WHERE stat_date BETWEEN ${from}::date AND ${to}::date AND (${allStats}::boolean OR agent_id = ${uid})`
  )[0];
  const closingRate = stats.visti > 0 ? Math.round((stats.chiusi / stats.visti) * 1000) / 10 : null;

  const recent = seeTasks
    ? await sql`
        SELECT t.id, t.kind, t.title, t.status, t.due_date::text AS due_date, t.updated_at,
               cu.first_name AS customer_first_name, cu.last_name AS customer_last_name,
               a.first_name AS agent_first_name, a.last_name AS agent_last_name
        FROM secretary_tasks t JOIN customers cu ON cu.id = t.customer_id JOIN users a ON a.id = t.agent_id
        WHERE ${manageTasks}::boolean OR t.agent_id = ${uid}::uuid
        ORDER BY t.updated_at DESC LIMIT 5`
    : [];

  /* ----- "Da controllare oggi" ----- */
  type Item = { key: string; title: string; detail: string; tone: string; icon: string; target: string };
  const attention: Item[] = [];
  if (taskCounts.ko_open > 0) {
    attention.push({
      key: "ko", icon: "warning", tone: "red", target: "Segreteria",
      title: `${taskCounts.ko_open} KO da recuperare`,
      detail: manageTasks ? "Controlla la motivazione e segui gli agenti" : "Richiama il cliente e segna l'esito",
    });
  }
  if (taskCounts.manual_open > 0) {
    attention.push({
      key: "task", icon: "check", tone: "orange", target: "Segreteria",
      title: `${taskCounts.manual_open} task dalla segreteria da completare`,
      detail: manageTasks ? "Task manuali ancora aperte per gli agenti" : "Task che la segreteria ti ha assegnato",
    });
  }
  if (taskCounts.overdue > 0) {
    attention.push({
      key: "scadute", icon: "clock", tone: "red", target: "Segreteria",
      title: `${taskCounts.overdue} task scadute`,
      detail: "La data di scadenza è già passata",
    });
  }

  // Clienti OK senza nessun appuntamento futuro
  if (has("calendar.view_own") || has("calendar.view_all")) {
    const noAppt = (
      await sql`
        SELECT count(*)::int AS n FROM customers cu
        WHERE (${allCustomers}::boolean OR cu.agent_id = ${uid} OR EXISTS (SELECT 1 FROM customer_agents sa WHERE sa.customer_id = cu.id AND sa.agent_id = ${uid})) AND cu.status = 'OK'
          AND NOT EXISTS (SELECT 1 FROM calendar_events e WHERE e.customer_id = cu.id AND e.starts_at >= now())`
    )[0].n;
    if (noAppt > 0) {
      attention.push({
        key: "senza-appuntamento", icon: "calendar", tone: "blue", target: "Clienti",
        title: `${noAppt} clienti senza appuntamento futuro`,
        detail: "Clienti OK da pianificare",
      });
    }
  }

  // Confronto tra agenti (ultimi 7 giorni) per chi vede la performance di tutti
  if (allStats || has("stats.coaching")) {
    const week = await sql`
      SELECT u.first_name, sum(s.visti)::int AS visti, sum(s.chiusi)::int AS chiusi
      FROM agent_stats_combined s JOIN users u ON u.id = s.agent_id
      WHERE s.stat_date > current_date - 7 AND u.status = 'attivo' GROUP BY u.id, u.first_name`;
    if (week.length >= 2) {
      const avg = week.reduce((sum, r) => sum + r.chiusi, 0) / week.length;
      if (avg >= 3) {
        for (const r of week) {
          if (r.chiusi < avg * 0.72) {
            attention.push({
              key: `sotto-${r.first_name}`, icon: "trend", tone: "purple", target: "Performance",
              title: `${r.first_name} è sotto la media`,
              detail: `${Math.round((r.chiusi / avg - 1) * 100)}% di chiusi rispetto alla media (ultimi 7 giorni)`,
            });
          }
        }
      }
    }
    for (const r of week) {
      if (r.visti >= 5 && r.chiusi / r.visti < 0.2) {
        attention.push({
          key: `conv-${r.first_name}`, icon: "trend", tone: "purple", target: "Performance",
          title: `${r.first_name}: ${r.visti} visti → ${r.chiusi} chiusi`,
          detail: "Conversione bassa in chiusura (ultimi 7 giorni)",
        });
      }
    }
  }

  const coaching = has("stats.coaching") ? await computeCoaching() : null;

  return json(200, {
    range, from, to,
    customers, tasks: taskCounts, stats, closing_rate: closingRate,
    recent, attention, coaching,
    // media appuntamenti di oggi tra gli agenti che hanno chiamato: solo trainer, manager e amministratore
    avg_appointments: has("stats.leaderboard") ? await averageAppointmentsToday() : null,
  });
});
