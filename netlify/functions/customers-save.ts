import { json, logAudit, parseBody, requireUser, route, sql } from "./_shared/auth";
import { addMonths, romeLocalToUtc, todayInRome } from "./_shared/dates";
import { geocode } from "./_shared/geocode";
import { addHistory, canEditCustomer, canViewCustomer, UUID_RE } from "./_shared/customers";

const STATUSES = ["OK", "NR", "KO"];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type Fields = {
  first_name: string;
  last_name: string;
  fiscal_code: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  city: string | null;
  province: string | null;
  interests: string[];
  status: string;
};

const LABELS: Record<string, string> = {
  first_name: "nome",
  last_name: "cognome",
  fiscal_code: "codice fiscale",
  phone: "telefono",
  email: "email",
  address: "indirizzo",
  city: "comune",
  province: "provincia",
  interests: "prodotti/interessi",
};

async function readFields(body: Record<string, any>): Promise<Fields | string> {
  const text = (value: unknown) => String(value ?? "").trim() || null;
  const f: Fields = {
    first_name: String(body.first_name ?? "").trim(),
    last_name: String(body.last_name ?? "").trim(),
    fiscal_code: text(body.fiscal_code)?.toUpperCase().replace(/\s+/g, "") ?? null,
    phone: text(body.phone),
    email: text(body.email)?.toLowerCase() ?? null,
    address: text(body.address),
    city: text(body.city),
    province: text(body.province)?.toUpperCase() ?? null,
    interests: Array.isArray(body.interests) ? body.interests.map(String) : [],
    status: String(body.status ?? "OK"),
  };
  if (!f.first_name || !f.last_name) return "Nome e cognome sono obbligatori";
  if (f.email && !EMAIL_RE.test(f.email)) return "Email non valida";
  if (f.fiscal_code && !/^([A-Z0-9]{16}|\d{11})$/.test(f.fiscal_code)) {
    return "Codice fiscale (16 caratteri) o partita IVA (11 cifre) non valido";
  }
  if (f.province && !/^[A-Z]{2}$/.test(f.province)) return "La provincia va indicata con 2 lettere (es. PV)";
  if (!STATUSES.includes(f.status)) return "Stato non valido";
  if (f.phone && f.phone.replace(/\D/g, "").length < 6) return "Numero di telefono non valido";

  if (f.interests.length > 0) {
    const valid = new Set<string>((await sql`SELECT name FROM products WHERE is_active`).map((p) => p.name as string));
    if (f.interests.some((name) => !valid.has(name))) return "Prodotto non valido";
    f.interests = [...new Set(f.interests)];
  }
  return f;
}

// Calcola la posizione del cliente dall'indirizzo (se fallisce, il cliente resta senza pin)
async function placeOnMap(id: string, f: { address: string | null; city: string | null; province: string | null }) {
  await sql`UPDATE customers SET latitude = NULL, longitude = NULL, geocode_failed = false WHERE id = ${id}`;
  if (!f.address) return;
  const point = await geocode(f.address, f.city, f.province);
  if (point) await sql`UPDATE customers SET latitude = ${point.lat}, longitude = ${point.lng} WHERE id = ${id}`;
  else await sql`UPDATE customers SET geocode_failed = true WHERE id = ${id}`;
}

// Altri agenti che vedono il cliente (solo chi puo' modificare tutti i clienti li assegna)
async function setSharedAgents(customerId: string, input: unknown, responsibleId: string, actorId: string): Promise<boolean> {
  const wanted = Array.isArray(input) ? [...new Set(input.map(String))].filter((id) => UUID_RE.test(id) && id !== responsibleId) : [];
  const valid = wanted.length
    ? (await sql`SELECT id::text AS id FROM users WHERE status = 'attivo' AND id = ANY(${wanted}::uuid[])`).map((r) => r.id as string)
    : [];
  await sql`
    WITH removed AS (DELETE FROM customer_agents WHERE customer_id = ${customerId})
    INSERT INTO customer_agents (customer_id, agent_id, added_by)
    SELECT ${customerId}::uuid, a, ${actorId}::uuid FROM unnest(${valid}::uuid[]) AS t(a)`;
  return true;
}

