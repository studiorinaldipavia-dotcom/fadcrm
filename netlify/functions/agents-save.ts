import {
  generateTempPassword,
  hashPassword,
  json,
  logAudit,
  parseBody,
  requireUser,
  route,
  sql,
} from "./_shared/auth";
import { requireSudo } from "./_shared/security";

const STATUSES = ["attivo", "sospeso"];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Fields = {
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
  office_id: string | null;
  role: string;
  status: string;
  hire_date: string | null;
};

function readFields(body: Record<string, any>): Fields | string {
  const f: Fields = {
    first_name: String(body.first_name ?? "").trim(),
    last_name: String(body.last_name ?? "").trim(),
    email: String(body.email ?? "").trim().toLowerCase(),
    phone: String(body.phone ?? "").trim() || null,
    office_id: String(body.office_id ?? "").trim() || null,
    role: String(body.role ?? ""),
    status: String(body.status ?? "attivo"),
    hire_date: String(body.hire_date ?? "").trim() || null,
  };
  if (!f.first_name || !f.last_name) return "Nome e cognome sono obbligatori";
  if (!EMAIL_RE.test(f.email)) return "Email non valida";
  if (!STATUSES.includes(f.status)) return "Stato non valido";
  if (f.office_id && !UUID_RE.test(f.office_id)) return "Ufficio non valido";
  if (f.hire_date && !DATE_RE.test(f.hire_date)) return "Data di ingresso non valida";
  return f;
}

