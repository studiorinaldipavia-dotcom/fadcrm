import { json, requireUser, route, sql } from "./_shared/auth";

// Registro delle attivita': chi ha fatto cosa (solo chi ha "audit.view")
export const handler = route("GET", async (event) => {
  const auth = await requireUser(event, ["audit.view"]);
  if ("response" in auth) return auth.response;

  const rows = await sql`
    SELECT a.id, a.action, a.entity, a.entity_id, a.details, a.created_at,
           u.first_name AS actor_name, u.last_name AS actor_last_name
    FROM audit_logs a LEFT JOIN users u ON u.id = a.actor_id
    ORDER BY a.created_at DESC LIMIT 200`;
  return json(200, rows);
});
