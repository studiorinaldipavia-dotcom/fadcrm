import { clientIp, json, loadSessionUser, loginBlocked, logAudit, parseBody, recordLogin, route } from "./_shared/auth";
import { checkSecondFactor, completeLogin, verifyPurposeToken } from "./_shared/security";

// Secondo passaggio del login: codice a 6 cifre dell'app oppure un codice di recupero
export const handler = route("POST", async (event) => {
  const body = parseBody(event);
  const payload = verifyPurposeToken("2fa", String(body.challenge ?? ""));
  if (!payload || typeof payload.sub !== "string") {
    return json(401, { error: "La verifica è scaduta: rifai l'accesso con email e password", code: "challenge_expired" });
  }

  const ip = clientIp(event);
  const key = `2fa:${payload.sub}`;
  if (await loginBlocked(key, ip)) return json(429, { error: "Troppi tentativi. Riprova tra 15 minuti." });

  const user = await loadSessionUser(payload.sub);
  if (!user || !user.totp_enabled) return json(401, { error: "Accesso non riuscito" });

  const method = await checkSecondFactor(user.id, String(body.code ?? ""));
  if (!method) {
    await recordLogin(key, ip, false);
    await logAudit(user.id, "login_2fa_fallito", "users", user.id, { ip });
    return json(401, { error: "Codice non corretto" });
  }
  if (method === "recovery") await logAudit(user.id, "codice_recupero_usato", "users", user.id, { ip });

  return completeLogin(event, user, payload.remember === true, method === "recovery" ? "recovery" : "2fa");
}, { limit: { name: "login2fa", max: 60, windowSec: 60 } });
