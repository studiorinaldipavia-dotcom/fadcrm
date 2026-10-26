import { neon } from "@neondatabase/serverless";
import {
  createHmac,
  randomBytes,
  randomInt,
  scrypt as scryptCb,
  timingSafeEqual,
} from "node:crypto";
import { promisify } from "node:util";
import type { Handler, HandlerEvent, HandlerResponse } from "@netlify/functions";

export const sql = neon(process.env.DATABASE_URL!);

const scrypt = promisify(scryptCb) as unknown as (
  password: string,
  salt: Buffer,
  keylen: number,
) => Promise<Buffer>;

/* ---------- Password (hash scrypt, mai in chiaro) ---------- */

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await scrypt(password, salt, 64);
  return `scrypt$${salt.toString("base64")}$${key.toString("base64")}`;
}

export async function verifyPassword(
  password: string,
  stored: string,
): Promise<boolean> {
  const [alg, saltB64, keyB64] = stored.split("$");
  if (alg !== "scrypt" || !saltB64 || !keyB64) return false;
  const expected = Buffer.from(keyB64, "base64");
  const actual = await scrypt(password, Buffer.from(saltB64, "base64"), expected.length);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

let dummyHash: Promise<string> | null = null;
/** Usato quando l'email non esiste, per non rivelare quali email sono registrate */
export function getDummyHash() {
  if (!dummyHash) dummyHash = hashPassword("password-finta-non-valida");
  return dummyHash;
}

/* ---------- Token di sessione (JWT HS256) ---------- */

function secret(): string {
  const s = process.env.JWT_SECRET;
  if (!s || s.length < 32) throw new Error("JWT_SECRET mancante o troppo corto");
  return s;
}

function b64u(value: string): string {
  return Buffer.from(value).toString("base64url");
}

export function signToken(userId: string, ttlSeconds: number, version = 0): string {
  const header = b64u(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const body = b64u(
    JSON.stringify({ sub: userId, v: version, exp: Math.floor(Date.now() / 1000) + ttlSeconds }),
  );
  const sig = createHmac("sha256", secret()).update(`${header}.${body}`).digest("base64url");
  return `${header}.${body}.${sig}`;
}

export function verifyToken(token: string): { sub: string; v: number } | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const expected = createHmac("sha256", secret()).update(`${parts[0]}.${parts[1]}`).digest();
  const given = Buffer.from(parts[2], "base64url");
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
  try {
    const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8"));
    if (typeof payload.sub !== "string" || typeof payload.exp !== "number") return null;
    if (payload.exp < Math.floor(Date.now() / 1000)) return null;
    return { sub: payload.sub, v: typeof payload.v === "number" ? payload.v : 0 };
  } catch {
    return null;
  }
}

/* ---------- Cookie ---------- */

const COOKIE = "le_session";

export function sessionCookie(token: string, maxAgeSeconds?: number): string {
  return (
    `${COOKIE}=${token}; HttpOnly; Secure; SameSite=Lax; Path=/` +
    (maxAgeSeconds ? `; Max-Age=${maxAgeSeconds}` : "")
  );
}

export function clearCookie(): string {
  return `${COOKIE}=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0`;
}

function readCookie(event: HandlerEvent): string | null {
  const raw = event.headers["cookie"];
  if (!raw) return null;
  for (const part of raw.split(";")) {
    const [name, ...rest] = part.trim().split("=");
    if (name === COOKIE) return rest.join("=");
  }
  return null;
}

/* ---------- Risposte e utilita' ---------- */

export function json(
  statusCode: number,
  body: unknown,
  headers: Record<string, string> = {},
): HandlerResponse {
  return {
    statusCode,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store", ...headers },
    body: JSON.stringify(body),
  };
}

export function parseBody(event: HandlerEvent): Record<string, any> {
  try {
    const data = JSON.parse(event.body || "{}");
    return data && typeof data === "object" ? data : {};
  } catch {
    return {};
  }
}

/** Controlla il metodo HTTP e nasconde i dettagli degli errori interni */
export function route(
  method: "GET" | "POST" | ("GET" | "POST")[],
  fn: (event: HandlerEvent) => Promise<HandlerResponse>,
  options: { limit?: { name: string; max: number; windowSec: number } } = {},
): Handler {
  const allowed = Array.isArray(method) ? method : [method];
  return async (event) => {
    if (!(allowed as string[]).includes(event.httpMethod)) return json(405, { error: "Metodo non consentito" });
    // Protezione CSRF: le richieste di scrittura devono arrivare dal nostro stesso sito
    if (event.httpMethod === "POST") {
      const origin = event.headers["origin"];
      const host = event.headers["host"];
      if (origin && host) {
        let originHost = "";
        try {
          originHost = new URL(origin).host;
        } catch {
          /* origine non valida */
        }
        if (originHost !== host) return json(403, { error: "Richiesta non consentita" });
      }
      // Un altro sito non puo' aggiungere questo header senza il nostro consenso (il browser blocca la richiesta)
      if (event.headers["x-requested-with"] !== "fad-leadhub") return json(403, { error: "Richiesta non consentita" });
      const fetchSite = event.headers["sec-fetch-site"];
      if (fetchSite && fetchSite !== "same-origin" && fetchSite !== "none") return json(403, { error: "Richiesta non consentita" });
    }
    try {
      if (options.limit) {
        const { name, max, windowSec } = options.limit;
        if (!(await rateLimit(`${name}:${clientIp(event)}`, max, windowSec))) {
          return json(429, { error: "Troppe richieste. Riprova tra qualche minuto." });
        }
      }
      return await fn(event);
    } catch (error) {
      console.error(error);
      return json(500, { error: "Errore del server" });
    }
  };
}

export async function logAudit(
  actorId: string | null,
  action: string,
  entity: string,
  entityId: string | null = null,
  details: Record<string, unknown> = {},
) {
  await sql`
    INSERT INTO audit_logs (actor_id, action, entity, entity_id, details)
    VALUES (${actorId}, ${action}, ${entity}, ${entityId}, ${JSON.stringify(details)}::jsonb)
  `;
}

/* ---------- Utente di sessione e permessi ---------- */

export type SessionUser = {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  role: string;
  role_label: string;
  theme: string;
  office_id: string | null;
  photo_url: string | null;
  must_change_password: boolean;
  session_version: number;
  totp_enabled: boolean;
  mfa_required: boolean;
  mfa_setup_required: boolean;
  permissions: string[];
};

export async function loadSessionUser(userId: string): Promise<SessionUser | null> {
  const rows = await sql`
    SELECT u.id, u.email, u.first_name, u.last_name, u.role::text AS role, coalesce(r.label, u.role) AS role_label,
           u.status::text AS status, u.theme, u.office_id, u.photo_url, u.must_change_password, u.session_version, u.totp_enabled
    FROM users u LEFT JOIN roles r ON r.key = u.role WHERE u.id = ${userId}
  `;
  const u = rows[0];
  if (!u || u.status !== "attivo") return null;

  const base = await sql`
    SELECT permission_key FROM role_permissions WHERE role = ${u.role}
  `;
  const overrides = await sql`
    SELECT permission_key, granted FROM user_permissions WHERE user_id = ${u.id}
  `;
  const perms = new Set<string>(base.map((r) => r.permission_key as string));
  for (const o of overrides) {
    if (o.granted) perms.add(o.permission_key as string);
    else perms.delete(o.permission_key as string);
  }

  const permissions = [...perms].sort();
  return {
    id: u.id,
    email: u.email,
    first_name: u.first_name,
    last_name: u.last_name,
    role: u.role,
    role_label: u.role_label,
    theme: u.theme,
    office_id: u.office_id,
    photo_url: u.photo_url,
    must_change_password: u.must_change_password,
    session_version: u.session_version,
    totp_enabled: u.totp_enabled === true,
    mfa_required: mfaRequired(u.role, permissions),
    mfa_setup_required: u.totp_enabled !== true && mfaRequired(u.role, permissions),
    permissions,
  };
}

/* ---------- Politica di sicurezza degli account ---------- */

const PRIVILEGED_PERMISSIONS = ["roles.manage", "agents.manage", "agents.delete", "customers.delete"];

/** Account che possono cambiare permessi, utenti o cancellare dati: sessioni piu' corte e 2FA obbligatoria */
export function isPrivileged(user: { permissions: string[] }): boolean {
  return user.permissions.some((p) => PRIVILEGED_PERMISSIONS.includes(p));
}

// MFA_REQUIRED su Netlify: "privileged" (predefinito: account con permessi alti), "all" (tutti) oppure "off"
function mfaRequired(role: string, permissions: string[]): boolean {
  const mode = (process.env.MFA_REQUIRED || "privileged").toLowerCase();
  if (mode === "off") return false;
  if (mode === "all") return true;
  return role === "amministratore" || isPrivileged({ permissions });
}

/* ---------- Limite di richieste ---------- */

/** Ritorna false se la chiave ha superato "max" richieste nella finestra. Se il database non risponde non blocca nessuno. */
export async function rateLimit(key: string, max: number, windowSec: number): Promise<boolean> {
  try {
    const bucket = Math.floor(Date.now() / 1000 / windowSec);
    const rows = await sql`
      INSERT INTO rate_limits (key, bucket, count) VALUES (${key}, ${bucket}, 1)
      ON CONFLICT (key, bucket) DO UPDATE SET count = rate_limits.count + 1
      RETURNING count`;
    if (Math.random() < 0.02) await sql`DELETE FROM rate_limits WHERE bucket < ${bucket - 2}`;
    return rows[0].count <= max;
  } catch (error) {
    console.error("rateLimit:", error);
    return true;
  }
}

/** Registra l'evento solo se lo stesso utente non l'ha gia' generato negli ultimi minuti (evita registri enormi) */
export async function logAuditOnce(
  actorId: string,
  action: string,
  entity: string,
  entityId: string | null,
  minutes = 10,
  details: Record<string, unknown> = {},
) {
  const recent = await sql`
    SELECT 1 FROM audit_logs
    WHERE actor_id = ${actorId} AND action = ${action} AND entity = ${entity}
      AND entity_id IS NOT DISTINCT FROM ${entityId}::uuid
      AND created_at > now() - make_interval(mins => ${minutes}) LIMIT 1`;
  if (recent.length === 0) await logAudit(actorId, action, entity, entityId, details);
}

export async function getSessionUser(event: HandlerEvent): Promise<SessionUser | null> {
  const token = readCookie(event);
  if (!token) return null;
  const payload = verifyToken(token);
  if (!payload) return null;
  const user = await loadSessionUser(payload.sub);
  // Se la password e' stata cambiata dopo l'emissione del token, la sessione non vale piu'
  if (!user || user.session_version !== payload.v) return null;
  return user;
}

/** Richiede utente collegato e (opzionale) almeno uno dei permessi indicati */
export async function requireUser(
  event: HandlerEvent,
  anyOf?: string[],
): Promise<{ user: SessionUser } | { response: HandlerResponse }> {
  const user = await getSessionUser(event);
  if (!user) return { response: json(401, { error: "Accesso richiesto" }) };
  // Chi deve ancora attivare la 2FA puo' fare solo quello (e uscire / cambiare password)
  if (user.mfa_setup_required && !/\/(auth-2fa[a-z-]*|auth-logout|auth-change-password)$/.test(event.path)) {
    return { response: json(403, { error: "Attiva la verifica in due passaggi per continuare", code: "mfa_setup_required" }) };
  }
  if (anyOf && !anyOf.some((p) => user.permissions.includes(p))) {
    return { response: json(403, { error: "Non hai il permesso per questa operazione" }) };
  }
  return { user };
}

/* ---------- Password temporanee (per i nuovi agenti) ---------- */

const TEMP_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";

export function generateTempPassword(length = 12): string {
  let out = "";
  for (let i = 0; i < length; i++) out += TEMP_ALPHABET[randomInt(TEMP_ALPHABET.length)];
  return out;
}

/* ---------- Protezione contro i tentativi ripetuti di accesso ---------- */

export function clientIp(event: HandlerEvent): string {
  return (
    event.headers["x-nf-client-connection-ip"] ||
    (event.headers["x-forwarded-for"] || "").split(",")[0].trim() ||
    "sconosciuto"
  );
}

const MAX_FAILS_PER_EMAIL = 5;
const MAX_FAILS_PER_IP = 25;

/** Vero se, negli ultimi 15 minuti, ci sono troppi accessi falliti per questa email o da questo IP */
export async function loginBlocked(email: string, ip: string): Promise<boolean> {
  const rows = await sql`
    SELECT count(*) FILTER (WHERE email = ${email})::int AS by_email,
           count(*) FILTER (WHERE ip = ${ip})::int AS by_ip
    FROM login_attempts
    WHERE success = false AND created_at > now() - interval '15 minutes'`;
  return rows[0].by_email >= MAX_FAILS_PER_EMAIL || rows[0].by_ip >= MAX_FAILS_PER_IP;
}

export async function recordLogin(email: string, ip: string, success: boolean) {
  if (success) {
    await sql`DELETE FROM login_attempts WHERE email = ${email} AND success = false`;
  } else {
    await sql`INSERT INTO login_attempts (email, ip, success) VALUES (${email}, ${ip}, false)`;
  }
  await sql`DELETE FROM login_attempts WHERE created_at < now() - interval '2 days'`;
}
