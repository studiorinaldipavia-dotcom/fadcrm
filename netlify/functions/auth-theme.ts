import { json, parseBody, requireUser, route, sql } from "./_shared/auth";

// Salva la preferenza chiaro/scuro nel profilo dell'utente
export const handler = route("POST", async (event) => {
  const auth = await requireUser(event);
  if ("response" in auth) return auth.response;

  const theme = String(parseBody(event).theme ?? "");
  if (theme !== "light" && theme !== "dark") return json(400, { error: "Tema non valido" });

  await sql`UPDATE users SET theme = ${theme} WHERE id = ${auth.user.id}`;
  return json(200, { ok: true });
});
