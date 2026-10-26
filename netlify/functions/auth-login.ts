import {
  clientIp,
  getDummyHash,
  loginBlocked,
  recordLogin,
  json,
  logAudit,
  parseBody,
  route,
  sql,
  verifyPassword,
  loadSessionUser,
} from "./_shared/auth";
import { completeLogin, signPurposeToken } from "./_shared/security";

export const handler = route("POST", async (event) => {
  const body = parseBody(event);
  const email = String(body.email ?? "").trim().toLowerCase();
  const password = String(body.password ?? "");
  const remember = body.remember === true;

  if (!email || !password) return json(400, { error: "Inserisci email e password" });

  const ip = clientIp(event);
  if (await loginBlocked(email, ip)) {
    await logAudit(null, "login_bloccato", "users", null, { email: email.slice(0, 120), ip });
    return json(429, { error: "Troppi tentativi falliti. Riprova tra 15 minuti." });
  }

  const rows = await sql`
    SELECT id, password_hash, status::text AS status FROM users WHERE lower(email) = ${email}
  `;
  const found = rows[0];

  // Calcolo sempre l'hash, anche se l'utente non esiste (stessi tempi di risposta)
  const valid = await verifyPassword(password, found ? found.password_hash : await getDummyHash());
  if (!found || !valid) {
    await recordLogin(email, ip, false);
    await logAudit(found?.id ?? null, "login_fallito", "users", found?.id ?? null, { email: email.slice(0, 120), ip });
    return json(401, { error: "Email o password non corretti" });
  }
  if (found.status !== "attivo") {
    return json(403, { error: "Account sospeso. Contatta l'amministratore." });
  }

  const user = await loadSessionUser(found.id);
  if (!user) return json(403, { error: "Account sospeso. Contatta l'amministratore." });

  // Con la 2FA attiva la password da sola non basta: serve il codice dell'app (sfida valida 5 minuti)
  if (user.totp_enabled) {
    const challenge = signPurposeToken("2fa", { sub: user.id, remember }, 5 * 60);
    return json(200, { needs_2fa: true, challenge });
  }

  return completeLogin(event, user, remember, "password");
}, { limit: { name: "login", max: 60, windowSec: 60 } });
