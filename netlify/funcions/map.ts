import { json, requireUser, route, sql } from "./_shared/auth";
import { UUID_RE } from "./_shared/customers";

// Clienti con posizione. Agente: solo i propri. Chi ha "map.view_all": tutti, con filtri.
export const handler = route("GET", async (event) => {
  const auth = await requireUser(event, ["map.view_own", "map.view_all"]);
  if ("response" in auth) return auth.response;
  const { user } = auth;
  const viewAll = user.permissions.includes("map.view_all");
  const uid = user.id;

  const q = event.queryStringParameters ?? {};
  const agentId = viewAll && q.agent_id && UUID_RE.test(q.agent_id) ? q.agent_id : null;
  const officeId = viewAll && q.office_id && UUID_RE.test(q.office_id) ? q.office_id : null;
  const product = q.product ? String(q.product).slice(0, 60) : null;
  const status = ["OK", "NR", "KO"].includes(q.status ?? "") ? (q.status as string) : null;

  const customers = await sql`
    SELECT c.id, c.first_name, c.last_name, c.address, c.city, c.province, c.phone, c.interests,
           c.status::text AS status, c.latitude, c.longitude, a.first_name AS agent_name
    FROM customers c LEFT JOIN users a ON a.id = c.agent_id
    WHERE c.latitude IS NOT NULL AND c.longitude IS NOT NULL
      AND (${viewAll}::boolean OR c.agent_id = ${uid}
           OR EXISTS (SELECT 1 FROM customer_agents sa WHERE sa.customer_id = c.id AND sa.agent_id = ${uid}))
      AND (${agentId}::uuid IS NULL OR c.agent_id = ${agentId}::uuid)
      AND (${officeId}::uuid IS NULL OR c.office_id = ${officeId}::uuid)
      AND (${product}::text IS NULL OR ${product}::text = ANY(c.interests))
      AND (${status}::text IS NULL OR c.status::text = ${status}::text)
    LIMIT 2000`;

  const counts = (
    await sql`
      SELECT count(*) FILTER (WHERE latitude IS NULL AND NOT geocode_failed AND coalesce(trim(address), '') <> '')::int AS pending,
             count(*) FILTER (WHERE latitude IS NULL AND (geocode_failed OR coalesce(trim(address), '') = ''))::int AS unplaced
      FROM customers WHERE ${viewAll}::boolean OR agent_id = ${uid}
         OR EXISTS (SELECT 1 FROM customer_agents sa WHERE sa.customer_id = customers.id AND sa.agent_id = ${uid})`
  )[0];

  const agents = viewAll
    ? await sql`SELECT id, first_name, last_name FROM users WHERE status = 'attivo' ORDER BY first_name, last_name`
    : [];
  const offices = viewAll ? await sql`SELECT id, name FROM offices ORDER BY name` : [];
  const products = await sql`SELECT name FROM products WHERE is_active ORDER BY sort_order, name`;

  return json(200, {
    customers, pending: counts.pending, unplaced: counts.unplaced,
    agents, offices, products: products.map((p) => p.name), can_view_all: viewAll,
  });
});
