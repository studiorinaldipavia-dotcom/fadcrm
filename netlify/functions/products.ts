import { json, requireUser, route, sql } from "./_shared/auth";

// Archivio prodotti/servizi, compresi quelli disattivati
export const handler = route("GET", async (event) => {
  const auth = await requireUser(event, ["products.manage"]);
  if ("response" in auth) return auth.response;
  const rows = await sql`
    SELECT p.id, p.name, p.category, p.description, p.is_active, p.sort_order,
           (SELECT count(*)::int FROM customers c WHERE p.name = ANY(c.interests)) AS customers,
           COALESCE((
             SELECT json_agg(json_build_object(
                      'id', t.id, 'title', t.title, 'cost', t.cost::float8, 'fixed_cost', t.fixed_cost::float8,
                      'kwh_cost', t.kwh_cost::float8, 'smc_cost', t.smc_cost::float8, 'notes', t.notes,
                      'is_active', t.is_active, 'sort_order', t.sort_order)
                    ORDER BY t.sort_order, t.title)
             FROM product_ctes t WHERE t.product_id = p.id), '[]'::json) AS ctes
    FROM products p ORDER BY p.sort_order, p.name`;
  return json(200, rows);
});
