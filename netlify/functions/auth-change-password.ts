import {
  hashPassword,
  json,
  sessionCookie,
  signToken,
  logAudit,
  parseBody,
  requireUser,
  route,
  sql,
  verifyPassword,
} from "./_shared/auth";
import { checkPassword } from "./_shared/security";

// Cambio password dell'utente collegato (obbligatorio al primo accesso con password temporanea)
export const handler = route("POST", async (event) => {
  const auth = await requireUser(event);
  if ("response" in auth) return auth.response;

  const body = parseBody(event);
  const currentPassword = String(body.currentPassword ?? "");
  const newPassword = String(body.newPassword ?? "");

  const weak = await checkPassword(newPassword, auth.user.email);
  if (weak) return json(400, { error: weak });
  if (newPassword === currentPassword) return json(400, { error: "La nuova password deve essere diversa da quella attuale" });

  const rows = await sql`SELECT password_hash FROM users WHERE id = ${auth.user.id}`;
  if (!rows[0] || !(await verifyPassword(currentPassword, rows[0].password_hash))) {
    return json(401, { error: "La password attuale non e' corretta" });
  }

  const hash = await hashPassword(newPassword);
  const updated = await sql`
    UPDATE users SET password_hash = ${hash}, must_change_password = false,
           session_version = session_version + 1
    WHERE id = ${auth.user.id} RETURNING session_version`;
  await logAudit(auth.user.id, "password_cambiata", "users", auth.user.id);
  // Questa sessione continua; quelle aperte su altri dispositivi si chiudono
  const token = signToken(auth.user.id, 12 * 60 * 60, updated[0].session_version);
  return json(200, { ok: true }, { "Set-Cookie": sessionCookie(token) });
});
