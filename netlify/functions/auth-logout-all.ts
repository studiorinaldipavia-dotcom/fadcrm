import { json, logAudit, requireUser, route, sessionCookie, signToken, sql } from "./_shared/auth";
import { clearSudoCookie } from "./_shared/security";

// "Esci da tutti i dispositivi": invalida ogni sessione aperta, tranne quella in uso
export const handler = route("POST", async (event) => {
  const auth = await requireUser(event);
  if ("response" in auth) return auth.response;
  const { user } = auth;
  const updated = await sql`UPDATE users SET session_version = session_version + 1 WHERE id = ${user.id} RETURNING session_version`;
  await logAudit(user.id, "sessioni_chiuse", "users", user.id);
  const token = signToken(user.id, 12 * 60 * 60, updated[0].session_version);
  return {
    ...json(200, { ok: true }),
    multiValueHeaders: { "Set-Cookie": [sessionCookie(token), clearSudoCookie()] },
  };
});