// Aggiunge agenti al cliente SENZA togliere quelli gia' presenti (per chi non puo' modificare tutti i clienti)
async function addSharedAgents(customerId: string, input: unknown, responsibleId: string, actorId: string): Promise<string[]> {
  const wanted = Array.isArray(input) ? [...new Set(input.map(String))].filter((id) => UUID_RE.test(id) && id !== responsibleId) : [];
  if (wanted.length === 0) return [];
  const rows = await sql`
    INSERT INTO customer_agents (customer_id, agent_id, added_by)
    SELECT ${customerId}::uuid, u.id, ${actorId}::uuid FROM users u
    WHERE u.status = 'attivo' AND u.id = ANY(${wanted}::uuid[])
      AND NOT EXISTS (SELECT 1 FROM customer_agents x WHERE x.customer_id = ${customerId}::uuid AND x.agent_id = u.id)
    RETURNING agent_id::text AS agent_id`;
  return rows.map((r) => r.agent_id as string);
}

const canAddAgents = (user: { permissions: string[] }) =>
  user.permissions.includes("customers.edit_all") || user.permissions.includes("customers.add_agents");

// Promemoria automatico "Aggiornamento tariffe" a 11 mesi, alle 9:00 italiane
async function createRateReminder(customerId: string, agentId: string, name: string, actorId: string) {
  const today = todayInRome();
  const target = addMonths(today.y, today.m, today.d, 11);
  const start = romeLocalToUtc(target.y, target.m, target.d, 9, 0);
  const end = new Date(start.getTime() + 30 * 60000);
  await sql`
    INSERT INTO calendar_events (agent_id, customer_id, title, starts_at, ends_at, notes, created_by)
    VALUES (${agentId}, ${customerId}, ${`Aggiornamento tariffe ${name}`}, ${start.toISOString()}::timestamptz,
            ${end.toISOString()}::timestamptz, 'Promemoria automatico creato insieme al cliente (11 mesi)', ${actorId})`;
  const label = `${String(target.d).padStart(2, "0")}/${String(target.m).padStart(2, "0")}/${target.y}`;
  await addHistory(customerId, actorId, "promemoria_creato", `Promemoria «Aggiornamento tariffe» fissato per il ${label}`);
}

async function phoneTaken(phone: string | null, exceptId: string | null): Promise<boolean> {
  if (!phone) return false;
  const digits = phone.replace(/\D/g, "");
  const rows = await sql`
    SELECT 1 FROM customers
    WHERE regexp_replace(coalesce(phone, ''), '\\D', '', 'g') = ${digits}
      AND (${exceptId}::uuid IS NULL OR id <> ${exceptId}::uuid)
    LIMIT 1`;
  return rows.length > 0;
}

async function resolveAgent(
  body: Record<string, any>,
  user: { id: string; permissions: string[] },
  fallback: string,
): Promise<string | null> {
  const requested = String(body.agent_id ?? "").trim();
  if (!requested || requested === fallback) return fallback;
  if (!user.permissions.includes("customers.edit_all")) return fallback; // un agente non assegna ad altri
  if (!UUID_RE.test(requested)) return null;
  const rows = await sql`SELECT 1 FROM users WHERE id = ${requested} AND status = 'attivo'`;
  return rows.length > 0 ? requested : null;
}