// Azioni dell'amministratore sugli agenti: create | update | reset_password | reset_2fa | set_permissions
export const handler = route("POST", async (event) => {
  const auth = await requireUser(event, ["agents.manage"]);
  if ("response" in auth) return auth.response;
  const actor = auth.user;

  const body = parseBody(event);
  const action = String(body.action ?? "");
  const targetId = String(body.id ?? "");

  /* ----- NUOVO AGENTE ----- */
  if (action === "create") {
    const denied = requireSudo(event, actor);
    if (denied) return denied;
    const f = readFields(body);
    if (typeof f === "string") return json(400, { error: f });
    if ((await sql`SELECT 1 FROM roles WHERE key = ${f.role}`).length === 0) return json(400, { error: "Ruolo non valido" });

    const exists = await sql`SELECT 1 FROM users WHERE lower(email) = ${f.email}`;
    if (exists.length > 0) return json(409, { error: "Esiste gia' un utente con questa email" });

    const tempPassword = generateTempPassword();
    const hash = await hashPassword(tempPassword);
    const rows = await sql`
      INSERT INTO users (email, password_hash, first_name, last_name, phone, office_id, role,
                         hire_date, status, must_change_password)
      VALUES (${f.email}, ${hash}, ${f.first_name}, ${f.last_name}, ${f.phone}, ${f.office_id},
              ${f.role}, ${f.hire_date}, ${f.status}::user_status, true)
      RETURNING id`;
    await logAudit(actor.id, "agente_creato", "users", rows[0].id, { email: f.email, role: f.role });
    return json(200, { id: rows[0].id, tempPassword });
  }

  if (!UUID_RE.test(targetId)) return json(400, { error: "Agente non valido" });
  const current = (
    await sql`SELECT email, role::text AS role, status::text AS status FROM users WHERE id = ${targetId}`
  )[0];
  if (!current) return json(404, { error: "Agente non trovato" });
  const isSelf = targetId === actor.id;

  /* ----- MODIFICA / SOSPENDI / RIATTIVA / CAMBIA RUOLO ----- */
  if (action === "update") {
    const f = readFields(body);
    if (typeof f === "string") return json(400, { error: f });
    if ((await sql`SELECT 1 FROM roles WHERE key = ${f.role}`).length === 0) return json(400, { error: "Ruolo non valido" });

    // Per non restare chiusi fuori: nessuno puo' sospendere o declassare se stesso
    if (isSelf && (f.status !== "attivo" || f.role !== current.role)) {
      return json(400, { error: "Non puoi sospendere o cambiare il ruolo del tuo stesso account" });
    }
    if (f.role !== current.role || f.status !== current.status || f.email !== current.email) {
      const denied = requireSudo(event, actor);
      if (denied) return denied;
    }
    const clash = await sql`SELECT 1 FROM users WHERE lower(email) = ${f.email} AND id <> ${targetId}`;
    if (clash.length > 0) return json(409, { error: "Esiste gia' un altro utente con questa email" });

    await sql`
      UPDATE users SET first_name = ${f.first_name}, last_name = ${f.last_name}, email = ${f.email},
             phone = ${f.phone}, office_id = ${f.office_id}, role = ${f.role},
             hire_date = ${f.hire_date}, status = ${f.status}::user_status
      WHERE id = ${targetId}`;

    const statusChanged = f.status !== current.status;
    const roleChanged = f.role !== current.role;
    await logAudit(
      actor.id,
      statusChanged ? (f.status === "sospeso" ? "agente_sospeso" : "agente_riattivato")
        : roleChanged ? "ruolo_modificato" : "agente_modificato",
      "users",
      targetId,
      { from: { role: current.role, status: current.status }, to: { role: f.role, status: f.status } },
    );
    return json(200, { ok: true });
  }

  /* ----- NUOVA PASSWORD TEMPORANEA ----- */
  if (action === "reset_password") {
    const denied = requireSudo(event, actor);
    if (denied) return denied;
    if (isSelf) return json(400, { error: "Per la tua password usa il cambio password" });
    const tempPassword = generateTempPassword();
    const hash = await hashPassword(tempPassword);
    await sql`UPDATE users SET password_hash = ${hash}, must_change_password = true, session_version = session_version + 1 WHERE id = ${targetId}`;
    await logAudit(actor.id, "password_reimpostata", "users", targetId);
    return json(200, { tempPassword });
  }

  /* ----- REIMPOSTA LA VERIFICA IN DUE PASSAGGI (telefono perso) ----- */
  if (action === "reset_2fa") {
    const denied = requireSudo(event, actor);
    if (denied) return denied;
    if (isSelf) return json(400, { error: "Per il tuo account usa il tuo profilo" });
    await sql`UPDATE users SET totp_enabled = false, totp_secret = NULL, totp_last_step = NULL, session_version = session_version + 1 WHERE id = ${targetId}`;
    await sql`DELETE FROM user_recovery_codes WHERE user_id = ${targetId}`;
    await logAudit(actor.id, "2fa_reimpostata", "users", targetId);
    return json(200, { ok: true });
  }

  /* ----- PERMESSI PERSONALIZZATI ----- */
  if (action === "set_permissions") {
    const denied = requireSudo(event, actor);
    if (denied) return denied;
    if (isSelf) return json(400, { error: "Non puoi modificare i permessi del tuo stesso account" });

    const valid = new Set<string>((await sql`SELECT key FROM permissions`).map((r) => r.key as string));
    const input = body.overrides && typeof body.overrides === "object" ? body.overrides : {};
    const keys: string[] = [];
    const grants: boolean[] = [];
    for (const [key, value] of Object.entries(input)) {
      if (value === null) continue; // null = usa il permesso predefinito del ruolo
      if (!valid.has(key) || typeof value !== "boolean") {
        return json(400, { error: `Permesso non valido: ${key}` });
      }
      keys.push(key);
      grants.push(value);
    }

    // Un'unica istruzione: cancella le eccezioni vecchie e inserisce le nuove
    await sql`
      WITH removed AS (DELETE FROM user_permissions WHERE user_id = ${targetId})
      INSERT INTO user_permissions (user_id, permission_key, granted)
      SELECT ${targetId}::uuid, t.k, t.g FROM unnest(${keys}::text[], ${grants}::boolean[]) AS t(k, g)`;
    await logAudit(actor.id, "permessi_modificati", "users", targetId, { overrides: input });
    return json(200, { ok: true });
  }

  return json(400, { error: "Azione non valida" });
});
