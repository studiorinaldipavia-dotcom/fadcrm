import { json, requireUser, route, sql } from "./_shared/auth";

export const handler = route("GET", async (event) => {
  const auth = await requireUser(event, ["settings.manage"]);
  if ("response" in auth) return auth.response;
  const rows = await sql`
    SELECT o.id, o.name, o.city,
           (SELECT count(*)::int FROM users u WHERE u.office_id = o.id) AS agents,
           (SELECT count(*)::int FROM customers c WHERE c.office_id = o.id) AS customers
    FROM offices o ORDER BY o.name`;
  return json(200, rows);
});
