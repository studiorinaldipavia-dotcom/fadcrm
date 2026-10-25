import { json, logAudit, parseBody, requireUser, route, sql } from "./_shared/auth";
import { UUID_RE } from "./_shared/customers";

// Azioni: create | update
export const handler = route("POST", async (event) => {
  const auth = await requireUser(event, ["settings.manage"]);
  if ("response" in auth) return auth.response;

  const body = parseBody(event);
  const name = String(body.name ?? "").trim().slice(0, 60);
  const city = String(body.city ?? "").trim().slice(0, 60) || null;
  if (!name) return json(400, { error: "Il nome dell'ufficio è obbligatorio" });

  if (body.action === "create") {
    const clash = await sql`SELECT 1 FROM offices WHERE lower(name) = ${name.toLowerCase()}`;
    if (clash.length > 0) return json(409, { error: "Esiste già un ufficio con questo nome" });
    const rows = await sql`INSERT INTO offices (name, city) VALUES (${name}, ${city}) RETURNING id`;
    await logAudit(auth.user.id, "ufficio_creato", "offices", rows[0].id, { name });
    return json(200, { id: rows[0].id });
  }
  if (body.action === "update") {
    const id = String(body.id ?? "");
    if (!UUID_RE.test(id)) return json(400, { error: "Ufficio non valido" });
    const clash = await sql`SELECT 1 FROM offices WHERE lower(name) = ${name.toLowerCase()} AND id <> ${id}`;
    if (clash.length > 0) return json(409, { error: "Esiste già un ufficio con questo nome" });
    await sql`UPDATE offices SET name = ${name}, city = ${city} WHERE id = ${id}`;
    await logAudit(auth.user.id, "ufficio_modificato", "offices", id, { name });
    return json(200, { ok: true });
  }
  return json(400, { error: "Azione non valida" });
});
