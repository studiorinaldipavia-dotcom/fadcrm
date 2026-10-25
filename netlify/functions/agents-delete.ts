import { json, logAudit, parseBody, requireUser, route, sql } from "./_shared/auth";
import { UUID_RE } from "./_shared/customers";

const norm = (s: string) => s.replace(/\s+/g, " ").trim().toLowerCase();

// Elimina il profilo di un agente. Solo con "agents.delete" e scrivendo nome e cognome.
// Se l'agente ha clienti o task della segreteria collegati NON si cancella (si perderebbe lo storico): va disattivato.
export const handler = route("POST", async (event) => {
  const auth = await requireUser(event, ["agents.delete"]);
  if ("response" in auth) return auth.response;
  const { user } = auth;

  const body = parseBody(event);
  const id = String(body.id ?? "");
  if (!UUID_RE.test(id)) return json(400, { error: "Agente non valido" });
  if (id === user.id) return json(400, { error: "Non puoi eliminare il tuo profilo" });

  const target = (await sql`SELECT id, first_name, last_name, role FROM users WHERE id = ${id}::uuid`)[0];
  if (!target) return json(404, { error: "Agente non trovato" });
  if (norm(String(body.confirm_name ?? "")) !== norm(`${target.first_name} ${target.last_name}`))
    return json(400, { error: "Il nome e cognome scritti non corrispondono" });

  if (target.role === "amministratore") {
    const admins = await sql`SELECT count(*)::int AS n FROM users WHERE role = 'amministratore' AND status = 'attivo' AND id <> ${id}::uuid`;
    if (admins[0].n === 0) return json(400, { error: "Deve restare almeno un amministratore attivo" });
  }

  const linked = (
    await sql`
    SELECT
      (SELECT count(*) FROM customers WHERE agent_id = ${id}::uuid)::int AS customers,
      (SELECT count(*) FROM secretary_tasks WHERE agent_id = ${id}::uuid)::int AS tasks`
  )[0];
  if (linked.customers + linked.tasks > 0) {
    return json(409, {
      error:
        `Non posso eliminarlo: ha ${linked.customers} clienti e ${linked.tasks} task della segreteria collegati. ` +
        "Per non perdere lo storico, disattiva il profilo (stato «Sospeso») oppure riassegna prima i suoi clienti.",
    });
  }

  const me = id;
  await sql.transaction([
    // dati personali dell'agente
    sql`DELETE FROM daily_agent_stats WHERE agent_id = ${me}::uuid`,
    sql`DELETE FROM calendar_events WHERE agent_id = ${me}::uuid`,
    sql`DELETE FROM customer_agents WHERE agent_id = ${me}::uuid`,
    sql`DELETE FROM lead_events WHERE agent_id = ${me}::uuid`,
    sql`UPDATE leads SET assigned_to = NULL, assigned_at = NULL WHERE assigned_to = ${me}::uuid`,
    // dove compariva solo come autore: resta il dato, senza il nome
    sql`UPDATE leads SET corrected_by = NULL WHERE corrected_by = ${me}::uuid`,
    sql`UPDATE lead_lists SET uploaded_by = NULL WHERE uploaded_by = ${me}::uuid`,
    sql`UPDATE customers SET created_by = NULL WHERE created_by = ${me}::uuid`,
    sql`UPDATE customer_notes SET author_id = NULL WHERE author_id = ${me}::uuid`,
    sql`UPDATE customer_history SET actor_id = NULL WHERE actor_id = ${me}::uuid`,
    sql`UPDATE secretary_tasks SET created_by = NULL WHERE created_by = ${me}::uuid`,
    sql`UPDATE secretary_tasks SET closed_by = NULL WHERE closed_by = ${me}::uuid`,
    sql`UPDATE daily_agent_stats SET entered_by = NULL WHERE entered_by = ${me}::uuid`,
    sql`UPDATE calendar_events SET manager_id = NULL WHERE manager_id = ${me}::uuid`,
    sql`UPDATE calendar_events SET created_by = NULL WHERE created_by = ${me}::uuid`,
    sql`UPDATE audit_logs SET actor_id = NULL WHERE actor_id = ${me}::uuid`,
    sql`UPDATE privacy_requests SET sent_by = NULL WHERE sent_by = ${me}::uuid`,
    sql`UPDATE customer_agents SET added_by = NULL WHERE added_by = ${me}::uuid`,
    sql`DELETE FROM users WHERE id = ${me}::uuid`,
  ]);

  await logAudit(user.id, "agente_eliminato", "users", null, { nome: `${target.first_name} ${target.last_name}`, role: target.role });
  return json(200, { ok: true });
});
