import { json, requireUser, route, sql } from "./_shared/auth";
import { UUID_RE } from "./_shared/customers";

// Appuntamenti in un intervallo. Chi non ha "calendar.view_all" vede solo i propri.
export const handler = route("GET", async (event) => {
  const auth = await requireUser(event, ["calendar.view_own", "calendar.view_all"]);
  if ("response" in auth) return auth.response;
  const { user } = auth;
  const viewAll = user.permissions.includes("calendar.view_all");

  const q = event.queryStringParameters ?? {};
  const from = new Date(q.from ?? "");
  const to = new Date(q.to ?? "");
  if (isNaN(from.getTime()) || isNaN(to.getTime()) || from >= to) return json(400, { error: "Periodo non valido" });
  if (to.getTime() - from.getTime() > 100 * 86400000) return json(400, { error: "Periodo troppo lungo" });

  const agentId: string | null = viewAll
    ? q.agent_id && UUID_RE.test(q.agent_id) ? q.agent_id : null
    : user.id;

  const events = await sql`
    SELECT e.id, e.title, e.starts_at, e.ends_at, e.notes, e.agent_id, ag.first_name AS agent_name,
           e.customer_id, c.first_name AS customer_first_name, c.last_name AS customer_last_name,
           e.manager_id, m.first_name AS manager_name
    FROM calendar_events e
    JOIN users ag ON ag.id = e.agent_id
    LEFT JOIN customers c ON c.id = e.customer_id
    LEFT JOIN users m ON m.id = e.manager_id
    WHERE e.starts_at >= ${from.toISOString()}::timestamptz AND e.starts_at < ${to.toISOString()}::timestamptz
      AND (${agentId}::uuid IS NULL OR e.agent_id = ${agentId}::uuid)
    ORDER BY e.starts_at`;

  const people = await sql`
    SELECT id, first_name, last_name FROM users WHERE status = 'attivo' ORDER BY first_name, last_name`;

  return json(200, { events, people, can_view_all: viewAll });
});
