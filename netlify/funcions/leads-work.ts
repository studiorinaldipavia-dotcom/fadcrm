import { json, logAudit, parseBody, requireUser, route, sql } from "./_shared/auth";
import { addHistory, UUID_RE } from "./_shared/customers";
import { notify } from "./_shared/notifications";
import {
  AGENT_OUTCOMES,
  RETRY_MINUTES,
  getCallWindow,
  cleanFiscal,
  streetTypeName,
  cleanNotes,
  cleanPhone,
  cleanStreetType,
  cleanText,
  normSector,
  productForSector,
} from "./_shared/leads";

const stamp = () =>
  `[${new Date().toLocaleString("it-IT", {
    timeZone: "Europe/Rome",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  })}] `;

const EDITABLE = ["first_name", "last_name", "phone", "phone2", "address", "house_number", "street_type", "city", "fiscal_code", "provider", "notes", "sector"] as const;
/** Campi che non contano come "correzione dati" nel report admin */
const SOFT_FIELDS = ["notes", "provider"];

const validDate = (raw: unknown, pastMs = 24 * 3600 * 1000, futureDays = 400): Date | null => {
  const d = new Date(String(raw ?? ""));
  const t = d.getTime();
  if (isNaN(t) || t < Date.now() - pastMs || t > Date.now() + futureDays * 86400000) return null;
  return d;
};

/** Valida i campi anagrafici ricevuti. Ritorna i valori puliti oppure un messaggio di errore. */
function readFields(body: Record<string, any>): { fields: Record<string, string | null> } | { error: string } {
  const out: Record<string, string | null> = {};
  for (const field of EDITABLE) {
    if (!(field in body)) continue;
    if (field === "phone") {
      const phone = cleanPhone(body.phone);
      if (!phone) return { error: "Numero di telefono non valido" };
      out.phone = phone;
    } else if (field === "phone2") {
      // secondo numero facoltativo: vuoto = nessun secondo numero
      if (!String(body.phone2 ?? "").trim()) out.phone2 = null;
      else {
        const phone2 = cleanPhone(body.phone2);
        if (!phone2) return { error: "Secondo numero di telefono non valido" };
        out.phone2 = phone2;
      }
    } else if (field === "fiscal_code") {
      const cf = cleanFiscal(body.fiscal_code);
      if (cf === undefined) return { error: "Codice fiscale non valido (11-16 caratteri)" };
      out.fiscal_code = cf;
    } else if (field === "street_type") {
      out.street_type = cleanStreetType(body.street_type);
    } else if (field === "notes") {
      out.notes = cleanNotes(body.notes, 2000);
    } else if (field === "sector") {
      out.sector = normSector(body.sector);
    } else {
      out[field] = cleanText(body[field], field === "address" ? 200 : field === "house_number" ? 20 : 80);
    }
  }
  return { fields: out };
}

const publicLead = (l: Record<string, any>) => ({
  id: l.id,
  first_name: l.first_name,
  last_name: l.last_name,
  phone: l.phone,
  phone2: l.phone2,
  address: l.address,
  house_number: l.house_number,
  street_type: l.street_type,
  provider: l.provider,
  notes: l.notes,
  city: l.city,
  fiscal_code: l.fiscal_code,
  sector: l.sector,
});

const streetLine = (l: Record<string, any>) =>
  [streetTypeName(l.street_type), l.address, l.house_number].filter(Boolean).join(" ");
const placeOf = (l: Record<string, any>) => [streetLine(l), l.city].filter(Boolean).join(", ");

