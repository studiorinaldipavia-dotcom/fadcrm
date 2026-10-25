import { sql } from "./auth";

export type NotificationInput = {
  kind: string;
  title: string;
  body?: string | null;
  link?: string | null;
  ref?: string | null;
};

/** Crea la stessa notifica per piu' persone. Con "ref" non si creano doppioni. */
export async function notify(userIds: string[], n: NotificationInput) {
  const ids = [...new Set(userIds.filter(Boolean))];
  if (ids.length === 0) return;
  await sql`
    INSERT INTO notifications (user_id, kind, title, body, link, ref)
    SELECT u, ${n.kind}, ${n.title}, ${n.body ?? null}, ${n.link ?? null}, ${n.ref ?? null}
    FROM unnest(${ids}::uuid[]) AS u
    ON CONFLICT DO NOTHING`;
}

/** Persone attive che hanno un permesso (dal ruolo, con le eccezioni personali) */
export async function usersWithPermission(permission: string): Promise<string[]> {
  const rows = await sql`
    SELECT u.id FROM users u
    WHERE u.status = 'attivo' AND (
      EXISTS (SELECT 1 FROM user_permissions up WHERE up.user_id = u.id AND up.permission_key = ${permission} AND up.granted)
      OR (EXISTS (SELECT 1 FROM role_permissions rp WHERE rp.role = u.role AND rp.permission_key = ${permission})
          AND NOT EXISTS (SELECT 1 FROM user_permissions up WHERE up.user_id = u.id AND up.permission_key = ${permission} AND NOT up.granted)))`;
  return rows.map((r) => r.id as string);
}

/**
 * Promemoria automatici: appuntamenti in calendario (1 giorno prima e 2 ore prima),
 * appuntamenti lead condivisi, task della segreteria in scadenza. Se "userId" e' nullo li genera per tutti.
 */
export async function generateReminders(userId: string | null) {
  const windows = [
    { label: "Domani", from: 2, to: 24, ref: "1d" },
    { label: "Tra poco", from: 0, to: 2, ref: "2h" },
  ];

  for (const w of windows) {
    // eventi del calendario (per l'agente del calendario e per il responsabile)
    await sql`
      INSERT INTO notifications (user_id, kind, title, body, link, ref)
      SELECT x.uid, 'calendar_reminder',
             ${w.label}::text || ': ' || CASE WHEN e.title LIKE 'Lead:%' THEN 'appuntamento lead'
                                              WHEN e.title LIKE 'Richiamo:%' THEN 'richiamo lead'
                                              ELSE e.title END,
             to_char(e.starts_at AT TIME ZONE 'Europe/Rome', 'DD/MM "alle" HH24:MI'),
             CASE WHEN e.title LIKE 'Lead:%' OR e.title LIKE 'Richiamo:%' THEN 'Agenda lead' ELSE 'Calendario' END,
             'cal:' || e.id || ':' || ${w.ref}::text
      FROM calendar_events e
      CROSS JOIN LATERAL (VALUES (e.agent_id), (e.manager_id)) AS x(uid)
      WHERE x.uid IS NOT NULL AND (${userId}::uuid IS NULL OR x.uid = ${userId}::uuid)
        AND e.title NOT LIKE 'Annullato%'
        AND e.starts_at > now() + ${w.from}::int * interval '1 hour'
        AND e.starts_at <= now() + ${w.to}::int * interval '1 hour'
        -- il promemoria "il giorno prima" non serve se l'appuntamento e' stato preso oggi stesso
        AND (${w.ref}::text <> '1d' OR (e.created_at AT TIME ZONE 'Europe/Rome')::date < (now() AT TIME ZONE 'Europe/Rome')::date)
      ON CONFLICT DO NOTHING`;

    // appuntamenti lead condivisi con me
    await sql`
      INSERT INTO notifications (user_id, kind, title, body, link, ref)
      SELECT s.user_id, 'calendar_reminder', ${w.label}::text || ': appuntamento condiviso',
             to_char(l.appointment_at AT TIME ZONE 'Europe/Rome', 'DD/MM "alle" HH24:MI'),
             'Agenda lead', 'share:' || l.id || ':' || ${w.ref}::text
      FROM lead_shares s JOIN leads l ON l.id = s.lead_id
      WHERE (${userId}::uuid IS NULL OR s.user_id = ${userId}::uuid)
        AND l.appointment_result = 'in_attesa'
        AND l.appointment_at > now() + ${w.from}::int * interval '1 hour'
        AND l.appointment_at <= now() + ${w.to}::int * interval '1 hour'
        AND (${w.ref}::text <> '1d' OR (coalesce(l.outcome_at, l.created_at) AT TIME ZONE 'Europe/Rome')::date < (now() AT TIME ZONE 'Europe/Rome')::date)
      ON CONFLICT DO NOTHING`;
  }

  // toglie i promemoria "domani" gia' creati per appuntamenti presi nello stesso giorno (se non ancora letti)
  await sql`
    DELETE FROM notifications n USING calendar_events e
    WHERE n.ref = 'cal:' || e.id || ':1d' AND n.read_at IS NULL
      AND (e.created_at AT TIME ZONE 'Europe/Rome')::date = (n.created_at AT TIME ZONE 'Europe/Rome')::date`;

  // task della segreteria aperte e scadute (o in scadenza oggi): promemoria all'agente a cui sono assegnate
  await sql`
    INSERT INTO notifications (user_id, kind, title, body, link, ref)
    SELECT t.agent_id, 'task_due',
           CASE WHEN t.kind = 'ko' THEN 'KO da recuperare in scadenza' ELSE 'Task della segreteria in scadenza' END,
           c.first_name || ' ' || c.last_name || ': ' || t.title, 'Segreteria', 'task:' || t.id || ':due'
    FROM secretary_tasks t JOIN customers c ON c.id = t.customer_id
    WHERE (${userId}::uuid IS NULL OR t.agent_id = ${userId}::uuid)
      AND t.status = 'aperta' AND t.due_date IS NOT NULL
      AND t.due_date <= (now() AT TIME ZONE 'Europe/Rome')::date
    ON CONFLICT DO NOTHING`;
  // se la task e' stata chiusa nel frattempo, il promemoria non serve piu'
  await sql`
    DELETE FROM notifications n
    WHERE n.kind = 'task_due' AND n.read_at IS NULL
      AND EXISTS (SELECT 1 FROM secretary_tasks t WHERE t.id::text = split_part(n.ref, ':', 2) AND t.status <> 'aperta')`;
}
