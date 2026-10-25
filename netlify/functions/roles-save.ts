import { json, logAudit, parseBody, requireUser, route, sql } from "./_shared/auth";

const slug = (label: string) =>
  label
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 30);

// Ruoli personalizzabili: crea, rinomina, cambia i permessi, elimina. Solo con "roles.manage".
export const handler = route("POST", async (event) => {
  const auth = await requireUser(event, ["roles.manage"]);
  if ("response" in auth) return auth.response;
  const { user } = auth;

  const body = parseBody(event);
  const action = String(body.action ?? "");
  const key = String(body.key ?? "");

  /* ----- NUOVO RUOLO ----- */
  if (action === "create") {
    const label = String(body.label ?? "").trim().slice(0, 40);
    const newKey = slug(label);
    if (label.length < 2 || newKey.length < 2) return json(400, { error: "Scrivi il nome del ruolo (almeno 2 lettere)" });
    if ((await sql`SELECT 1 FROM roles WHERE key = ${newKey}`).length > 0) return json(409, { error: "Esiste già un ruolo con questo nome" });
    await sql`INSERT INTO roles (key, label, is_system) VALUES (${newKey}, ${label}, false)`;

    // si parte da una copia di un ruolo esistente (permessi), poi si personalizza
    const from = String(body.copy_from ?? "");
    if (from && (await sql`SELECT 1 FROM roles WHERE key = ${from}`).length > 0) {
      if (from !== "amministratore" || body.copy_admin === true) {
        await sql`INSERT INTO role_permissions (role, permission_key)
                  SELECT ${newKey}, permission_key FROM role_permissions
                  WHERE role = ${from} AND permission_key NOT IN ('roles.manage', 'agents.delete')`;
      }
    }
    await logAudit(user.id, "ruolo_creato", "roles", null, { key: newKey, label, copy_from: from || null });
    return json(200, { ok: true, key: newKey });
  }

  const role = (await sql`SELECT key, is_system FROM roles WHERE key = ${key}`)[0];
  if (!role) return json(404, { error: "Ruolo non trovato" });

  /* ----- RINOMINA / LISTINO ----- */
  if (action === "update") {
    const label = String(body.label ?? "").trim().slice(0, 40);
    if (label.length < 2) return json(400, { error: "Scrivi il nome del ruolo" });
    await sql`UPDATE roles SET label = ${label} WHERE key = ${key}`;
    await logAudit(user.id, "ruolo_modificato", "roles", null, { key, label });
    return json(200, { ok: true });
  }

  /* ----- PERMESSI DEL RUOLO ----- */
  if (action === "set_permissions") {
    if (key === "amministratore") return json(400, { error: "L'amministratore ha sempre tutti i permessi" });
    const wanted: string[] = Array.isArray(body.permissions) ? body.permissions.map(String) : [];
    const valid = await sql`SELECT key FROM permissions WHERE key = ANY(${wanted}::text[])`;
    const keys = valid.map((r) => r.key as string);
    await sql.transaction([
      sql`DELETE FROM role_permissions WHERE role = ${key}`,
      sql`INSERT INTO role_permissions (role, permission_key) SELECT ${key}, k FROM unnest(${keys}::text[]) AS k`,
    ]);
    await logAudit(user.id, "ruolo_permessi_modificati", "roles", null, { key, total: keys.length });
    return json(200, { ok: true });
  }

  /* ----- ELIMINA ----- */
  if (action === "delete") {
    if (role.is_system) return json(400, { error: "I ruoli di base non si possono eliminare" });
    const used = await sql`SELECT count(*)::int AS n FROM users WHERE role = ${key}`;
    if (used[0].n > 0) return json(409, { error: `Ci sono ${used[0].n} persone con questo ruolo: cambia prima il loro ruolo` });
    await sql`DELETE FROM roles WHERE key = ${key}`;
    await logAudit(user.id, "ruolo_eliminato", "roles", null, { key });
    return json(200, { ok: true });
  }

  return json(400, { error: "Azione non valida" });
});
