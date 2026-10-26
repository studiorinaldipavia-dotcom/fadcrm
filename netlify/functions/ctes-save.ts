import { json, logAudit, parseBody, requireUser, route, sql } from "./_shared/auth";
import { UUID_RE } from "./_shared/customers";
import { parseMoney } from "./_shared/ctes";

// Azioni: create | update | delete. Solo chi gestisce i prodotti (amministratore).
export const handler = route("POST", async (event) => {
  const auth = await requireUser(event, ["products.manage"]);
  if ("response" in auth) return auth.response;

  const body = parseBody(event);

  if (body.action === "delete") {
    const id = String(body.id ?? "");
    if (!UUID_RE.test(id)) return json(400, { error: "CTE non valida" });
    const rows = await sql`DELETE FROM product_ctes WHERE id = ${id} RETURNING product_id, title`;
    if (rows.length === 0) return json(404, { error: "CTE non trovata" });
    await logAudit(auth.user.id, "cte_eliminata", "product_ctes", id, { title: rows[0].title });
    return json(200, { ok: true });
  }

  if (body.action !== "create" && body.action !== "update") return json(400, { error: "Azione non valida" });

  const title = String(body.title ?? "").trim().slice(0, 80);
  const notes = String(body.notes ?? "").trim().slice(0, 1000) || null;
  const isActive = body.is_active !== false;
  const sortOrder = Number.isInteger(Number(body.sort_order)) ? Math.min(Math.max(Number(body.sort_order), 0), 999) : 0;
  if (!title) return json(400, { error: "Il titolo della CTE è obbligatorio" });

  const cost = parseMoney(body.cost, 2);
  const fixedCost = parseMoney(body.fixed_cost, 2);
  const kwhCost = parseMoney(body.kwh_cost, 6, 1000);
  const smcCost = parseMoney(body.smc_cost, 6, 1000);
  if ([cost, fixedCost, kwhCost, smcCost].includes("invalid")) {
    return json(400, { error: "I costi devono essere numeri positivi (es. 0,1234)" });
  }

  if (body.action === "create") {
    const productId = String(body.product_id ?? "");
    if (!UUID_RE.test(productId)) return json(400, { error: "Prodotto non valido" });
    const product = await sql`SELECT 1 FROM products WHERE id = ${productId}`;
    if (product.length === 0) return json(404, { error: "Prodotto non trovato" });
    const rows = await sql`
      INSERT INTO product_ctes (product_id, title, cost, fixed_cost, kwh_cost, smc_cost, notes, is_active, sort_order)
      VALUES (${productId}, ${title}, ${cost as number | null}, ${fixedCost as number | null}, ${kwhCost as number | null},
              ${smcCost as number | null}, ${notes}, ${isActive}, ${sortOrder})
      RETURNING id`;
    await logAudit(auth.user.id, "cte_creata", "product_ctes", rows[0].id, { title, product_id: productId });
    return json(200, { id: rows[0].id });
  }

  const id = String(body.id ?? "");
  if (!UUID_RE.test(id)) return json(400, { error: "CTE non valida" });
  const rows = await sql`
    UPDATE product_ctes SET title = ${title}, cost = ${cost as number | null}, fixed_cost = ${fixedCost as number | null},
           kwh_cost = ${kwhCost as number | null}, smc_cost = ${smcCost as number | null}, notes = ${notes},
           is_active = ${isActive}, sort_order = ${sortOrder}, updated_at = now()
    WHERE id = ${id} RETURNING id`;
  if (rows.length === 0) return json(404, { error: "CTE non trovata" });
  await logAudit(auth.user.id, "cte_modificata", "product_ctes", id, { title, is_active: isActive });
  return json(200, { ok: true });
});
