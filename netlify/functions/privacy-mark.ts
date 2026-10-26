import { json, logAudit, parseBody, requireUser, route, sql } from "./_shared/auth";
import { addHistory, canEditCustomer, canViewCustomer, UUID_RE } from "./_shared/customers";

// Il bottone "Privacy" della scheda cliente porta su Privaclick e segna l'informativa come firmata.
export const handler = route("POST", async (event) => {
  const auth = await requireUser(event, ["customers.edit_own", "customers.edit_all"]);
  if ("response" in auth) return auth.response;
  const { user } = auth;

  const customerId = String(parseBody(event).customer_id ?? "");
  if (!UUID_RE.test(customerId)) return json(400, { error: "Cliente non valido" });

  const customer = (
    await sql`SELECT id, first_name, last_name, agent_id, (SELECT coalesce(array_agg(agent_id::text), '{}') FROM customer_agents WHERE customer_id = customers.id) AS shared_ids FROM customers WHERE id = ${customerId}`
  )[0];
  if (!customer || !canViewCustomer(user, customer.agent_id, customer.shared_ids)) return json(404, { error: "Cliente non trovato" });
  if (!canEditCustomer(user, customer.agent_id, customer.shared_ids)) return json(403, { error: "Non puoi modificare questo cliente" });

  // Già firmata: non si registra una seconda volta
  const already = await sql`SELECT 1 FROM privacy_requests WHERE customer_id = ${customerId} AND status = 'firmata' LIMIT 1`;
  if (already.length > 0) return json(200, { ok: true });

  // Eventuali vecchi inviti ancora aperti non servono più
  await sql`UPDATE privacy_requests SET status = 'annullata' WHERE customer_id = ${customerId} AND status = 'inviata'`;
  await sql`
    INSERT INTO privacy_requests (customer_id, method, status, template_rev, sent_by, signed_at, signer_name)
    VALUES (${customerId}, 'digitale', 'firmata', 'privaclick', ${user.id}, now(), ${`${customer.first_name} ${customer.last_name}`})`;
  await sql`UPDATE customers SET privacy_signed_at = now() WHERE id = ${customerId}`;
  await addHistory(customerId, user.id, "privacy_firmata", "Informativa privacy segnata come firmata (Privaclick)");
  await logAudit(user.id, "privacy_firmata", "customers", customerId, { fonte: "privaclick" });
  return json(200, { ok: true });
});
