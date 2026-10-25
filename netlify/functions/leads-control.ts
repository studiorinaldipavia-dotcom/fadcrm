import { json, requireUser, route, sql } from "./_shared/auth";
import { CALL_END_OPTIONS, MAX_VOICEMAIL_TRIES, getCallWindow, romeDayRange } from "./_shared/leads";
import { averageAppointmentsToday } from "./_shared/performance";

// Control Room: numeri del giorno per ogni agente (si aggiorna da solo ogni pochi secondi).
export const handler = route("GET", async (event) => {
  const auth = await requireUser(event, ["leads.manage"]);
  if ("response" in auth) return auth.response;

  const { start, end, label } = romeDayRange(event.queryStringParameters?.day);
  const from = start.toISOString();
  const to = end.toISOString();

  const agents = await sql`
    SELECT u.id, u.first_name, u.last_name,
      -- assegnati del giorno: lead ancora da fare + lead lavorati oggi (si azzera ogni giorno)
      coalesce(a.assigned, 0)::int AS assigned,
      coalesce(a.to_call, 0)::int AS to_call,
      coalesce(e.worked, 0)::int AS worked,
      coalesce(e.dials, 0)::int AS dials,
      coalesce(e.calls, 0)::int AS calls,
      coalesce(e.contacts, 0)::int AS contacts,
      coalesce(e.appointments, 0)::int AS appointments,
      coalesce(e.closed, 0)::int AS closed,
      coalesce(e.cancelled, 0)::int AS cancelled,
      coalesce(e.not_interested, 0)::int AS not_interested,
      coalesce(e.callbacks, 0)::int AS callbacks,
      coalesce(e.voicemail, 0)::int AS voicemail,
      coalesce(e.wrong, 0)::int AS wrong,
      coalesce(e.moved, 0)::int AS moved,
      e.last_activity
    FROM users u
    LEFT JOIN (
      -- assegnati del giorno = lead ancora da fare + lead esitati oggi (ognuno contato UNA volta)
      SELECT t.assigned_to,
             count(*) FILTER (WHERE t.remaining)::int AS to_call,
             count(*) FILTER (WHERE t.remaining OR t.worked_today)::int AS assigned
      FROM (
        SELECT l.assigned_to,
               (l.outcome = 'nuovo'
                OR (l.outcome = 'da_ricontattare' AND l.callback_at IS NOT NULL AND l.callback_at <= now())
                OR (l.outcome = 'segreteria' AND l.call_count < ${MAX_VOICEMAIL_TRIES}::int AND l.outcome_at >= ${from}::timestamptz)) AS remaining,
               EXISTS (SELECT 1 FROM lead_events ev WHERE ev.lead_id = l.id AND ev.kind = 'outcome'
                         AND ev.created_at >= ${from}::timestamptz AND ev.created_at < ${to}::timestamptz) AS worked_today
        FROM leads l WHERE l.assigned_to IS NOT NULL AND l.anonymized_at IS NULL
      ) t
      GROUP BY t.assigned_to
    ) a ON a.assigned_to = u.id
    LEFT JOIN (
      SELECT agent_id,
        count(*) FILTER (WHERE kind = 'dial') AS dials,
        count(*) FILTER (WHERE kind = 'outcome') AS calls,
        count(DISTINCT coalesce(lead_id::text, id::text)) FILTER (WHERE kind = 'outcome') AS worked,
        count(DISTINCT coalesce(lead_id::text, id::text)) FILTER (WHERE kind = 'outcome' AND outcome IN ('appuntamento','non_interessato','da_ricontattare','persona_sbagliata')) AS contacts,
        count(*) FILTER (WHERE kind = 'outcome' AND outcome = 'appuntamento') AS appointments,
        count(*) FILTER (WHERE kind = 'appointment_result' AND outcome = 'contratto_chiuso') AS closed,
        count(*) FILTER (WHERE kind = 'appointment_result' AND outcome = 'annullato') AS cancelled,
        count(*) FILTER (WHERE kind = 'outcome' AND outcome = 'non_interessato') AS not_interested,
        count(*) FILTER (WHERE kind = 'outcome' AND outcome = 'da_ricontattare') AS callbacks,
        count(*) FILTER (WHERE kind = 'outcome' AND outcome = 'segreteria') AS voicemail,
        count(*) FILTER (WHERE kind = 'outcome' AND outcome = 'numero_errato') AS wrong,
        count(*) FILTER (WHERE kind = 'outcome' AND outcome = 'persona_sbagliata') AS moved,
        max(created_at) AS last_activity
      FROM lead_events
      WHERE created_at >= ${from}::timestamptz AND created_at < ${to}::timestamptz
      GROUP BY agent_id
    ) e ON e.agent_id = u.id
    WHERE u.status = 'attivo' AND (coalesce(a.assigned, 0) > 0 OR coalesce(e.calls, 0) > 0 OR coalesce(e.dials, 0) > 0)
    ORDER BY coalesce(e.calls, 0) DESC, u.first_name`;

  // ultime attivita': solo tipo di esito e settore, nessun dato personale dei contatti
  const feed = await sql`
    SELECT e.id, e.kind, e.outcome, e.sector, e.created_at, u.first_name, u.last_name
    FROM lead_events e JOIN users u ON u.id = e.agent_id
    WHERE e.created_at >= ${from}::timestamptz AND e.created_at < ${to}::timestamptz AND e.kind <> 'dial'
    ORDER BY e.created_at DESC LIMIT 20`;

  const session = await getCallWindow();
  return json(200, { day: label, agents, feed, session, end_options: CALL_END_OPTIONS, average: await averageAppointmentsToday(), now: new Date().toISOString() });
});
