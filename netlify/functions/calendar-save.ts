import { json, logAudit, parseBody, requireUser, route, sql } from "./_shared/auth";
import { addHistory, canViewCustomer, UUID_RE } from "./_shared/customers";

const fmt = (iso: string) =>
  new Date(iso).toLocaleString("it-IT", {
    timeZone: "Europe/Rome",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });

// Azioni: create | update | delete
export const handler = route("POST", async (event) => {
  const auth = await requireUser(event, ["calendar.view_own", "calendar.view_all"]);
  if ("response" in auth) return auth.response;
  const { user } = auth;
  const viewAll = user.permissions.includes("calendar.view_all");

  const body = parseBody(event);
  const action = String(body.action ?? "");

  /* ----- ELIMINA ----- */
  if (action === "delete") {
    const id = String(body.id ?? "");
    if (!UUID_RE.test(id)) return json(400, { error: "Appuntamento non valido" });
    const current = (await sql`SELECT id, agent_id, customer_id, title FROM calendar_events WHERE id = ${id}`)[0];
    if (!current || (!viewAll && current.agent_id !== user.id)) return json(404, { error: "Appuntamento non trovato" });
    await sql`DELETE FROM calendar_events WHERE id = ${id}`;
    if (current.customer_id) await addHistory(current.customer_id, user.id, "appuntamento_eliminato", `Appuntamento eliminato: ${current.title}`);
    await logAudit(user.id, "appuntamento_eliminato", "calendar_events", id, { title: current.title });
    return json(200, { ok: true });
  }

  if (action !== "create" && action !== "update") return json(400, { error: "Azione non valida" });

  /* ----- dati comuni ----- */
  const title = String(body.title ?? "").trim().slice(0, 120);
  const startsAt = new Date(String(body.starts_at ?? ""));
  const endsRaw = String(body.ends_at ?? "").trim();
  const endsAt = endsRaw ? new Date(endsRaw) : null;
  const notes = String(body.notes ?? "").trim().slice(0, 1000) || null;
  const customerId = String(body.customer_id ?? "").trim() || null;
  const managerId = String(body.manager_id ?? "").trim() || null;
  if (!title) return json(400, { error: "Scrivi il titolo dell'appuntamento" });
  if (isNaN(startsAt.getTime())) return json(400, { error: "Data o ora non valide" });
  if (endsAt && (isNaN(endsAt.getTime()) || endsAt <= startsAt)) return json(400, { error: "L'ora di fine deve essere dopo l'inizio" });

  let agentId = String(body.agent_id ?? "").trim() || user.id;
  if (agentId !== user.id && !viewAll) agentId = user.id;
  if (!UUID_RE.test(agentId)) return json(400, { error: "Agente non valido" });
  if (managerId && !UUID_RE.test(managerId)) return json(400, { error: "Responsabile non valido" });
  const people = await sql`
    SELECT id FROM users WHERE status = 'attivo' AND id IN (${agentId}, ${managerId ?? agentId})`;
  if (people.length < (managerId && managerId !== agentId ? 2 : 1)) return json(400, { error: "Agente o responsabile non valido" });

  if (customerId) {
    if (!UUID_RE.test(customerId)) return json(400, { error: "Cliente non valido" });
    const customer = (await sql`SELECT agent_id, (SELECT coalesce(array_agg(agent_id::text), '{}') FROM customer_agents WHERE customer_id = customers.id) AS shared_ids FROM customers WHERE id = ${customerId}`)[0];
    if (!customer || !canViewCustomer(user, customer.agent_id, customer.shared_ids)) return json(404, { error: "Cliente non trovato" });
  }

  if (action === "create") {
    const rows = await sql`
      INSERT INTO calendar_events (agent_id, customer_id, title, starts_at, ends_at, notes, manager_id, created_by)
      VALUES (${agentId}, ${customerId}, ${title}, ${startsAt.toISOString()}::timestamptz,
              ${endsAt ? endsAt.toISOString() : null}::timestamptz, ${notes}, ${managerId}, ${user.id})
      RETURNING id`;
    if (customerId) await addHistory(customerId, user.id, "appuntamento_creato", `Appuntamento fissato: ${title} il ${fmt(startsAt.toISOString())}`);
    await logAudit(user.id, "appuntamento_creato", "calendar_events", rows[0].id, { title });
    return json(200, { id: rows[0].id });
  }

  const id = String(body.id ?? "");
  if (!UUID_RE.test(id)) return json(400, { error: "Appuntamento non valido" });
  const current = (await sql`SELECT id, agent_id FROM calendar_events WHERE id = ${id}`)[0];
  if (!current || (!viewAll && current.agent_id !== user.id)) return json(404, { error: "Appuntamento non trovato" });

  await sql`
    UPDATE calendar_events SET agent_id = ${agentId}, customer_id = ${customerId}, title = ${title},
           starts_at = ${startsAt.toISOString()}::timestamptz, ends_at = ${endsAt ? endsAt.toISOString() : null}::timestamptz,
           notes = ${notes}, manager_id = ${managerId}
    WHERE id = ${id}`;
  if (customerId) await addHistory(customerId, user.id, "appuntamento_modificato", `Appuntamento modificato: ${title} il ${fmt(startsAt.toISOString())}`);
  await logAudit(user.id, "appuntamento_modificato", "calendar_events", id, { title });
  return json(200, { ok: true });
});
