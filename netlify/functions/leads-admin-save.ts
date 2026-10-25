import { json, logAudit, parseBody, requireUser, route, sql } from "./_shared/auth";
import { UUID_RE } from "./_shared/customers";
import {
  PURGE_HOURS,
  cleanFiscal,
  cleanNotes,
  cleanPhone,
  cleanStreetType,
  cleanText,
  normSector,
  phoneKey,
  purgeLeads,
} from "./_shared/leads";

const MAX_ROWS_PER_CALL = 1000;

// Azioni: create_list | add_rows | assign | unassign | close_session | reopen_session
//         | purge_now | delete_list | delete_wrong
export const handler = route("POST", async (event) => {
  const auth = await requireUser(event, ["leads.manage"]);
  if ("response" in auth) return auth.response;
  const { user } = auth;

  const body = parseBody(event);
  const action = String(body.action ?? "");
  const listId = body.list_id ? String(body.list_id) : null;
  if (listId && !UUID_RE.test(listId)) return json(400, { error: "Lista non valida" });

  const listExists = async (id: string) =>
    (await sql`SELECT id, name, anonymized_at FROM lead_lists WHERE id = ${id}`)[0];

  /* ----- NUOVA LISTA ----- */
  if (action === "create_list") {
    const name = cleanText(body.name, 120);
    if (!name) return json(400, { error: "Scrivi un nome per la lista" });
    const rows = await sql`
      INSERT INTO lead_lists (name, source_filename, uploaded_by)
      VALUES (${name}, ${cleanText(body.filename, 200)}, ${user.id}) RETURNING id`;
    await logAudit(user.id, "lead_lista_creata", "lead_lists", rows[0].id, { name });
    return json(200, { id: rows[0].id });
  }

  /* ----- AGGIUNGE RIGHE (a blocchi) ----- */
  if (action === "add_rows") {
    if (!listId) return json(400, { error: "Lista mancante" });
    const list = await listExists(listId);
    if (!list) return json(404, { error: "Lista non trovata" });
    if (list.anonymized_at) return json(400, { error: "La lista e' gia' stata ripulita" });
    const incoming = Array.isArray(body.rows) ? body.rows.slice(0, MAX_ROWS_PER_CALL) : [];

    // numeri gia' presenti nella lista (per evitare doppioni)
    const existing = await sql`SELECT phone FROM leads WHERE list_id = ${listId} AND phone IS NOT NULL`;
    const seen = new Set<string>(existing.map((r) => phoneKey(r.phone as string)));

    const clean: Record<string, string | null>[] = [];
    let noPhone = 0;
    let duplicates = 0;
    for (const raw of incoming) {
      const phone = cleanPhone(raw?.phone);
      if (!phone) {
        noPhone++;
        continue;
      }
      const key = phoneKey(phone);
      if (seen.has(key)) {
        duplicates++;
        continue;
      }
      seen.add(key);
      clean.push({
        first_name: cleanText(raw.first_name, 80),
        last_name: cleanText(raw.last_name, 80),
        phone,
        phone2: cleanPhone(raw.phone2),
        address: cleanText(raw.address, 200),
        house_number: cleanText(raw.house_number, 20),
        street_type: cleanStreetType(raw.street_type),
        fiscal_code: cleanFiscal(raw.fiscal_code) ?? null,
        provider: cleanText(raw.provider, 80),
        city: cleanText(raw.city, 80),
        province: cleanText(raw.province, 4)?.toUpperCase() ?? null,
        sector: normSector(raw.sector),
        notes: cleanNotes(raw.notes),
      });
    }

    if (clean.length > 0) {
      await sql`
        INSERT INTO leads (list_id, first_name, last_name, phone, phone2, address, house_number, street_type, fiscal_code, provider, city, province, sector, notes)
        SELECT ${listId}::uuid, r.first_name, r.last_name, r.phone, r.phone2, r.address, r.house_number, r.street_type, r.fiscal_code, r.provider, r.city, r.province, r.sector, r.notes
        FROM jsonb_to_recordset(${JSON.stringify(clean)}::jsonb) AS r(
          first_name text, last_name text, phone text, phone2 text, address text, house_number text, street_type text, fiscal_code text, provider text, city text, province text, sector text, notes text)`;
    }
    return json(200, { inserted: clean.length, no_phone: noPhone, duplicates });
  }

  /* ----- ASSEGNAZIONE ----- */
  if (action === "assign") {
    const mode = String(body.mode ?? "");
    const agentIds: string[] = Array.isArray(body.agent_ids) ? body.agent_ids.map(String) : [];
    if (agentIds.length === 0 || agentIds.some((id) => !UUID_RE.test(id)))
      return json(400, { error: "Scegli almeno un agente" });
    if (mode !== "round_robin" && mode !== "manual") return json(400, { error: "Modalita' non valida" });
    if (mode === "manual" && agentIds.length !== 1) return json(400, { error: "Per l'assegnazione manuale scegli un solo agente" });

    const valid = await sql`
      SELECT id FROM users WHERE status = 'attivo' AND id = ANY(${agentIds}::uuid[])`;
    if (valid.length !== new Set(agentIds).size) return json(400, { error: "Uno degli agenti non e' attivo" });

    const city = cleanText(body.city, 80);
    const sector = cleanText(body.sector, 40);
    const wanted = Number(body.count);
    const limit = Number.isFinite(wanted) && wanted > 0 ? Math.min(Math.floor(wanted), 50000) : 50000;
    const n = agentIds.length;

    const rows = await sql`
      WITH pick AS (
        SELECT id, row_number() OVER (ORDER BY lower(coalesce(city, '')), id) - 1 AS rn
        FROM leads
        WHERE assigned_to IS NULL AND anonymized_at IS NULL AND outcome = 'nuovo'
          AND (${listId}::uuid IS NULL OR list_id = ${listId}::uuid)
          AND (${city}::text IS NULL OR lower(city) = lower(${city}::text))
          AND (${sector}::text IS NULL OR sector = ${sector}::text)
        ORDER BY lower(coalesce(city, '')), id
        LIMIT ${limit}
      )
      UPDATE leads l
      SET assigned_to = (${agentIds}::uuid[])[((p.rn % ${n}::int) + 1)::int], assigned_at = now()
      FROM pick p WHERE l.id = p.id
      RETURNING l.assigned_to`;
    const perAgent: Record<string, number> = {};
    for (const r of rows) perAgent[r.assigned_to as string] = (perAgent[r.assigned_to as string] ?? 0) + 1;
    await logAudit(user.id, "lead_assegnati", "leads", null, { mode, total: rows.length, city, sector, perAgent });
    return json(200, { assigned: rows.length, per_agent: perAgent });
  }

  /* ----- RIPRENDE I LEAD NON ANCORA LAVORATI DI UN AGENTE ----- */
  if (action === "unassign") {
    const agentId = String(body.agent_id ?? "");
    if (!UUID_RE.test(agentId)) return json(400, { error: "Agente non valido" });
    const rows = await sql`
      UPDATE leads SET assigned_to = NULL, assigned_at = NULL
      WHERE assigned_to = ${agentId}::uuid AND outcome = 'nuovo' AND anonymized_at IS NULL
        AND (${listId}::uuid IS NULL OR list_id = ${listId}::uuid)
      RETURNING id`;
    await logAudit(user.id, "lead_ripresi", "leads", null, { agent_id: agentId, total: rows.length });
    return json(200, { released: rows.length });
  }

  /* ----- CHIUDE / RIAPRE LA SESSIONE ----- */
  if (action === "close_session" || action === "reopen_session") {
    if (!listId) return json(400, { error: "Lista mancante" });
    const list = await listExists(listId);
    if (!list) return json(404, { error: "Lista non trovata" });
    if (list.anonymized_at) return json(400, { error: "La lista e' gia' stata ripulita" });
    if (action === "close_session") {
      await sql`
        UPDATE lead_lists
        SET session_closed_at = now(), purge_after = now() + (${PURGE_HOURS}::int * interval '1 hour')
        WHERE id = ${listId}`;
    } else {
      await sql`UPDATE lead_lists SET session_closed_at = NULL, purge_after = NULL WHERE id = ${listId}`;
    }
    await logAudit(user.id, action === "close_session" ? "lead_sessione_chiusa" : "lead_sessione_riaperta", "lead_lists", listId, {
      name: list.name,
    });
    return json(200, { ok: true });
  }

  /* ----- RIPULISCE SUBITO (anonimizza) ----- */
  if (action === "purge_now") {
    if (!listId) return json(400, { error: "Lista mancante" });
    if (!(await listExists(listId))) return json(404, { error: "Lista non trovata" });
    const n = await purgeLeads(listId);
    await logAudit(user.id, "lead_lista_anonimizzata", "lead_lists", listId, { leads: n });
    return json(200, { anonymized: n });
  }

  /* ----- ELIMINA LA LISTA ----- */
  if (action === "delete_list") {
    if (!listId) return json(400, { error: "Lista mancante" });
    const list = await listExists(listId);
    if (!list) return json(404, { error: "Lista non trovata" });
    await sql`DELETE FROM lead_lists WHERE id = ${listId}`;
    await logAudit(user.id, "lead_lista_eliminata", "lead_lists", listId, { name: list.name });
    return json(200, { ok: true });
  }

  /* ----- ELIMINA I NUMERI SEGNALATI COME ERRATI ----- */
  if (action === "delete_wrong") {
    const rows = await sql`
      DELETE FROM leads
      WHERE wrong_number = true AND anonymized_at IS NULL
        AND (${listId}::uuid IS NULL OR list_id = ${listId}::uuid)
      RETURNING id`;
    await logAudit(user.id, "lead_numeri_errati_eliminati", "leads", null, { total: rows.length, list_id: listId });
    return json(200, { deleted: rows.length });
  }

  return json(400, { error: "Azione non valida" });
});
