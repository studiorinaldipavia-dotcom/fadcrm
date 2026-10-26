import { timingSafeEqual } from "node:crypto";
import { checkPassword } from "./_shared/security";
import { clientIp, hashPassword, json, loginBlocked, logAudit, parseBody, recordLogin, route, sql } from "./_shared/auth";

function same(a: string, b: string) {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

// Recupero di emergenza della password di un AMMINISTRATORE.
// Funziona solo se su Netlify esiste la variabile RECOVERY_TOKEN (da creare al bisogno e poi togliere).
export const handler = route("POST", async (event) => {
  const expected = process.env.RECOVERY_TOKEN;
  if (!expected || expected.length < 16) {
    return json(403, { error: "Il recupero amministratore non è attivo" });
  }

  const body = parseBody(event);
  const email = String(body.email ?? "").trim().toLowerCase();
  const newPassword = String(body.newPassword ?? "");
  const token = String(body.token ?? "");
  const ip = clientIp(event);

  if (await loginBlocked(`recupero:${email}`, ip)) {
    return json(429, { error: "Troppi tentativi. Riprova tra 15 minuti." });
  }
  if (!same(token, expected)) {
    await recordLogin(`recupero:${email}`, ip, false);
    await logAudit(null, "recupero_fallito", "users", null, { email: email.slice(0, 120), ip });
    return json(403, { error: "Codice di recupero non valido" });
  }
  const weak = await checkPassword(newPassword, email);
  if (weak) return json(400, { error: weak });

  const hash = await hashPassword(newPassword);
  const rows = await sql`
    UPDATE users SET password_hash = ${hash}, must_change_password = false, status = 'attivo',
           totp_enabled = false, totp_secret = NULL, totp_last_step = NULL,
           session_version = session_version + 1
    WHERE lower(email) = ${email} AND role = 'amministratore' RETURNING id`;
  if (rows.length === 0) return json(404, { error: "Nessun amministratore con questa email" });

  await sql`DELETE FROM user_recovery_codes WHERE user_id = ${rows[0].id}`;
  await logAudit(rows[0].id, "password_recuperata", "users", rows[0].id, { ip });
  return json(200, { ok: true });
});
