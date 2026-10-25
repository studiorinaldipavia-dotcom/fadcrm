import { json, logAudit, parseBody, requireUser, route, sql } from "./_shared/auth";
import { UUID_RE } from "./_shared/customers";

// Azioni: create | update (anche per attivare/disattivare). I prodotti non si cancellano: si disattivano.
export const handler = route("POST", async (event) => {
  const auth = await requireUser(event, ["products.manage"]);
  if ("response" in auth) return auth.response;

  const body = parseBody(event);
  const name = String(body.name ?? "").trim().slice(0, 60);
  const category = String(body.category ?? "").trim().slice(0, 40) || null;
  const description = String(body.description ?? "").trim().slice(0, 300) || null;
  const isActive = body.is_active !== false;
  const sortOrder = Number.isInteger(Number(body.sort_order)) ? Math.min(Math.max(Number(body.sort_order), 0), 999) : 0;
  if (!name) return json(400, { error: "Il nome del prodotto è obbligatorio" });

  if (body.action === "create") {
    const clash = await sql`SELECT 1 FROM products WHERE lower(name) = ${name.toLowerCase()}`;
    if (clash.length > 0) return json(409, { error: "Esiste già un prodotto con questo nome" });
    const rows = await sql`
      INSERT INTO products (name, category, description, is_active, sort_order)
      VALUES (${name}, ${category}, ${description}, ${isActive}, ${sortOrder}) RETURNING id`;
    await logAudit(auth.user.id, "prodotto_creato", "products", rows[0].id, { name });
    return json(200, { id: rows[0].id });
  }
  if (body.action === "update") {
    const id = String(body.id ?? "");
    if (!UUID_RE.test(id)) return json(400, { error: "Prodotto non valido" });
    const clash = await sql`SELECT 1 FROM products WHERE lower(name) = ${name.toLowerCase()} AND id <> ${id}`;
    if (clash.length > 0) return json(409, { error: "Esiste già un prodotto con questo nome" });
    await sql`
      UPDATE products SET name = ${name}, category = ${category}, description = ${description},
             is_active = ${isActive}, sort_order = ${sortOrder} WHERE id = ${id}`;
    await logAudit(auth.user.id, "prodotto_modificato", "products", id, { name, is_active: isActive });
    return json(200, { ok: true });
  }
  return json(400, { error: "Azione non valida" });
});
