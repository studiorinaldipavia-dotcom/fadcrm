import { json, requireUser, route, sql } from "./_shared/auth";

// Elenco agenti + dati per i moduli (uffici, permessi). Solo chi ha "agents.manage".
export const handler = route("GET", async (event) => {
  const auth = await requireUser(event, ["agents.manage"]);
  if ("response" in auth) return auth.response;

  const agents = await sql`
    SELECT u.id, u.email, u.first_name, u.last_name, u.phone, u.office_id, o.name AS office_name,
           u.role::text AS role, u.status::text AS status, u.hire_date::text AS hire_date,
           u.must_change_password
    FROM users u LEFT JOIN offices o ON o.id = u.office_id
    ORDER BY (u.role = 'amministratore') DESC, u.first_name, u.last_name`;
  const offices = await sql`SELECT id, name FROM offices ORDER BY name`;
  const permissions = await sql`SELECT key, description FROM permissions ORDER BY key`;
  const rolePermissions = await sql`
    SELECT role::text AS role, permission_key FROM role_permissions`;
  const roles = await sql`
    SELECT r.key, r.label, r.is_system, count(u.id)::int AS users
    FROM roles r LEFT JOIN users u ON u.role = r.key
    GROUP BY r.key ORDER BY r.is_system DESC, r.label`;
  const overrides = await sql`SELECT user_id, permission_key, granted FROM user_permissions`;

  return json(200, { agents, offices, permissions, rolePermissions, overrides, roles });
});
