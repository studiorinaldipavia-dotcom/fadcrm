import { rateLimit, json, requireUser, route, sql } from "./_shared/auth";

// Elenco clienti: chi ha "customers.view_all" li vede tutti, gli altri solo i propri
export const handler = route("GET", async (event) => {
  const auth = await requireUser(event, ["customers.view_all", "customers.view_own"]);
  if ("response" in auth) return auth.response;
  if (!(await rateLimit(`customers:${auth.user.id}`, 120, 60))) return json(429, { error: "Troppe richieste. Riprova tra un minuto." });
  const { user } = auth;

  const rows = user.permissions.includes("customers.view_all")
    ? await sql`
        SELECT c.id, c.first_name, c.last_name, c.phone, c.email, c.address, c.city, c.province,
               c.status::text AS status, c.agent_id, a.first_name AS agent_name, c.created_at
        FROM customers c LEFT JOIN users a ON a.id = c.agent_id
        ORDER BY c.created_at DESC LIMIT 500`
    : await sql`
        SELECT c.id, c.first_name, c.last_name, c.phone, c.email, c.address, c.city, c.province,
               c.status::text AS status, c.agent_id, a.first_name AS agent_name, c.created_at
        FROM customers c LEFT JOIN users a ON a.id = c.agent_id
        WHERE c.agent_id = ${user.id}
           OR EXISTS (SELECT 1 FROM customer_agents sa WHERE sa.customer_id = c.id AND sa.agent_id = ${user.id})
        ORDER BY c.created_at DESC LIMIT 500`;

  return json(200, rows);
});
