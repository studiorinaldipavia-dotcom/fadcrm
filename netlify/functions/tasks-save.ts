import { json, logAudit, parseBody, requireUser, route, sql } from "./_shared/auth";
import { addHistory, UUID_RE } from "./_shared/customers";
import { notify } from "./_shared/notifications";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const readDate = (value: unknown): string | null | "invalid" => {
  const text = String(value ?? "").trim();
  if (!text) return null;
  if (!DATE_RE.test(text) || isNaN(new Date(text + "T12:00:00Z").getTime())) return "invalid";
  return text;
};

// Azioni: create | update | complete | lost | reopen | delete
//  - create / update / reopen / delete: solo chi ha "tasks.manage" (segreteria, amministratore)
//  - complete / lost: la segreteria su qualsiasi task, l'agente solo su quelle assegnate a lui
export const handler = route("POST", async (event) => {
  const auth = await requireUser(event, ["tasks.manage", "tasks.view_own"]);
  if ("response" in auth) return auth.response;
  const { user } = auth;
  const manage = user.permissions.includes("tasks.manage");

  const body = parseBody(event);
  const action = String(body.action ?? "");
  const myName = `${user.first_name} ${user.last_name}`;

  /* ----- NUOVA TASK ----- */
  if (action === "create") {
    if (!manage) return json(403, { error: "Non hai il permesso di creare task" });
    const kind = String(body.kind ?? "");
    if (kind !== "ko" && kind !== "manuale") return json(400, { error: "Tipo di task non valido" });
    const customerId = String(body.customer_id ?? "");
    const agentId = String(body.agent_id ?? "");
    if (!UUID_RE.test(customerId)) return json(400, { error: "Scegli il cliente" });
    if (!UUID_RE.test(agentId)) return json(400, { error: "Scegli l'agente a cui assegnarla" });

    const details = String(body.details ?? "").trim().slice(0, 1000) || null;
    const title = (String(body.title ?? "").trim() || (kind === "ko" ? "KO da recuperare" : "")).slice(0, 120);
    if (!title) return json(400, { error: "Scrivi cosa deve fare l'agente" });
    if (kind === "ko" && !details) return json(400, { error: "Per un KO scrivi il motivo" });
    const due = readDate(body.due_date);
    if (due === "invalid") return json(400, { error: "Data di scadenza non valida" });

    const customer = (await sql`SELECT id, first_name, last_name, agent_id FROM customers WHERE id = ${customerId}::uuid`)[0];
    if (!customer) return json(404, { error: "Cliente non trovato" });

    // l'agente deve essere uno di quelli del cliente (responsabile o aggiunto) e attivo
    const linked = await sql`
      SELECT u.id FROM users u
      WHERE u.id = ${agentId}::uuid AND u.status = 'attivo'
        AND (u.id = ${customer.agent_id}::uuid OR EXISTS (SELECT 1 FROM customer_agents sa WHERE sa.customer_id = ${customerId}::uuid AND sa.agent_id = u.id))`;
    if (linked.length === 0) return json(400, { error: "L'agente scelto non è collegato a questo cliente" });

    const rows = await sql`
      INSERT INTO secretary_tasks (kind, customer_id, agent_id, title, details, due_date, created_by)
      VALUES (${kind}, ${customerId}::uuid, ${agentId}::uuid, ${title}, ${details}, ${due}::date, ${user.id}::uuid)
      RETURNING id`;
    const id = rows[0].id as string;
    const clientName = `${customer.first_name} ${customer.last_name}`;

    await addHistory(customerId, user.id, "task_creata", kind === "ko" ? `KO da recuperare: ${details}` : `Task per l'agente: ${title}`);
    await logAudit(user.id, "task_creata", "secretary_tasks", id, { kind, customer_id: customerId, agent_id: agentId });
    if (agentId !== user.id) {
      await notify([agentId], {
        kind: "task_assigned",
        title: kind === "ko" ? "KO da recuperare" : "Nuova task dalla segreteria",
        body: `${clientName}: ${kind === "ko" ? details : title}`,
        link: "Segreteria",
        ref: `task:${id}:new`,
      });
    }
    return json(200, { id });
  }

  const id = String(body.id ?? "");
  if (!UUID_RE.test(id)) return json(400, { error: "Task non valida" });
  const task = (
    await sql`
      SELECT t.id, t.kind, t.title, t.status, t.agent_id, t.created_by, t.customer_id,
             c.first_name AS cf, c.last_name AS cl
      FROM secretary_tasks t JOIN customers c ON c.id = t.customer_id WHERE t.id = ${id}::uuid`
  )[0];
  // stessa risposta se non esiste o se non e' tua: non rivela l'esistenza
  if (!task || (!manage && task.agent_id !== user.id)) return json(404, { error: "Task non trovata" });
  const clientName = `${task.cf} ${task.cl}`;

  /* ----- MODIFICA (solo task aperte) ----- */
  if (action === "update") {
    if (!manage) return json(403, { error: "Non hai il permesso di modificare le task" });
    if (task.status !== "aperta") return json(409, { error: "La task è già chiusa: riaprila per modificarla" });
    const title = String(body.title ?? "").trim().slice(0, 120);
    const details = String(body.details ?? "").trim().slice(0, 1000) || null;
    const due = readDate(body.due_date);
    if (!title) return json(400, { error: "Il titolo è obbligatorio" });
    if (task.kind === "ko" && !details) return json(400, { error: "Per un KO scrivi il motivo" });
    if (due === "invalid") return json(400, { error: "Data di scadenza non valida" });

    let agentId = task.agent_id as string;
    const wanted = String(body.agent_id ?? "");
    if (wanted && wanted !== agentId) {
      if (!UUID_RE.test(wanted)) return json(400, { error: "Agente non valido" });
      const ok = await sql`
        SELECT u.id FROM users u JOIN customers c ON c.id = ${task.customer_id}::uuid
        WHERE u.id = ${wanted}::uuid AND u.status = 'attivo'
          AND (u.id = c.agent_id OR EXISTS (SELECT 1 FROM customer_agents sa WHERE sa.customer_id = c.id AND sa.agent_id = u.id))`;
      if (ok.length === 0) return json(400, { error: "L'agente scelto non è collegato a questo cliente" });
      agentId = wanted;
    }
    await sql`UPDATE secretary_tasks SET title = ${title}, details = ${details}, due_date = ${due}::date, agent_id = ${agentId}::uuid WHERE id = ${id}::uuid`;
    if (agentId !== task.agent_id && agentId !== user.id) {
      await notify([agentId], {
        kind: "task_assigned",
        title: task.kind === "ko" ? "KO da recuperare" : "Nuova task dalla segreteria",
        body: `${clientName}: ${task.kind === "ko" ? details : title}`,
        link: "Segreteria",
        ref: `task:${id}:assigned:${Date.now()}`,
      });
    }
    await logAudit(user.id, "task_modificata", "secretary_tasks", id, {});
    return json(200, { ok: true });
  }

  /* ----- COMPLETATA (KO recuperato / task fatta) o KO NON RECUPERABILE ----- */
  if (action === "complete" || action === "lost") {
    if (task.status !== "aperta") return json(409, { error: "La task è già chiusa" });
    if (action === "lost" && task.kind !== "ko") return json(400, { error: "Solo un KO può essere segnato come non recuperabile" });
    const note = String(body.note ?? "").trim().slice(0, 500) || null;
    if (action === "lost" && !note) return json(400, { error: "Scrivi perché il KO non è recuperabile" });

    const status = action === "complete" ? "completata" : "non_recuperabile";
    await sql`
      UPDATE secretary_tasks
      SET status = ${status}, closed_note = ${note}, closed_by = ${user.id}::uuid, closed_at = now()
      WHERE id = ${id}::uuid`;

    const text =
      action === "lost"
        ? `KO non recuperabile: ${note}`
        : task.kind === "ko"
          ? `KO recuperato${note ? `: ${note}` : ""}`
          : `Task completata: ${task.title}${note ? ` (${note})` : ""}`;
    await addHistory(task.customer_id, user.id, action === "lost" ? "ko_non_recuperabile" : "task_completata", text);
    await logAudit(user.id, action === "lost" ? "ko_non_recuperabile" : "task_completata", "secretary_tasks", id, {});

    // chi ha creato la task viene avvisato quando la chiude un altro
    if (task.created_by && task.created_by !== user.id) {
      await notify([task.created_by as string], {
        kind: "task_done",
        title: action === "lost" ? "KO non recuperabile" : task.kind === "ko" ? "KO recuperato" : "Task completata",
        body: `${clientName} · ${myName}${note ? `: ${note}` : ""}`,
        link: "Segreteria",
        ref: `task:${id}:closed:${Date.now()}`,
      });
    }
    return json(200, { ok: true });
  }

  /* ----- RIAPRI ----- */
  if (action === "reopen") {
    if (!manage) return json(403, { error: "Non hai il permesso di riaprire le task" });
    if (task.status === "aperta") return json(409, { error: "La task è già aperta" });
    await sql`UPDATE secretary_tasks SET status = 'aperta', closed_note = NULL, closed_by = NULL, closed_at = NULL WHERE id = ${id}::uuid`;
    await addHistory(task.customer_id, user.id, "task_riaperta", `Task riaperta: ${task.title}`);
    await logAudit(user.id, "task_riaperta", "secretary_tasks", id, {});
    if (task.agent_id !== user.id) {
      await notify([task.agent_id as string], {
        kind: "task_assigned",
        title: task.kind === "ko" ? "KO da recuperare (riaperto)" : "Task riaperta dalla segreteria",
        body: `${clientName}: ${task.title}`,
        link: "Segreteria",
        ref: `task:${id}:reopen:${Date.now()}`,
      });
    }
    return json(200, { ok: true });
  }

  /* ----- ELIMINA ----- */
  if (action === "delete") {
    if (!manage) return json(403, { error: "Non hai il permesso di eliminare le task" });
    await sql`DELETE FROM secretary_tasks WHERE id = ${id}::uuid`;
    await sql`DELETE FROM notifications WHERE ref LIKE ${"task:" + id + ":%"}`;
    await logAudit(user.id, "task_eliminata", "secretary_tasks", id, { title: task.title });
    return json(200, { ok: true });
  }

  return json(400, { error: "Azione non valida" });
});
