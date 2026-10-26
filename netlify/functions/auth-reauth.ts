import { clientIp, json, loginBlocked, logAudit, parseBody, recordLogin, requireUser, route, sql, verifyPassword } from "./_shared/auth";
import { sudoCookie } from "./_shared/security";

// Riconferma della password: per 10 minuti sblocca le azioni sensibili (elimina clienti, ruoli, utenti...)
export const handler = route("POST", async (event) => {
  const auth = await requireUser(event);
  if ("response" in auth) return auth.response;
  const { user } = auth;

  const ip = clientIp(event);
  const key = `reauth:${user.id}`;
  if (await loginBlocked(key, ip)) return json(429, { error: "Troppi tentativi. Riprova tra 15 minuti." });

  const row = (await sql`SELECT password_hash FROM users WHERE id = ${user.id}`)[0];
  if (!row || !(await verifyPassword(String(parseBody(event).password ?? ""), row.password_hash))) {
    await recordLogin(key, ip, false);
    await logAudit(user.id, "riautenticazione_fallita", "users", user.id, { ip });
    return json(401, { error: "Password non corretta" });
  }
  await logAudit(user.id, "riautenticazione", "users", user.id);
  return json(200, { ok: true }, { "Set-Cookie": sudoCookie(user) });
});
