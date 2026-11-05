import { json, requireUser, route, sql } from "./_shared/auth";
import { UUID_RE } from "./_shared/customers";
import { MAX_VOICEMAIL_TRIES, getCallWindow, getDialConfig, romeDayRange } from "./_shared/leads";

// Call Mode: restituisce UN solo lead alla volta (mai l'elenco completo) piu' i contatori dell'agente.
// Insieme al lead da chiamare manda anche "next" (il successivo), cosi' l'app passa al contatto dopo senza aspettare il server.
// Ordine: prima i richiami scaduti, poi i nuovi, per ultimi i "Segreteria/NR" (fine lista).
// Con il filtro citta' (?cities=pavia,milano) vale lo stesso ordine ma solo per quelle citta':
// finiti i nuovi contatti di quelle citta', si richiamano anche le loro segreterie.
export const handler = route("GET", async (event) => {
  const auth = await requireUser(event, ["leads.work"]);
  if ("response" in auth) return auth.response;
  const { user } = auth;

  const q = event.queryStringParameters ?? {};
  const exclude = (q.exclude ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter((s) => UUID_RE.test(s))
    .slice(0, 100);
  // dopo "Annulla" o una ricerca l'app chiede proprio quel lead, in qualunque stato sia
  const focus = q.focus && UUID_RE.test(q.focus) ? q.focus : null;

  // filtro per citta' (una o piu'): chiavi in minuscolo; "__none__" = contatti senza citta'
  const cityKeys = (q.cities ?? "")
    .split(",")
    .map((c) => c.trim().toLowerCase())
    .filter(Boolean)
    .map((c) => (c === "__none__" ? "" : c))
    .slice(0, 30);

  const { start, end } = romeDayRange();
  const dayStart = start.toISOString();
  // contatori del filtro attivo (le citta' non selezionate non contano)
  const countsQuery = sql`
    SELECT
      count(*) FILTER (WHERE city_ok AND outcome = 'nuovo')::int AS fresh,
      count(*) FILTER (WHERE city_ok AND outcome = 'da_ricontattare' AND callback_at IS NOT NULL AND callback_at <= now())::int AS due,
      count(*) FILTER (WHERE city_ok AND outcome = 'da_ricontattare' AND callback_at IS NOT NULL AND callback_at > now())::int AS waiting,
      -- segreteria: si richiama solo nella stessa giornata, il giorno dopo sparisce
      count(*) FILTER (WHERE city_ok AND outcome = 'segreteria' AND call_count < ${MAX_VOICEMAIL_TRIES}::int AND outcome_at >= ${dayStart}::timestamptz)::int AS voicemail,
      count(*)::int AS total
    FROM (
      SELECT outcome, callback_at, call_count, outcome_at,
             (cardinality(${cityKeys}::text[]) = 0 OR coalesce(lower(trim(city)), '') = ANY(${cityKeys}::text[])) AS city_ok
      FROM leads WHERE assigned_to = ${user.id}::uuid AND anonymized_at IS NULL
    ) t`;

  // citta' presenti tra i contatti da chiamare (nuovi, richiami scaduti, segreterie di oggi) con quanti per citta'
  const citiesQuery = sql`
    SELECT coalesce(lower(trim(city)), '') AS key, min(nullif(trim(city), '')) AS label, count(*)::int AS n
    FROM leads
    WHERE assigned_to = ${user.id}::uuid AND anonymized_at IS NULL
      AND (outcome = 'nuovo'
           OR (outcome = 'da_ricontattare' AND callback_at IS NOT NULL AND callback_at <= now())
           OR (outcome = 'segreteria' AND call_count < ${MAX_VOICEMAIL_TRIES}::int AND outcome_at >= ${dayStart}::timestamptz))
    GROUP BY 1 ORDER BY n DESC, 1`;

  const todayQuery = sql`
    SELECT count(*) FILTER (WHERE kind = 'outcome')::int AS calls,
           -- contatti: ogni lead conta UNA volta sola (appuntamento, non interessato o da richiamare)
           count(DISTINCT coalesce(lead_id::text, id::text)) FILTER (WHERE kind = 'outcome' AND outcome IN ('appuntamento','non_interessato','da_ricontattare','persona_sbagliata'))::int AS contacts,
           count(DISTINCT coalesce(lead_id::text, id::text)) FILTER (WHERE kind = 'outcome' AND outcome = 'appuntamento')::int AS appointments
    FROM lead_events
    WHERE agent_id = ${user.id}::uuid
      AND created_at >= ${start.toISOString()}::timestamptz AND created_at < ${end.toISOString()}::timestamptz`;

  // fuori orario non si vedono nuovi contatti: resta solo il lead aperto dalla ricerca
  const leadQuery = sql`
    SELECT (id = ${focus}::uuid) AS is_focus, id, first_name, last_name, phone, phone2, address, house_number, street_type, provider, city, province, fiscal_code, sector, notes,
           outcome::text AS outcome, call_count, callback_at
    FROM leads
    WHERE assigned_to = ${user.id}::uuid AND anonymized_at IS NULL
      AND NOT (id = ANY(${exclude}::uuid[]))
      AND (id = ${focus}::uuid
           OR ((cardinality(${cityKeys}::text[]) = 0 OR coalesce(lower(trim(city)), '') = ANY(${cityKeys}::text[]))
               AND (outcome = 'nuovo'
                    OR (outcome = 'da_ricontattare' AND callback_at IS NOT NULL AND callback_at <= now())
                    OR (outcome = 'segreteria' AND call_count < ${MAX_VOICEMAIL_TRIES}::int AND outcome_at >= ${dayStart}::timestamptz))))
    ORDER BY (id = ${focus}::uuid) DESC NULLS LAST,
             CASE outcome WHEN 'da_ricontattare' THEN 0 WHEN 'nuovo' THEN 1 ELSE 2 END,
             CASE WHEN outcome = 'da_ricontattare' THEN callback_at END ASC NULLS LAST,
             CASE WHEN outcome = 'segreteria' THEN outcome_at END ASC NULLS LAST,
             lower(coalesce(city, '')), id
    LIMIT 2`;

  // le interrogazioni sono indipendenti: partono insieme (prima erano una dopo l'altra)
  const [session, dial, cRows, cityRows, todayRows, leadRows] = await Promise.all([
    getCallWindow(),
    getDialConfig(user.id),
    countsQuery,
    citiesQuery,
    todayQuery,
    leadQuery,
  ]);
  const c = cRows[0];
  const today = todayRows[0];
  const cities = cityRows.map((r) => ({ key: (r.key as string) || "__none__", label: (r.label as string | null) ?? "Senza città", n: r.n as number }));

  // fuori orario resta solo il lead aperto dalla ricerca
  const candidates = (session.active ? leadRows : leadRows.filter((r) => r.is_focus === true)).map(({ is_focus: _f, ...lead }) => lead);
  const lead = candidates[0];
  const next = candidates[1];

  return json(200, {
    lead: lead ?? null,
    next: next ?? null,
    cities,
    counts: {
      fresh: c.fresh,
      due: c.due,
      waiting: c.waiting,
      voicemail: c.voicemail,
      total: c.total,
      to_call: c.fresh + c.due + c.voicemail,
      ...today,
    },
    session,
    dial,
    now: new Date().toISOString(),
  });
});
