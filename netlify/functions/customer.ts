import { json, logAuditOnce, requireUser, route, sql } from "./_shared/auth";
import { canEditCustomer, canViewCustomer, UUID_RE } from "./_shared/customers";

// Scheda di un cliente: dati, note e storico
export const handler = route("GET", async (event) => {
  const auth = await requireUser(event, ["customers.view_all", "customers.view_own"]);
  if ("response" in auth) return auth.response;
  const { user } = auth;

  const id = event.queryStringParameters?.id ?? "";
  if (!UUID_RE.test(id)) return json(400, { error: "Cliente non valido" });

  const rows = await sql`
    SELECT c.id, c.first_name, c.last_name, c.fiscal_code, c.phone, c.email, c.address, c.city, c.province,
           c.privacy_marketing, c.privacy_third_parties, c.privacy_signed_at,
           (SELECT coalesce(array_agg(sa.agent_id::text), '{}') FROM customer_agents sa WHERE sa.customer_id = c.id) AS shared_ids,
           c.interests, c.status::text AS status, c.agent_id, a.first_name AS agent_name,
           a.last_name AS agent_last_name, c.created_at, c.updated_at
    FROM customers c LEFT JOIN users a ON a.id = c.agent_id
    WHERE c.id = ${id}`;
  const customer = rows[0];
  // Stessa risposta se non esiste o se non e' tuo: non rivela l'esistenza
  if (!customer || !canViewCustomer(user, customer.agent_id, customer.shared_ids)) {
    return json(404, { error: "Cliente non trovato" });
  }

  await logAuditOnce(user.id, "cliente_consultato", "customers", id, 10);

  const notes = await sql`
    SELECT n.id, n.body, n.created_at, u.first_name AS author_name, u.last_name AS author_last_name
    FROM customer_notes n LEFT JOIN users u ON u.id = n.author_id
    WHERE n.customer_id = ${id} ORDER BY n.created_at DESC LIMIT 200`;
  const history = await sql`
    SELECT h.id, h.event_type, h.description, h.created_at,
           u.first_name AS actor_name, u.last_name AS actor_last_name
    FROM customer_history h LEFT JOIN users u ON u.id = h.actor_id
    WHERE h.customer_id = ${id} ORDER BY h.created_at DESC LIMIT 200`;

  const sharedAgents = customer.shared_ids?.length
    ? await sql`SELECT id, first_name, last_name FROM users WHERE id = ANY(${customer.shared_ids}::uuid[]) ORDER BY first_name`
    : [];

  // Informativa privacy: ultime richieste (inviate o firmate)
  const privacy = await sql`
    SELECT id, status, method, email, sent_at, expires_at, (expires_at < now()) AS expired, signed_at,
           consent_marketing, consent_third_parties, (drive_file_id IS NOT NULL) AS has_pdf
    FROM privacy_requests
    WHERE customer_id = ${id} AND status <> 'annullata'
    ORDER BY created_at DESC LIMIT 5`;

  // Task della segreteria collegate al cliente (KO da recuperare e task manuali)
  const tasks = user.permissions.includes("tasks.manage")
    ? await sql`
        SELECT t.id, t.kind, t.title, t.status, t.due_date::text AS due_date,
               a.first_name AS agent_first_name, a.last_name AS agent_last_name
        FROM secretary_tasks t JOIN users a ON a.id = t.agent_id
        WHERE t.customer_id = ${id} ORDER BY (t.status = 'aperta') DESC, t.created_at DESC LIMIT 20`
    : await sql`
        SELECT t.id, t.kind, t.title, t.status, t.due_date::text AS due_date,
               a.first_name AS agent_first_name, a.last_name AS agent_last_name
        FROM secretary_tasks t JOIN users a ON a.id = t.agent_id
        WHERE t.customer_id = ${id} AND t.agent_id = ${user.id}::uuid
        ORDER BY (t.status = 'aperta') DESC, t.created_at DESC LIMIT 20`;

  return json(200, {
    customer, notes, history, tasks, privacy, shared_agents: sharedAgents,
    can_edit: canEditCustomer(user, customer.agent_id, customer.shared_ids),
    can_add_agents: user.permissions.includes("customers.edit_all") || user.permissions.includes("customers.add_agents"),
  });
});
