import { timingSafeEqual } from "node:crypto";
import { hashPassword, json, logAudit, parseBody, route, sql } from "./_shared/auth";
import { checkPassword } from "./_shared/security";

function sameSecret(a: string, b: string) {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

// Crea il PRIMO amministratore. Funziona una sola volta: se esiste gia' un utente, rifiuta.
export const handler = route("POST", async (event) => {
  const expected = process.env.SETUP_TOKEN;
  if (!expected || expected.length < 12) {
    return json(500, { error: "SETUP_TOKEN non configurato su Netlify" });
  }

  const body = parseBody(event);
  const token = String(body.token ?? "");
  const email = String(body.email ?? "").trim().toLowerCase();
  const password = String(body.password ?? "");
  const firstName = String(body.first_name ?? "").trim();
  const lastName = String(body.last_name ?? "").trim();

  if (!sameSecret(token, expected)) return json(403, { error: "Codice di configurazione non valido" });
  if (!firstName || !lastName) return json(400, { error: "Nome e cognome obbligatori" });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json(400, { error: "Email non valida" });
  const weak = await checkPassword(password, String(body.email ?? ""));
  if (weak) return json(400, { error: weak });

  const hash = await hashPassword(password);
  const rows = await sql`
    INSERT INTO users (email, password_hash, first_name, last_name, role, status, office_id, hire_date, must_change_password)
    SELECT ${email}, ${hash}, ${firstName}, ${lastName}, 'amministratore', 'attivo',
           (SELECT id FROM offices ORDER BY created_at LIMIT 1), current_date, false
    WHERE NOT EXISTS (SELECT 1 FROM users)
    RETURNING id
  `;
  if (rows.length === 0) return json(409, { error: "Configurazione gia' eseguita" });

  await logAudit(rows[0].id, "amministratore_creato", "users", rows[0].id, { email });
  return json(200, { ok: true });
});
