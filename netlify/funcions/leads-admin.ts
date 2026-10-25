import { json, requireUser, route, sql } from "./_shared/auth";
import { purgeLeads } from "./_shared/leads";

// Panoramica LeadHub per chi ha "leads.manage": liste, agenti disponibili, contatti da assegnare.
export const handler = route("GET", async (event) => {
  const auth = await requireUser(event, ["leads.manage"]);
  if ("response" in auth) return auth.response;

  // pulizia "pigra": se la funzione programmata non e' ancora girata, la facciamo adesso
  await purgeLeads();

  const lists = await sql`
    SELECT l.id, l.name, l.source_filename, l.created_at, l.session_closed_at, l.purge_after, l.anonymized_at,
           count(x.id)::int AS total,
           count(x.id) FILTER (WHERE x.assigned_to IS NOT NULL)::int AS assigned,
           count(x.id) FILTER (WHERE x.assigned_to IS NULL AND x.anonymized_at IS NULL AND x.outcome = 'nuovo')::int AS unassigned,
           count(x.id) FILTER (WHERE x.outcome <> 'nuovo')::int AS worked,
           count(x.id) FILTER (WHERE x.appointment_at IS NOT NULL)::int AS appointments,
           count(x.id) FILTER (WHERE x.appointment_result = 'contratto_chiuso')::int AS closed,
           count(x.id) FILTER (WHERE x.anonymized_at IS NULL)::int AS with_data,
           count(x.id) FILTER (WHERE x.anonymized_at IS NULL AND x.outcome = 'nuovo')::int AS untreated
    FROM lead_lists l LEFT JOIN leads x ON x.list_id = l.id
    GROUP BY l.id
    ORDER BY l.created_at DESC
    LIMIT 100`;

  // agenti attivi che possono lavorare i lead (permesso di ruolo, con le eccezioni personali)
  const agents = await sql`
    SELECT u.id, u.first_name, u.last_name, u.role::text AS role,
           count(l.id) FILTER (WHERE l.anonymized_at IS NULL AND l.outcome = 'nuovo')::int AS to_call,
           count(l.id) FILTER (WHERE l.anonymized_at IS NULL)::int AS assigned
    FROM users u
    LEFT JOIN leads l ON l.assigned_to = u.id
    WHERE u.status = 'attivo' AND (
      EXISTS (SELECT 1 FROM user_permissions up
              WHERE up.user_id = u.id AND up.permission_key = 'leads.work' AND up.granted)
      OR (EXISTS (SELECT 1 FROM role_permissions rp WHERE rp.role = u.role AND rp.permission_key = 'leads.work')
          AND NOT EXISTS (SELECT 1 FROM user_permissions up
                          WHERE up.user_id = u.id AND up.permission_key = 'leads.work' AND NOT up.granted)))
    GROUP BY u.id
    ORDER BY u.first_name, u.last_name`;

  // contatti non ancora trattati (nessun esito), in totale e divisi tra assegnati e da assegnare
  const untreated = (
    await sql`
    SELECT count(*)::int AS total,
           count(*) FILTER (WHERE assigned_to IS NOT NULL)::int AS assigned,
           count(*) FILTER (WHERE assigned_to IS NULL)::int AS unassigned
    FROM leads WHERE anonymized_at IS NULL AND outcome = 'nuovo'`
  )[0];

  const cities = await sql`
    SELECT city, count(*)::int AS n FROM leads
    WHERE assigned_to IS NULL AND anonymized_at IS NULL AND outcome = 'nuovo' AND city IS NOT NULL
    GROUP BY city ORDER BY n DESC, city LIMIT 300`;

  const sectors = await sql`
    SELECT coalesce(sector, '—') AS sector, count(*)::int AS n FROM leads
    WHERE assigned_to IS NULL AND anonymized_at IS NULL AND outcome = 'nuovo'
    GROUP BY 1 ORDER BY n DESC`;

  return json(200, { lists, agents, cities, sectors, untreated, now: new Date().toISOString() });
});
