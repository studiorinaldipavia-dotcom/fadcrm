// Funzioni di sicurezza: 2FA (TOTP), riautenticazione, controllo password, dispositivi nuovi.
import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import type { HandlerEvent } from "@netlify/functions";
import {
  clientIp,
  isPrivileged,
  json,
  logAudit,
  recordLogin,
  sessionCookie,
  signToken,
  sql,
  type SessionUser,
} from "./auth";
import { mailConfigured, sendMail } from "./mail";

/* ---------- Token a scopo singolo (sfida 2FA, riautenticazione) ---------- */

function purposeKey(purpose: string): Buffer {
  const s = process.env.JWT_SECRET;
  if (!s || s.length < 32) throw new Error("JWT_SECRET mancante o troppo corto");
  return createHmac("sha256", s).update(`purpose:${purpose}`).digest();
}

export function signPurposeToken(purpose: string, payload: Record<string, unknown>, ttlSeconds: number): string {
  const body = Buffer.from(JSON.stringify({ ...payload, exp: Math.floor(Date.now() / 1000) + ttlSeconds })).toString("base64url");
  const sig = createHmac("sha256", purposeKey(purpose)).update(body).digest("base64url");
  return `${body}.${sig}`;
}

export function verifyPurposeToken(purpose: string, token: string): Record<string, any> | null {
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  const expected = createHmac("sha256", purposeKey(purpose)).update(body).digest();
  const given = Buffer.from(sig, "base64url");
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
    if (typeof payload.exp !== "number" || payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

/* ---------- TOTP (RFC 6238, app tipo Google Authenticator) ---------- */

const B32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

export function base32Encode(buf: Buffer): string {
  let bits = 0;
  let value = 0;
  let out = "";
  for (const byte of buf) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += B32[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += B32[(value << (5 - bits)) & 31];
  return out;
}

export function base32Decode(text: string): Buffer {
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (const ch of text.replace(/=+$/, "").toUpperCase()) {
    const idx = B32.indexOf(ch);
    if (idx < 0) continue;
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

export const newTotpSecret = () => base32Encode(randomBytes(20));

function hotp(secret: Buffer, counter: number): string {
  const msg = Buffer.alloc(8);
  msg.writeBigUInt64BE(BigInt(counter));
  const h = createHmac("sha1", secret).update(msg).digest();
  const offset = h[h.length - 1] & 15;
  const code = ((h[offset] & 0x7f) << 24) | (h[offset + 1] << 16) | (h[offset + 2] << 8) | h[offset + 3];
  return String(code % 1_000_000).padStart(6, "0");
}

/** Ritorna il "passo" (finestra di 30 s) valido, oppure null. Accetta il passo precedente e il successivo (orologi sfasati). */
export function verifyTotp(secretB32: string, code: string, lastStep: number | null): number | null {
  const clean = code.replace(/\s+/g, "");
  if (!/^\d{6}$/.test(clean)) return null;
  const secret = base32Decode(secretB32);
  const now = Math.floor(Date.now() / 30000);
  for (const step of [now, now - 1, now + 1]) {
    const expected = Buffer.from(hotp(secret, step));
    const given = Buffer.from(clean);
    if (timingSafeEqual(expected, given)) {
      // lo stesso codice non si puo' riusare (protezione da chi lo ha sbirciato)
      if (lastStep !== null && step <= lastStep) return null;
      return step;
    }
  }
  return null;
}

export const otpauthUri = (email: string, secret: string) =>
  `otpauth://totp/${encodeURIComponent(`FAD LeadHub:${email}`)}?secret=${secret}&issuer=${encodeURIComponent("FAD LeadHub")}&algorithm=SHA1&digits=6&period=30`;

/* ---------- Cifratura del segreto TOTP nel database (AES-256-GCM) ---------- */

function encKey(): Buffer {
  const base = process.env.MFA_ENCRYPTION_KEY || process.env.JWT_SECRET;
  if (!base || base.length < 32) throw new Error("MFA_ENCRYPTION_KEY o JWT_SECRET mancanti");
  return createHash("sha256").update(`totp-secret:${base}`).digest();
}

export function encryptSecret(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encKey(), iv);
  const data = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return `v1.${iv.toString("base64url")}.${data.toString("base64url")}.${cipher.getAuthTag().toString("base64url")}`;
}

export function decryptSecret(stored: string): string {
  const [v, iv, data, tag] = stored.split(".");
  if (v !== "v1" || !iv || !data || !tag) throw new Error("Segreto 2FA non valido");
  const decipher = createDecipheriv("aes-256-gcm", encKey(), Buffer.from(iv, "base64url"));
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(data, "base64url")), decipher.final()]).toString("utf8");
}

/* ---------- Codici di recupero ---------- */

const hashCode = (code: string) => createHash("sha256").update(code.replace(/[\s-]+/g, "").toUpperCase()).digest("hex");

export async function createRecoveryCodes(userId: string): Promise<string[]> {
  const codes = Array.from({ length: 10 }, () => {
    const raw = base32Encode(randomBytes(6)).slice(0, 10);
    return `${raw.slice(0, 5)}-${raw.slice(5)}`;
  });
  await sql.transaction([
    sql`DELETE FROM user_recovery_codes WHERE user_id = ${userId}`,
    ...codes.map((c) => sql`INSERT INTO user_recovery_codes (user_id, code_hash) VALUES (${userId}, ${hashCode(c)})`),
  ]);
  return codes;
}

/** Controlla un codice a 6 cifre OPPURE un codice di recupero. Ritorna come e' stato verificato. */
export async function checkSecondFactor(userId: string, input: string): Promise<"totp" | "recovery" | null> {
  const row = (await sql`SELECT totp_secret, totp_last_step FROM users WHERE id = ${userId} AND totp_enabled`)[0];
  if (!row?.totp_secret) return null;
  const trimmed = input.trim();
  if (/^\d[\d\s]{5,}$/.test(trimmed)) {
    const step = verifyTotp(decryptSecret(row.totp_secret), trimmed, row.totp_last_step === null ? null : Number(row.totp_last_step));
    if (step === null) return null;
    // aggiornamento condizionato: due richieste con lo stesso codice non passano entrambe
    const updated = await sql`
      UPDATE users SET totp_last_step = ${step} WHERE id = ${userId} AND (totp_last_step IS NULL OR totp_last_step < ${step}) RETURNING id`;
    return updated.length > 0 ? "totp" : null;
  }
  if (trimmed.length >= 8) {
    const used = await sql`
      UPDATE user_recovery_codes SET used_at = now()
      WHERE id = (SELECT id FROM user_recovery_codes WHERE user_id = ${userId} AND code_hash = ${hashCode(trimmed)} AND used_at IS NULL LIMIT 1)
      RETURNING id`;
    return used.length > 0 ? "recovery" : null;
  }
  return null;
}

/* ---------- Riautenticazione per le azioni sensibili ("sudo") ---------- */

const SUDO_COOKIE = "le_sudo";
const SUDO_SECONDS = 10 * 60;

export function sudoCookie(user: SessionUser): string {
  const token = signPurposeToken("sudo", { sub: user.id, v: user.session_version }, SUDO_SECONDS);
  return `${SUDO_COOKIE}=${token}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${SUDO_SECONDS}`;
}

export function clearSudoCookie(): string {
  return `${SUDO_COOKIE}=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0`;
}

/** Per le azioni sensibili: ritorna una risposta 403 "reauth_required" se la password non e' stata riconfermata da poco. */
export function requireSudo(event: HandlerEvent, user: SessionUser) {
  for (const part of (event.headers["cookie"] || "").split(";")) {
    const [name, ...rest] = part.trim().split("=");
    if (name === SUDO_COOKIE) {
      const p = verifyPurposeToken("sudo", rest.join("="));
      if (p && p.sub === user.id && p.v === user.session_version) return null;
    }
  }
  return json(403, { error: "Conferma la tua password per continuare", code: "reauth_required" });
}

/* ---------- Regole sulla password ---------- */

export const MIN_PASSWORD = 12;

const COMMON = new Set(
  (
    "password password1 password123 passw0rd qwerty qwerty123 qwertyuiop azerty 123456 1234567 12345678 123456789 1234567890 111111 000000 " +
    "abc123 letmein welcome welcome1 admin admin123 administrator iloveyou monkey dragon football baseball master login princess sunshine " +
    "ciaocomestai ciao123 ciaociao italia italia1 juventus milan inter napoli roma123 forzaitalia password1234 changeme cambiami fad fad123 leadhub"
  ).split(" "),
);

/** Ritorna il messaggio d'errore, oppure null se la password va bene. */
export async function checkPassword(password: string, email = ""): Promise<string | null> {
  if (password.length < MIN_PASSWORD) return `La password deve avere almeno ${MIN_PASSWORD} caratteri`;
  if (password.length > 200) return "La password è troppo lunga";
  const lower = password.toLowerCase();
  const local = email.split("@")[0]?.toLowerCase() ?? "";
  if (COMMON.has(lower) || /^(.)\1+$/.test(password) || "0123456789".includes(lower) || "abcdefghijklmnopqrstuvwxyz".includes(lower)) {
    return "Questa password è troppo comune: scegline una più originale";
  }
  if (local.length >= 4 && lower.includes(local)) return "La password non deve contenere il tuo indirizzo email";
  // Controllo su elenchi di password già violate (HIBP): si invia solo l'inizio dell'impronta, mai la password. Se il servizio non risponde si prosegue.
  try {
    const sha = createHash("sha1").update(password).digest("hex").toUpperCase();
    const res = await fetch(`https://api.pwnedpasswords.com/range/${sha.slice(0, 5)}`, {
      headers: { "Add-Padding": "true" },
      signal: AbortSignal.timeout(2500),
    });
    if (res.ok) {
      const suffix = sha.slice(5);
      for (const line of (await res.text()).split("\n")) {
        const [hash, count] = line.trim().split(":");
        if (hash === suffix && Number(count) > 0) return "Questa password è comparsa in violazioni di dati pubbliche: scegline un'altra";
      }
    }
  } catch {
    /* servizio non raggiungibile: nessun blocco */
  }
  return null;
}

/* ---------- Accesso completato: cookie, dispositivo nuovo, registro ---------- */

const DAY = 24 * 60 * 60;

export async function completeLogin(
  event: HandlerEvent,
  user: SessionUser,
  remember: boolean,
  method: "password" | "2fa" | "recovery",
) {
  // Gli account con permessi alti restano collegati al massimo 12 ore, senza "Ricordami"
  const longSession = remember && !isPrivileged(user);
  const ttl = longSession ? 14 * DAY : 12 * 60 * 60;
  const token = signToken(user.id, ttl, user.session_version);
  const ip = clientIp(event);
  await recordLogin(user.email.toLowerCase(), ip, true);
  await logAudit(user.id, "login", "users", user.id, { ip, metodo: method });
  await notifyNewDevice(event, user, ip).catch((error) => console.error("Avviso nuovo dispositivo:", error));
  return json(200, { user }, { "Set-Cookie": sessionCookie(token, longSession ? ttl : undefined) });
}

async function notifyNewDevice(event: HandlerEvent, user: SessionUser, ip: string) {
  const ua = (event.headers["user-agent"] || "sconosciuto").slice(0, 300);
  const fp = createHash("sha256").update(ua).digest("hex");
  const known = await sql`SELECT fingerprint FROM user_devices WHERE user_id = ${user.id}`;
  await sql`
    INSERT INTO user_devices (user_id, fingerprint) VALUES (${user.id}, ${fp})
    ON CONFLICT (user_id, fingerprint) DO UPDATE SET last_seen = now()`;
  // Al primissimo accesso non c'e' nulla con cui confrontare; poi si avvisa a ogni dispositivo nuovo
  if (known.length === 0 || known.some((k) => k.fingerprint === fp) || !mailConfigured()) return;
  const when = new Date().toLocaleString("it-IT", { timeZone: "Europe/Rome" });
  await sendMail({
    to: user.email,
    subject: "Nuovo accesso al tuo account FAD LeadHub",
    text:
      `Ciao ${user.first_name},\n\nè stato effettuato un accesso al tuo account da un dispositivo nuovo.\n\n` +
      `Data: ${when}\nIndirizzo IP: ${ip}\nBrowser: ${ua}\n\n` +
      "Se sei stato tu non devi fare nulla. Se non riconosci questo accesso, cambia subito la password dal tuo profilo e avvisa l'amministratore.",
    html:
      `<p>Ciao ${escapeHtml(user.first_name)},</p><p>è stato effettuato un accesso al tuo account FAD LeadHub da un <strong>dispositivo nuovo</strong>.</p>` +
      `<p>Data: ${escapeHtml(when)}<br>Indirizzo IP: ${escapeHtml(ip)}<br>Browser: ${escapeHtml(ua)}</p>` +
      "<p>Se sei stato tu non devi fare nulla. Se non riconosci questo accesso, cambia subito la password dal tuo profilo e avvisa l'amministratore.</p>",
  });
}

const escapeHtml = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

