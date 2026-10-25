import {
  clientIp,
  getDummyHash,
  loginBlocked,
  recordLogin,
  json,
  logAudit,
  parseBody,
  route,
  signToken,
  sessionCookie,
  sql,
  verifyPassword,
  loadSessionUser,
} from "./_shared/auth";

const DAY = 24 * 60 * 60;

export const handler = route("POST", async (event) => {
  const body = parseBody(event);
  const email = String(body.email ?? "").trim().toLowerCase();
  const password = String(body.password ?? "");
  const remember = body.remember === true;

  if (!email || !password) return json(400, { error: "Inserisci email e password" });

  const ip = clientIp(event);
  if (await loginBlocked(email, ip)) {
    return json(429, { error: "Troppi tentativi falliti. Riprova tra 15 minuti." });
  }

  const rows = await sql`
    SELECT id, password_hash, status::text AS status, session_version FROM users WHERE lower(email) = ${email}
  `;
  const found = rows[0];

  // Calcolo sempre l'hash, anche se l'utente non esiste (stessi tempi di risposta)
  const valid = await verifyPassword(password, found ? found.password_hash : await getDummyHash());
  if (!found || !valid) {
    await recordLogin(email, ip, false);
    return json(401, { error: "Email o password non corretti" });
  }
  if (found.status !== "attivo") {
    return json(403, { error: "Account sospeso. Contatta l'amministratore." });
  }

  const ttl = remember ? 30 * DAY : 12 * 60 * 60;
  const token = signToken(found.id, ttl, found.session_version);
  const user = await loadSessionUser(found.id);
  await recordLogin(email, ip, true);
  await logAudit(found.id, "login", "users", found.id);

  return json(200, { user }, { "Set-Cookie": sessionCookie(token, remember ? ttl : undefined) });
});
