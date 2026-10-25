import { json, requireUser, route, sql } from "./_shared/auth";

// Archivio prodotti/servizi, compresi quelli disattivati
export const handler = route("GET", async (event) => {
  const auth = await requireUser(event, ["products.manage"]);
  if ("response" in auth) return auth.response;
  const rows = await sql`
    SELECT p.id, p.name, p.category, p.description, p.is_active, p.sort_order,
           (SELECT count(*)::int FROM customers c WHERE p.name = ANY(c.interests)) AS customers
    FROM products p ORDER BY p.sort_order, p.name`;
  return json(200, rows);
});