// Azioni dell'agente sui lead assegnati a lui:
// dial | outcome | edit | wrong_number | undo | appointment_result | agenda_create | agenda_update | agenda_delete
export const handler = route("POST", async (event) => {
  const auth = await requireUser(event, ["leads.work"]);
  if ("response" in auth) return auth.response;
  const { user } = auth;

  const body = parseBody(event);
  const action = String(body.action ?? "");

  /* ----- AGENDA: NUOVO APPUNTAMENTO INSERITO A MANO ----- */
  if (action === "agenda_create") {
    const read = readFields(body);
    if ("error" in read) return json(400, { error: read.error });
    const f = read.fields;
    if (!f.first_name && !f.last_name) return json(400, { error: "Scrivi nome o cognome del contatto" });
    const when = validDate(body.appointment_at);
    if (!when) return json(400, { error: "Scegli data e ora valide per l'appuntamento" });

    let list = (await sql`SELECT id FROM lead_lists WHERE is_manual = true LIMIT 1`)[0];
    if (!list) list = (await sql`INSERT INTO lead_lists (name, is_manual, uploaded_by) VALUES ('Inseriti a mano', true, ${user.id}::uuid) RETURNING id`)[0];

    const l = { ...f };
    const name = [l.first_name, l.last_name].filter(Boolean).join(" ");
    const note = cleanNotes(body.note, 500);
    const ev = await sql`
      INSERT INTO calendar_events (agent_id, title, starts_at, notes, created_by)
      VALUES (${user.id}::uuid, ${`Lead: ${name}`.slice(0, 120)}, ${when.toISOString()}::timestamptz,
              ${[l.sector, l.phone, placeOf(l)].filter(Boolean).join(" · ").slice(0, 1000) || null}, ${user.id}::uuid)
      RETURNING id`;
    const rows = await sql`
      INSERT INTO leads (list_id, first_name, last_name, phone, phone2, address, house_number, street_type, provider, city, fiscal_code, sector, notes,
                         assigned_to, assigned_at, outcome, outcome_at, appointment_at, appointment_result, calendar_event_id)
      VALUES (${list.id}::uuid, ${l.first_name ?? null}, ${l.last_name ?? null}, ${l.phone ?? null}, ${l.phone2 ?? null}, ${l.address ?? null},
              ${l.house_number ?? null}, ${l.street_type ?? null}, ${l.provider ?? null}, ${l.city ?? null}, ${l.fiscal_code ?? null}, ${l.sector ?? null},
              ${note ? stamp() + note : null}, ${user.id}::uuid, now(), 'appuntamento', now(),
              ${when.toISOString()}::timestamptz, 'in_attesa', ${ev[0].id}::uuid)
      RETURNING id`;
    await sql`INSERT INTO lead_events (lead_id, list_id, agent_id, kind, outcome, sector)
              VALUES (${rows[0].id}::uuid, ${list.id}::uuid, ${user.id}::uuid, 'outcome', 'appuntamento', ${l.sector ?? null})`;
    await logAudit(user.id, "appuntamento_lead_manuale", "leads", rows[0].id, {});
    return json(200, { ok: true, id: rows[0].id });
  }

  const id = String(body.id ?? "");
  if (!UUID_RE.test(id)) return json(400, { error: "Lead non valido" });

  // un agente puo' toccare solo i lead assegnati a lui. Unica eccezione: un appuntamento condiviso con lui
  // si puo' ESITARE e RICONDIVIDERE (ma non modificare ne' eliminare).
  const sharedOk = action === "share" || action === "appointment_result";
  const lead = (await sql`
    SELECT l.*, coalesce(ll.is_manual, false) AS is_manual, (l.assigned_to = ${user.id}::uuid) AS is_owner
    FROM leads l JOIN lead_lists ll ON ll.id = l.list_id
    WHERE l.id = ${id}::uuid AND l.anonymized_at IS NULL
      AND (l.assigned_to = ${user.id}::uuid
           OR (${sharedOk}::boolean AND EXISTS (SELECT 1 FROM lead_shares s WHERE s.lead_id = l.id AND s.user_id = ${user.id}::uuid)))`)[0];
  if (!lead) return json(404, { error: "Lead non trovato" });

  const logEvent = (kind: string, outcome: string | null) =>
    sql`INSERT INTO lead_events (lead_id, list_id, agent_id, kind, outcome, sector)
        VALUES (${lead.id}::uuid, ${lead.list_id}::uuid, ${user.id}::uuid, ${kind}, ${outcome}, ${lead.sector})`;

  const fullName = [lead.first_name, lead.last_name].filter(Boolean).join(" ") || "Contatto";
  const details = () => [lead.sector, lead.phone, placeOf(lead)].filter(Boolean).join(" · ").slice(0, 1000) || null;
  const dropEvent = async () => {
    if (lead.calendar_event_id) await sql`DELETE FROM calendar_events WHERE id = ${lead.calendar_event_id}::uuid`;
  };
  const makeEvent = async (title: string, when: Date) =>
    (
      await sql`
      INSERT INTO calendar_events (agent_id, title, starts_at, notes, created_by)
      VALUES (${user.id}::uuid, ${title.slice(0, 120)}, ${when.toISOString()}::timestamptz, ${details()}, ${user.id}::uuid)
      RETURNING id`
    )[0].id as string;

  // crea il cliente nel CRM a partire dal lead (contratto concluso); "agentId" e' l'agente responsabile
  const createCustomerFromLead = async (agentId: string, creatorId: string): Promise<string> => {
    const rows = await sql`
      INSERT INTO customers (first_name, last_name, fiscal_code, phone, address, city, province, interests, status,
                             agent_id, office_id, created_by)
      VALUES (${lead.first_name ?? "-"}, ${lead.last_name ?? "-"}, ${lead.fiscal_code}, ${lead.phone},
              ${streetLine(lead) || null}, ${lead.city},
              ${lead.province}, ${productForSector(lead.sector)}::text[], 'OK'::customer_status,
              ${agentId}::uuid, (SELECT office_id FROM users WHERE id = ${agentId}::uuid), ${creatorId}::uuid)
      RETURNING id`;
    const customerId = rows[0].id as string;
    await addHistory(customerId, creatorId, "cliente_creato", `Cliente creato da LeadHub${lead.sector ? ` (${lead.sector})` : ""}`);
    await logAudit(creatorId, "cliente_creato_da_lead", "customers", customerId, { lead_id: id });
    return customerId;
  };

  // chiamare e dare un esito e' possibile solo quando la Call Mode e' attiva
  if (["dial", "outcome", "wrong_number"].includes(action)) {
    const w = await getCallWindow();
    if (!w.active) return json(403, { error: `La Call Mode non è attiva: si lavora dalle ${w.start} alle ${w.end}` });
  }

  /* ----- CONDIVIDI L'APPUNTAMENTO CON ALTRI AGENTI ----- */
  if (action === "share") {
    // si possono condividere solo colleghi diversi da te e dall'agente che ha creato l'appuntamento
    const wanted: string[] = Array.isArray(body.user_ids)
      ? body.user_ids.map(String).filter((x) => UUID_RE.test(x) && x !== user.id && x !== lead.assigned_to)
      : [];
    if (lead.outcome !== "appuntamento" && lead.outcome !== "da_ricontattare")
      return json(409, { error: "Si può condividere solo un appuntamento o un richiamo" });
    const valid = wanted.length
      ? await sql`
          SELECT u.id FROM users u
          WHERE u.status = 'attivo' AND u.id = ANY(${wanted}::uuid[]) AND (
            EXISTS (SELECT 1 FROM user_permissions up WHERE up.user_id = u.id AND up.permission_key = 'leads.work' AND up.granted)
            OR (EXISTS (SELECT 1 FROM role_permissions rp WHERE rp.role = u.role AND rp.permission_key = 'leads.work')
                AND NOT EXISTS (SELECT 1 FROM user_permissions up WHERE up.user_id = u.id AND up.permission_key = 'leads.work' AND NOT up.granted)))`
      : [];
    const ids = valid.map((r) => r.id as string);
    const before = new Set((await sql`SELECT user_id FROM lead_shares WHERE lead_id = ${id}::uuid`).map((r) => r.user_id as string));
    // ognuno gestisce SOLO le condivisioni fatte da lui (chi ricondivide non toglie quelle degli altri)
    await sql.transaction([
      sql`DELETE FROM lead_shares WHERE lead_id = ${id}::uuid AND (shared_by = ${user.id}::uuid OR (${lead.is_owner}::boolean AND shared_by IS NULL))
            AND NOT (user_id = ANY(${ids}::uuid[]))`,
      sql`INSERT INTO lead_shares (lead_id, user_id, shared_by)
          SELECT ${id}::uuid, k, ${user.id}::uuid FROM unnest(${ids}::uuid[]) AS k
          ON CONFLICT DO NOTHING`,
    ]);
    await logAudit(user.id, "appuntamento_lead_condiviso", "leads", id, { con: ids.length, ricondiviso: !lead.is_owner });
    // chi ha appena ricevuto la condivisione riceve la notifica (senza dati personali del cliente)
    const owner = (await sql`SELECT first_name, last_name FROM users WHERE id = ${lead.assigned_to}::uuid`)[0];
    const when = lead.appointment_at ?? lead.callback_at;
    await notify(ids.filter((u) => !before.has(u)), {
      kind: "shared_appointment",
      title: "Appuntamento condiviso con te",
      body: `Da ${user.first_name} ${user.last_name}${lead.is_owner || !owner ? "" : " · appuntamento di " + owner.first_name + " " + owner.last_name}${when ? " · " + new Date(when).toLocaleString("it-IT", { timeZone: "Europe/Rome", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : ""}`,
      link: "Agenda lead",
      ref: `shared:${id}:${Date.now()}`,
    });
    return json(200, { ok: true, shared: ids.length });
  }

  /* ----- TOCCO SU "CHIAMA ORA" ----- */
  if (action === "dial") {
    await sql`UPDATE leads SET called_at = now(), call_count = call_count + 1 WHERE id = ${id}::uuid`;
    await logEvent("dial", null);
    return json(200, { ok: true });
  }

  /* ----- ESITO A UN TOCCO ----- */
  if (action === "outcome") {
    const outcome = String(body.outcome ?? "");
    if (!(AGENT_OUTCOMES as readonly string[]).includes(outcome)) return json(400, { error: "Esito non valido" });
    if (lead.customer_id || lead.appointment_result === "contratto_chiuso")
      return json(409, { error: "Per questo contatto il contratto è già chiuso" });

    const note = cleanNotes(body.note, 500);
    let callbackAt: Date | null = null;
    let appointmentAt: Date | null = null;

    if (outcome === "appuntamento") {
      appointmentAt = validDate(body.appointment_at);
      if (!appointmentAt) return json(400, { error: "Scegli data e ora valide per l'appuntamento" });
    } else if (outcome === "da_ricontattare") {
      // "fra un'ora" (default) oppure giorno e ora scelti dall'agente
      callbackAt = validDate(body.callback_at, 60000, 120) ?? new Date(Date.now() + RETRY_MINUTES * 60000);
    }
    // "Segreteria/NR" e "Non interessato": nessun orario. La segreteria va in fondo alla lista.

    await dropEvent(); // se il contatto aveva gia' un appuntamento/richiamo, il vecchio evento sparisce
    let calendarId: string | null = null;
    if (appointmentAt) calendarId = await makeEvent(`Lead: ${fullName}`, appointmentAt);
    else if (callbackAt) calendarId = await makeEvent(`Richiamo: ${fullName}`, callbackAt);

    await sql`
      UPDATE leads SET
        outcome = ${outcome}::lead_outcome, outcome_at = now(), wrong_number = false,
        callback_at = ${callbackAt ? callbackAt.toISOString() : null}::timestamptz,
        appointment_at = ${appointmentAt ? appointmentAt.toISOString() : null}::timestamptz,
        appointment_result = ${appointmentAt ? "in_attesa" : null}::lead_appointment_result,
        appointment_closed_at = NULL, appointment_result_by = NULL,
        calendar_event_id = ${calendarId}::uuid,
        called_at = coalesce(called_at, now()),
        notes = CASE WHEN ${note}::text IS NULL THEN notes
                     ELSE left(coalesce(notes || E'\n', '') || ${stamp()}::text || ${note}::text, 2000) END
      WHERE id = ${id}::uuid`;
    await logEvent("outcome", outcome);
    return json(200, { ok: true, callback_at: callbackAt?.toISOString() ?? null });
  }

  /* ----- CORREZIONE DATI AL VOLO ----- */
  if (action === "edit") {
    const read = readFields(body);
    if ("error" in read) return json(400, { error: read.error });
    const incoming = read.fields;
    const changed = Object.keys(incoming).filter((f) => (lead[f] ?? null) !== incoming[f]);
    if (changed.length === 0) return json(200, { ok: true, lead: publicLead(lead) });

    // ricordiamo il valore ORIGINALE (solo la prima volta che un campo viene corretto)
    const tracked = changed.filter((f) => !SOFT_FIELDS.includes(f));
    const orig: Record<string, unknown> = { ...(lead.orig_data ?? {}) };
    for (const f of tracked) if (!(f in orig)) orig[f] = lead[f] ?? null;

    const n = { ...lead, ...incoming };
    await sql`
      UPDATE leads SET first_name = ${n.first_name}, last_name = ${n.last_name}, phone = ${n.phone}, phone2 = ${n.phone2},
             address = ${n.address}, house_number = ${n.house_number}, street_type = ${n.street_type}, city = ${n.city},
             fiscal_code = ${n.fiscal_code}, provider = ${n.provider}, notes = ${n.notes}, sector = ${n.sector},
             orig_data = ${JSON.stringify(orig)}::jsonb,
             corrected_at = CASE WHEN ${tracked.length > 0}::boolean THEN now() ELSE corrected_at END,
             corrected_by = CASE WHEN ${tracked.length > 0}::boolean THEN ${user.id}::uuid ELSE corrected_by END
      WHERE id = ${id}::uuid`;
    await logAudit(user.id, "lead_corretto", "leads", id, { campi: changed });

    // Se durante la chiamata la citta' cambia (la persona vive in un altro paese) il contatto passa in un
    // nuovo "foglio" di contatti aggiunti manualmente per quella citta' (uno per citta', riusato).
    // Resta all'agente che lo sta chiamando; l'amministratore ritrova il foglio tra le liste.
    let movedTo: string | null = null;
    const oldCity = String(lead.city ?? "").trim().toLowerCase();
    const newCity = String(n.city ?? "").trim();
    if (changed.includes("city") && oldCity && newCity && oldCity !== newCity.toLowerCase()) {
      const name = `Aggiunti manualmente – ${newCity}`.slice(0, 120);
      let target = (await sql`SELECT id FROM lead_lists WHERE lower(name) = lower(${name}) AND anonymized_at IS NULL ORDER BY created_at LIMIT 1`)[0];
      if (!target) target = (await sql`INSERT INTO lead_lists (name, uploaded_by) VALUES (${name}, ${user.id}::uuid) RETURNING id`)[0];
      if (target.id !== lead.list_id) {
        await sql`UPDATE leads SET list_id = ${target.id}::uuid WHERE id = ${id}::uuid`;
        await logAudit(user.id, "lead_spostato_foglio_citta", "leads", id, { foglio: name });
        movedTo = name;
      }
    }
    return json(200, { ok: true, lead: publicLead(n), moved_to: movedTo });
  }

  /* ----- INESISTENTE / TRASFERITO - PERSONA SBAGLIATA ----- */
  // Entrambi escono dalla coda e finiscono nel report di pulizia; "persona sbagliata" conta come contatto.
  if (action === "wrong_number") {
    const reason = body.reason === "persona_sbagliata" ? "persona_sbagliata" : "numero_errato";
    await dropEvent();
    await sql`
      UPDATE leads SET wrong_number = true, outcome = ${reason}::lead_outcome, outcome_at = now(), callback_at = NULL,
             appointment_at = NULL, appointment_result = NULL, calendar_event_id = NULL,
             called_at = coalesce(called_at, now())
      WHERE id = ${id}::uuid`;
    await logEvent("outcome", reason);
    return json(200, { ok: true });
  }

  /* ----- ANNULLA L'ULTIMO ESITO (entro 3 minuti) ----- */
  if (action === "undo") {
    const recent = lead.outcome_at && Date.now() - new Date(lead.outcome_at).getTime() < 3 * 60000;
    if (lead.outcome === "nuovo" || !recent || lead.customer_id || lead.appointment_result === "contratto_chiuso")
      return json(409, { error: "Non è più possibile annullare questo esito" });
    await dropEvent();
    await sql`
      UPDATE leads SET outcome = 'nuovo', outcome_at = NULL, callback_at = NULL, appointment_at = NULL,
             appointment_result = NULL, calendar_event_id = NULL, wrong_number = false
      WHERE id = ${id}::uuid`;
    await sql`
      DELETE FROM lead_events WHERE id = (
        SELECT id FROM lead_events WHERE lead_id = ${id}::uuid AND kind = 'outcome' ORDER BY created_at DESC LIMIT 1)`;
    return json(200, { ok: true });
  }

  /* ----- AGENDA: MODIFICA (orario e/o dati) ----- */
  if (action === "agenda_update") {
    const read = readFields(body);
    if ("error" in read) return json(400, { error: read.error });
    const n = { ...lead, ...read.fields };
    const isAppt = lead.outcome === "appuntamento" && !lead.customer_id;
    const isCall = lead.outcome === "da_ricontattare";
    if (!isAppt && !isCall) return json(409, { error: "Questo appuntamento non si può più modificare" });

    let when: Date | null = null;
    if (body.when) {
      when = validDate(body.when, 365 * 86400000);
      if (!when) return json(400, { error: "Data o ora non valide" });
    }
    const orig: Record<string, unknown> = { ...(lead.orig_data ?? {}) };
    for (const f of Object.keys(read.fields))
      if (!SOFT_FIELDS.includes(f) && (lead[f] ?? null) !== read.fields[f] && !(f in orig)) orig[f] = lead[f] ?? null;
    const note = cleanNotes(body.note, 500);
    const newName = [n.first_name, n.last_name].filter(Boolean).join(" ") || "Contatto";

    await sql`
      UPDATE leads SET first_name = ${n.first_name}, last_name = ${n.last_name}, phone = ${n.phone}, phone2 = ${n.phone2},
             address = ${n.address}, house_number = ${n.house_number}, street_type = ${n.street_type}, city = ${n.city},
             fiscal_code = ${n.fiscal_code}, provider = ${n.provider}, sector = ${n.sector},
             orig_data = ${JSON.stringify(orig)}::jsonb, corrected_at = now(), corrected_by = ${user.id}::uuid,
             appointment_at = CASE WHEN ${isAppt}::boolean AND ${when ? when.toISOString() : null}::timestamptz IS NOT NULL
                                   THEN ${when ? when.toISOString() : null}::timestamptz ELSE appointment_at END,
             callback_at = CASE WHEN ${isCall}::boolean AND ${when ? when.toISOString() : null}::timestamptz IS NOT NULL
                                THEN ${when ? when.toISOString() : null}::timestamptz ELSE callback_at END,
             notes = CASE WHEN ${note}::text IS NULL THEN notes
                          ELSE left(coalesce(notes || E'\n', '') || ${stamp()}::text || ${note}::text, 2000) END
      WHERE id = ${id}::uuid`;
    if (lead.calendar_event_id) {
      await sql`
        UPDATE calendar_events SET title = ${`${isCall ? "Richiamo" : "Lead"}: ${newName}`.slice(0, 120)},
               starts_at = coalesce(${when ? when.toISOString() : null}::timestamptz, starts_at),
               notes = ${[n.sector, n.phone, placeOf(n)].filter(Boolean).join(" · ").slice(0, 1000) || null}
        WHERE id = ${lead.calendar_event_id}::uuid`;
    }
    await logAudit(user.id, "appuntamento_lead_modificato", "leads", id, {});
    return json(200, { ok: true });
  }

  /* ----- AGENDA: ELIMINA ----- */
  if (action === "agenda_delete") {
    const w = await getCallWindow();
    if (!w.active) return json(403, { error: `Si può eliminare solo durante la Call Mode (${w.start}–${w.end})` });
    if (lead.customer_id || lead.appointment_result === "contratto_chiuso")
      return json(409, { error: "Il contratto è già chiuso: il contatto è ora un cliente" });
    await dropEvent();
    // un appuntamento eliminato non deve contare nelle statistiche
    await sql`DELETE FROM lead_events WHERE lead_id = ${id}::uuid AND kind IN ('outcome', 'appointment_result') AND outcome IN ('appuntamento', 'contratto_chiuso', 'incontrato_con_trattativa', 'incontrato_senza_trattativa')`;
    if (lead.is_manual) {
      await sql`DELETE FROM leads WHERE id = ${id}::uuid`;
    } else {
      // il contatto torna "da chiamare" nella sua lista
      await sql`
        UPDATE leads SET outcome = 'nuovo', outcome_at = NULL, callback_at = NULL, appointment_at = NULL,
               appointment_result = NULL, appointment_closed_at = NULL, calendar_event_id = NULL
        WHERE id = ${id}::uuid`;
    }
    await logAudit(user.id, "appuntamento_lead_eliminato", "leads", id, { manuale: lead.is_manual });
    return json(200, { ok: true });
  }

  /* ----- ESITO DELL'INCONTRO (Agenda) ----- */
  // contratto_chiuso = "Contratto concluso"; poi "Incontrato con/senza trattativa" e "Annullato / non visto" (pacco).
  // Se lo da' un collega con cui l'appuntamento e' condiviso, i numeri vanno a chi ha creato l'appuntamento.
  if (action === "appointment_result") {
    const result = String(body.result ?? "");
    if (!["contratto_chiuso", "incontrato_con_trattativa", "incontrato_senza_trattativa", "annullato"].includes(result))
      return json(400, { error: "Esito non valido" });
    if (lead.outcome !== "appuntamento") return json(409, { error: "Questo contatto non ha un appuntamento" });
    if (lead.customer_id) return json(409, { error: "Il contratto è già concluso: il contatto è ora un cliente" });

    const ownerId = lead.assigned_to as string;
    let customerId: string | null = null;
    if (result === "contratto_chiuso") {
      // il cliente e' di chi ha creato l'appuntamento; chi ha fatto l'incontro lo vede e puo' creare il contratto
      customerId = await createCustomerFromLead(ownerId, user.id);
      if (!lead.is_owner) {
        await sql`INSERT INTO customer_agents (customer_id, agent_id, added_by) VALUES (${customerId}::uuid, ${user.id}::uuid, ${user.id}::uuid) ON CONFLICT DO NOTHING`;
      }
    }
    // "annullato" = non visto = pacco: l'evento in calendario risulta annullato (e torna normale se l'esito viene corretto)
    if (lead.calendar_event_id) {
      if (result === "annullato")
        await sql`UPDATE calendar_events SET title = left('Annullato · ' || title, 120) WHERE id = ${lead.calendar_event_id}::uuid AND title NOT LIKE 'Annullato%'`;
      else
        await sql`UPDATE calendar_events SET title = regexp_replace(title, '^Annullato · ', '') WHERE id = ${lead.calendar_event_id}::uuid`;
    }
    // un solo esito per appuntamento: se viene corretto, il vecchio conteggio e' sostituito
    await sql`DELETE FROM lead_events WHERE lead_id = ${id}::uuid AND kind = 'appointment_result'`;
    await sql`
      UPDATE leads SET appointment_result = ${result}::lead_appointment_result, appointment_closed_at = now(),
             appointment_result_by = ${user.id}::uuid, customer_id = ${customerId}::uuid
      WHERE id = ${id}::uuid`;
    // i numeri (Performance) vanno a chi ha creato l'appuntamento
    await sql`INSERT INTO lead_events (lead_id, list_id, agent_id, kind, outcome, sector)
              VALUES (${lead.id}::uuid, ${lead.list_id}::uuid, ${ownerId}::uuid, 'appointment_result', ${result}, ${lead.sector})`;
    // chi ha creato l'appuntamento viene avvisato dell'esito dato da un collega
    if (!lead.is_owner) {
      const labels: Record<string, string> = {
        contratto_chiuso: "Contratto concluso",
        incontrato_con_trattativa: "Incontrato con trattativa",
        incontrato_senza_trattativa: "Incontrato senza trattativa",
        annullato: "Annullato / non visto",
      };
      await notify([ownerId], {
        kind: "shared_result",
        title: `Esito appuntamento: ${labels[result]}`,
        body: `Esitato da ${user.first_name} ${user.last_name}`,
        link: "Agenda lead",
        ref: `result:${id}:${Date.now()}`,
      });
    }
    return json(200, { ok: true, customer_id: customerId });
  }

  /* ----- ESITO DI UN RICHIAMO (Agenda) ----- */
  // Contratto fatto, appuntamento, annullato / pacco, chiamato senza trattativa.
  // Questi dati NON entrano in Performance.
  if (action === "callback_result") {
    const result = String(body.result ?? "");
    if (!["contratto_chiuso", "appuntamento", "annullato", "chiamato_senza_trattativa"].includes(result))
      return json(400, { error: "Esito non valido" });
    if (lead.outcome !== "da_ricontattare") return json(409, { error: "Questo contatto non è un richiamo" });

    if (result === "appuntamento") {
      const when = validDate(body.appointment_at);
      if (!when) return json(400, { error: "Scegli data e ora valide per l'appuntamento" });
      await dropEvent();
      const calendarId = await makeEvent(`Lead: ${fullName}`, when);
      await sql`
        UPDATE leads SET outcome = 'appuntamento', outcome_at = now(), callback_at = NULL,
               appointment_at = ${when.toISOString()}::timestamptz, appointment_result = 'in_attesa',
               appointment_closed_at = NULL, appointment_result_by = NULL, calendar_event_id = ${calendarId}::uuid
        WHERE id = ${id}::uuid`;
      return json(200, { ok: true });
    }

    const at = lead.callback_at ? new Date(lead.callback_at) : new Date();
    let customerId: string | null = null;
    if (result === "contratto_chiuso") customerId = await createCustomerFromLead(user.id, user.id);
    if (result === "annullato" && lead.calendar_event_id)
      await sql`UPDATE calendar_events SET title = left('Annullato · ' || title, 120) WHERE id = ${lead.calendar_event_id}::uuid AND title NOT LIKE 'Annullato%'`;
    await sql`
      UPDATE leads SET outcome = 'appuntamento', outcome_at = now(), callback_at = NULL,
             appointment_at = ${at.toISOString()}::timestamptz, appointment_result = ${result}::lead_appointment_result,
             appointment_closed_at = now(), appointment_result_by = ${user.id}::uuid, customer_id = ${customerId}::uuid
      WHERE id = ${id}::uuid`;
    return json(200, { ok: true, customer_id: customerId });
  }

  return json(400, { error: "Azione non valida" });
});
