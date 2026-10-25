import { getSessionUser, json, route, sql } from "./_shared/auth";

export const handler = route("GET", async (event) => {
  const user = await getSessionUser(event);
  if (!user) return json(401, { error: "Accesso richiesto" });
  const roles = await sql`SELECT key, label FROM roles ORDER BY is_system DESC, label`;
  return json(200, { user, roles });
});
