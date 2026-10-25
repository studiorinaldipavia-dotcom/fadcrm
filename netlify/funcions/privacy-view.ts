import { createHash } from "node:crypto";
import { json, parseBody, route, sql } from "./_shared/auth";
import { privacyBlocks } from "./_shared/privacyText";

// Pubblico (senza login): il cliente apre il suo link personale e legge l'informativa
export const handler = route("POST", async (event) => {
  const token = String(parseBody(event).token ?? "");
  if (token.length < 20 || token.length > 100) return json(200, { state: "invalid" });
  const hash = createHash("sha256").update(token).digest("hex");

  const row = (
    await sql`
      SELECT r.status, (r.expires_at < now()) AS expired, c.first_name, c.last_name, c.fiscal_code, c.email, c.phone
      FROM privacy_requests r JOIN customers c ON c.id = r.customer_id WHERE r.token_hash = ${hash}`
  )[0];
  if (!row) return json(200, { state: "invalid" });
  if (row.status === "firmata") return json(200, { state: "signed" });
  if (row.status === "annullata") return json(200, { state: "replaced" });
  if (row.expired) return json(200, { state: "expired" });

  const contact = [row.phone, row.email].filter(Boolean).join(" / ");
  return json(200, {
    state: "pending",
    name: `${row.first_name} ${row.last_name}`,
    blocks: privacyBlocks({
      first_name: row.first_name,
      last_name: row.last_name,
      fiscal_code: row.fiscal_code ?? "",
      contact,
    }),
  });
});
