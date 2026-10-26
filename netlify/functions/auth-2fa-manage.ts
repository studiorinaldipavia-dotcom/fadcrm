import { json, logAudit, parseBody, rateLimit, requireUser, route, sql } from "./_shared/auth";
import {
  checkSecondFactor,
  createRecoveryCodes,
  decryptSecret,
  encryptSecret,
  newTotpSecret,
  otpauthUri,
  requireSudo,
  verifyTotp,
} from "./_shared/security";

// Gestione della verifica in due passaggi da parte dell'utente collegato:
// begin (genera il segreto) | enable (conferma con un codice) | disable | new_codes
export const handler = route("POST", async (event) => {
  const auth = await requireUser(event);
  if ("response" in auth) return auth.response;
  const { user } = auth;
  const body = parseBody(event);
  const action = String(body.action ?? "");

  if (!(await rateLimit(`2fa-manage:${user.id}`, 20, 600))) return json(429, { error: "Troppi tentativi. Riprova tra qualche minuto." });

  if (action === "begin") {
    if (user.totp_enabled) return json(400, { error: "La verifica in due passaggi è già attiva" });
    const secret = newTotpSecret();
    await sql`UPDATE users SET totp_secret = ${encryptSecret(secret)}, totp_enabled = false, totp_last_step = NULL WHERE id = ${user.id}`;
    return json(200, { secret, uri: otpauthUri(user.email, secret) });
  }

  if (action === "enable") {
    if (user.totp_enabled) return json(400, { error: "La verifica in due passaggi è già attiva" });
    const row = (await sql`SELECT totp_secret FROM users WHERE id = ${user.id}`)[0];
    if (!row?.totp_secret) return json(400, { error: "Avvia prima la configurazione" });
    const step = verifyTotp(decryptSecret(row.totp_secret), String(body.code ?? ""), null);
    if (step === null) return json(400, { error: "Codice non corretto: controlla l'ora del telefono e riprova" });
    await sql`UPDATE users SET totp_enabled = true, totp_last_step = ${step} WHERE id = ${user.id}`;
    const codes = await createRecoveryCodes(user.id);
    await logAudit(user.id, "2fa_attivata", "users", user.id);
    return json(200, { ok: true, codes });
  }

  if (!user.totp_enabled) return json(400, { error: "La verifica in due passaggi non è attiva" });

  if (action === "disable") {
    const denied = requireSudo(event, user);
    if (denied) return denied;
    if (user.mfa_required) return json(400, { error: "La verifica in due passaggi è obbligatoria per il tuo ruolo" });
    if (!(await checkSecondFactor(user.id, String(body.code ?? "")))) return json(400, { error: "Codice non corretto" });
    await sql`UPDATE users SET totp_enabled = false, totp_secret = NULL, totp_last_step = NULL WHERE id = ${user.id}`;
    await sql`DELETE FROM user_recovery_codes WHERE user_id = ${user.id}`;
    await logAudit(user.id, "2fa_disattivata", "users", user.id);
    return json(200, { ok: true });
  }

  if (action === "new_codes") {
    const denied = requireSudo(event, user);
    if (denied) return denied;
    if (!(await checkSecondFactor(user.id, String(body.code ?? "")))) return json(400, { error: "Codice non corretto" });
    const codes = await createRecoveryCodes(user.id);
    await logAudit(user.id, "codici_recupero_rigenerati", "users", user.id);
    return json(200, { codes });
  }

  return json(400, { error: "Azione non valida" });
});
