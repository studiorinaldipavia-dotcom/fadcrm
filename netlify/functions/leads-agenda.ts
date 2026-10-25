import { json, requireUser, route, sql } from "./_shared/auth";
import { getCallWindow, romeDayRange } from "./_shared/leads";

// Agenda: appuntamenti presi dall'agente e richiami programmati, in ordine di orario.
export const handler = route("GET", async (event) => {
  const auth = await requireUser(event, ["leads.work"]);
  if ("response" in auth) return auth.response;
  const { user } = auth;

  const { start, end, label } = romeDayRange(event.queryStringParameters?.day);
  const from = start.toISOString();
  const to = end.toISOString();

  const items = await sql`
    SELECT id, first_name, last_name, phone, phone2, address, house_number, street_type, provider, city, province, fiscal_code, sector, notes,
           CASE WHEN outcome = 'da_ricontattare' THEN 'richiamo' ELSE 'appuntamento' END AS kind,
           coalesce(appointment_at, callback_at) AS appointment_at,
           appointment_result::text AS appointment_result, customer_id,
           (anonymized_at IS NOT NULL) AS anonymized,
           (SELECT rb.first_name || ' ' || rb.last_name FROM users rb WHERE rb.id = leads.appointment_result_by AND rb.id IS DISTINCT FROM leads.assigned_to) AS result_by
    FROM leads
    WHERE assigned_to = ${user.id}::uuid
      AND ((appointment_at >= ${from}::timestamptz AND appointment_at < ${to}::timestamptz)
           OR (outcome = 'da_ricontattare' AND callback_at >= ${from}::timestamptz AND callback_at < ${to}::timestamptz))
    ORDER BY coalesce(appointment_at, callback_at), id`;

  const mine = items.map((i) => ({ ...i, shared: false, shared_by: null, owner_name: null }));
  // condivisioni dei miei appuntamenti (tutte, con l'indicazione di quelle fatte da me)
  const withShares = await sql`
    SELECT s.lead_id, u.id, u.first_name, u.last_name, (s.shared_by = ${user.id}::uuid OR s.shared_by IS NULL) AS by_me
    FROM lead_shares s JOIN users u ON u.id = s.user_id
    WHERE s.lead_id = ANY(${mine.map((i) => i.id)}::uuid[])`;
  const sharedWith: Record<string, { id: string; name: string; by_me: boolean }[]> = {};
  for (const r of withShares) (sharedWith[r.lead_id as string] ??= []).push({ id: r.id as string, name: `${r.first_name} ${r.last_name}`, by_me: Boolean(r.by_me) });

  // appuntamenti che i colleghi hanno condiviso con me: si possono esitare e ricondividere
  const theirs = await sql`
    SELECT l.id, l.first_name, l.last_name, l.phone, l.phone2, l.address, l.house_number, l.street_type, l.provider, l.city, l.province,
           l.fiscal_code, l.sector, l.notes,
           CASE WHEN l.outcome = 'da_ricontattare' THEN 'richiamo' ELSE 'appuntamento' END AS kind,
           coalesce(l.appointment_at, l.callback_at) AS appointment_at,
           l.appointment_result::text AS appointment_result,
           CASE WHEN c.agent_id = ${user.id}::uuid
                  OR EXISTS (SELECT 1 FROM customer_agents ca WHERE ca.customer_id = c.id AND ca.agent_id = ${user.id}::uuid)
                THEN l.customer_id END AS customer_id,
           (SELECT rb.first_name || ' ' || rb.last_name FROM users rb WHERE rb.id = l.appointment_result_by AND rb.id IS DISTINCT FROM l.assigned_to) AS result_by,
           (l.anonymized_at IS NOT NULL) AS anonymized,
           coalesce(sb.first_name || ' ' || sb.last_name, o.first_name || ' ' || o.last_name) AS shared_by,
           o.first_name || ' ' || o.last_name AS owner_name
    FROM lead_shares s
    JOIN leads l ON l.id = s.lead_id
    JOIN users o ON o.id = l.assigned_to
    LEFT JOIN users sb ON sb.id = s.shared_by
    LEFT JOIN customers c ON c.id = l.customer_id
    WHERE s.user_id = ${user.id}::uuid
      AND ((l.appointment_at >= ${from}::timestamptz AND l.appointment_at < ${to}::timestamptz)
           OR (l.outcome = 'da_ricontattare' AND l.callback_at >= ${from}::timestamptz AND l.callback_at < ${to}::timestamptz))`;
  // colleghi con cui io ho ricondiviso questi appuntamenti
  const myReshares = await sql`
    SELECT s.lead_id, u.id, u.first_name, u.last_name
    FROM lead_shares s JOIN users u ON u.id = s.user_id
    WHERE s.shared_by = ${user.id}::uuid AND s.lead_id = ANY(${theirs.map((i) => i.id)}::uuid[])`;
  const reshared: Record<string, { id: string; name: string; by_me: boolean }[]> = {};
  for (const r of myReshares) (reshared[r.lead_id as string] ??= []).push({ id: r.id as string, name: `${r.first_name} ${r.last_name}`, by_me: true });

  const all = [
    ...mine.map((i) => ({ ...i, shared_with: sharedWith[i.id as string] ?? [] })),
    ...theirs.map((i) => ({ ...i, shared: true, shared_with: reshared[i.id as string] ?? [] })),
  ].sort((a, b) => new Date(a.appointment_at as string).getTime() - new Date(b.appointment_at as string).getTime());

  return json(200, { day: label, items: all, session: await getCallWindow(), now: new Date().toISOString() });
});