// Azioni sui clienti: create | update | set_status | add_note | add_agents
export const handler = route("POST", async (event) => {
  const auth = await requireUser(event, ["customers.create", "customers.edit_all", "customers.edit_own", "customers.view_own", "customers.view_all"]);
  if ("response" in auth) return auth.response;
  const { user } = auth;

  const body = parseBody(event);
  const action = String(body.action ?? "");

  /* ----- NUOVO CLIENTE ----- */
  if (action === "create") {
    if (!user.permissions.includes("customers.create")) {
      return json(403, { error: "Non hai il permesso per creare clienti" });
    }
    const f = await readFields(body);
    if (typeof f === "string") return json(400, { error: f });

    const agentId = await resolveAgent(body, user, user.id);
    if (!agentId) return json(400, { error: "Agente non valido" });
    if (await phoneTaken(f.phone, null)) {
      return json(409, { error: "Questo numero di telefono e' gia' presente nel CRM" });
    }

    const rows = await sql`
      INSERT INTO customers (first_name, last_name, fiscal_code, phone, email, address, city, province,
                             interests, status, agent_id, office_id, created_by)
      VALUES (${f.first_name}, ${f.last_name}, ${f.fiscal_code}, ${f.phone}, ${f.email}, ${f.address}, ${f.city},
              ${f.province}, ${f.interests}::text[], ${f.status}::customer_status, ${agentId},
              (SELECT office_id FROM users WHERE id = ${agentId}), ${user.id})
      RETURNING id`;
    const id = rows[0].id as string;
    await placeOnMap(id, f);
    if (user.permissions.includes("customers.edit_all")) {
      await setSharedAgents(id, body.shared_agent_ids, agentId, user.id);
    } else if (user.permissions.includes("customers.add_agents")) {
      await addSharedAgents(id, body.shared_agent_ids, agentId, user.id);
    }
    if (body.reminder_11m === true) {
      await createRateReminder(id, agentId, `${f.first_name} ${f.last_name}`, user.id);
    }

    await addHistory(id, user.id, "cliente_creato", "Cliente creato");
    const note = String(body.notes ?? "").trim();
    if (note) {
      await sql`INSERT INTO customer_notes (customer_id, author_id, body) VALUES (${id}, ${user.id}, ${note.slice(0, 2000)})`;
      await addHistory(id, user.id, "nota_aggiunta", "Nota aggiunta");
    }
    await logAudit(user.id, "cliente_creato", "customers", id, { name: `${f.first_name} ${f.last_name}` });
    return json(200, { id });
  }

  const id = String(body.id ?? "");
  if (!UUID_RE.test(id)) return json(400, { error: "Cliente non valido" });
  const current = (
    await sql`SELECT customers.*, (SELECT coalesce(array_agg(agent_id::text), '{}') FROM customer_agents WHERE customer_id = customers.id) AS shared_ids FROM customers WHERE id = ${id}`
  )[0];
  if (!current || !canViewCustomer(user, current.agent_id, current.shared_ids)) {
    return json(404, { error: "Cliente non trovato" });
  }

  /* ----- NOTA ----- */
  if (action === "add_note") {
    const text = String(body.body ?? "").trim();
    if (!text) return json(400, { error: "Scrivi il testo della nota" });
    await sql`INSERT INTO customer_notes (customer_id, author_id, body) VALUES (${id}, ${user.id}, ${text.slice(0, 2000)})`;
    await addHistory(id, user.id, "nota_aggiunta", "Nota aggiunta");
    await logAudit(user.id, "nota_aggiunta", "customers", id);
    return json(200, { ok: true });
  }

  /* ----- AGGIUNGE AGENTI (anche trainer e agenti: solo aggiunta, mai rimozione) ----- */
  if (action === "add_agents") {
    if (!canAddAgents(user)) return json(403, { error: "Non hai il permesso per aggiungere agenti a un cliente" });
    const added = await addSharedAgents(id, body.agent_ids, current.agent_id, user.id);
    if (added.length > 0) {
      const names = await sql`SELECT first_name, last_name FROM users WHERE id = ANY(${added}::uuid[]) ORDER BY first_name`;
      await addHistory(id, user.id, "agenti_modificati", `Agenti aggiunti al cliente: ${names.map((n) => `${n.first_name} ${n.last_name}`).join(", ")}`);
      await logAudit(user.id, "agenti_aggiunti_cliente", "customers", id, { added });
    }
    return json(200, { ok: true, added: added.length });
  }

  if (!canEditCustomer(user, current.agent_id, current.shared_ids)) {
    return json(403, { error: "Non puoi modificare questo cliente" });
  }

  /* ----- CAMBIO STATO RAPIDO ----- */
  if (action === "set_status") {
    const status = String(body.status ?? "");
    if (!STATUSES.includes(status)) return json(400, { error: "Stato non valido" });
    if (status !== current.status) {
      await sql`UPDATE customers SET status = ${status}::customer_status WHERE id = ${id}`;
      await addHistory(id, user.id, "stato_cambiato", `Stato cambiato da ${current.status} a ${status}`);
      await logAudit(user.id, "stato_cliente_cambiato", "customers", id, { from: current.status, to: status });
    }
    return json(200, { ok: true });
  }

  /* ----- MODIFICA ----- */
  if (action === "update") {
    const f = await readFields(body);
    if (typeof f === "string") return json(400, { error: f });
    const agentId = await resolveAgent(body, user, current.agent_id);
    if (!agentId) return json(400, { error: "Agente non valido" });
    if (await phoneTaken(f.phone, id)) {
      return json(409, { error: "Questo numero di telefono e' gia' presente nel CRM" });
    }

    const changed = (Object.keys(LABELS) as (keyof Fields)[]).filter((key) => {
      const before = key === "interests" ? [...(current.interests ?? [])].sort().join("|") : (current[key] ?? null);
      const after = key === "interests" ? [...f.interests].sort().join("|") : f[key];
      return before !== after;
    });

    await sql`
      UPDATE customers SET first_name = ${f.first_name}, last_name = ${f.last_name}, fiscal_code = ${f.fiscal_code}, phone = ${f.phone},
             email = ${f.email}, address = ${f.address}, city = ${f.city}, province = ${f.province},
             interests = ${f.interests}::text[], status = ${f.status}::customer_status, agent_id = ${agentId}
      WHERE id = ${id}`;

    if (user.permissions.includes("customers.edit_all") && Array.isArray(body.shared_agent_ids)) {
      const before = [...(current.shared_ids ?? [])].sort().join("|");
      const after = [...new Set(body.shared_agent_ids.map(String))].filter((x) => x !== agentId).sort().join("|");
      if (before !== after) {
        await setSharedAgents(id, body.shared_agent_ids, agentId, user.id);
        await addHistory(id, user.id, "agenti_modificati", "Agenti con accesso al cliente modificati");
      }
    }
    else if (user.permissions.includes("customers.add_agents") && Array.isArray(body.shared_agent_ids)) {
      const added = await addSharedAgents(id, body.shared_agent_ids, agentId, user.id);
      if (added.length > 0) await addHistory(id, user.id, "agenti_modificati", "Agenti aggiunti al cliente");
    }
    if (changed.some((key) => key === "address" || key === "city" || key === "province")) {
      await placeOnMap(id, f);
    }
    if (changed.length > 0) {
      await addHistory(id, user.id, "cliente_modificato", `Dati modificati: ${changed.map((k) => LABELS[k]).join(", ")}`);
    }
    if (f.status !== current.status) {
      await addHistory(id, user.id, "stato_cambiato", `Stato cambiato da ${current.status} a ${f.status}`);
    }
    if (agentId !== current.agent_id) {
      const names = await sql`SELECT id, first_name FROM users WHERE id IN (${current.agent_id}, ${agentId})`;
      const nameOf = (uid: string | null) => names.find((n) => n.id === uid)?.first_name ?? "—";
      await addHistory(id, user.id, "agente_cambiato", `Agente responsabile: ${nameOf(current.agent_id)} → ${nameOf(agentId)}`);
    }
    await logAudit(user.id, "cliente_modificato", "customers", id, { changed });
    return json(200, { ok: true });
  }

  return json(400, { error: "Azione non valida" });
});
