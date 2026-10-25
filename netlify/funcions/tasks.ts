import { json, requireUser, route, sql } from "./_shared/auth";

// Task della Segreteria: "KO da recuperare" e task manuali per gli agenti.
// Chi ha "tasks.manage" (segreteria, amministratore) le vede tutte; gli altri solo quelle assegnate a loro.
export const handler = route("GET", async (event) => {
  const auth = await requireUser(event, ["tasks.manage", "tasks.view_own"]);
  if ("response" in auth) return auth.response;
  const { user } = auth;
  const manage = user.permissions.includes("tasks.manage");

  const rows = await sql`
    SELECT t.id, t.kind, t.title, t.details, t.due_date::text AS due_date, t.status,
           t.closed_note, t.closed_at, t.created_at,
           (t.status = 'aperta' AND t.due_date IS NOT NULL AND t.due_date < (now() AT TIME ZONE 'Europe/Rome')::date) AS overdue,
           c.id AS customer_id, c.first_name AS customer_first_name, c.last_name AS customer_last_name,
           c.phone AS customer_phone, c.city AS customer_city,
           t.agent_id, a.first_name AS agent_first_name, a.last_name AS agent_last_name,
           cr.first_name AS creator_first_name, cr.last_name AS creator_last_name,
           cl.first_name AS closer_first_name, cl.last_name AS closer_last_name
    FROM secretary_tasks t
    JOIN customers c ON c.id = t.customer_id
    JOIN users a ON a.id = t.agent_id
    LEFT JOIN users cr ON cr.id = t.created_by
    LEFT JOIN users cl ON cl.id = t.closed_by
    WHERE ${manage}::boolean OR t.agent_id = ${user.id}::uuid
    ORDER BY (t.status = 'aperta') DESC, t.due_date ASC NULLS LAST, t.created_at DESC
    LIMIT 500`;

  return json(200, { rows, can_manage: manage });
});
