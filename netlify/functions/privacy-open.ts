import type { HandlerResponse } from "@netlify/functions";
import { json, logAudit, requireUser, route, sql } from "./_shared/auth";
import { canViewCustomer, UUID_RE } from "./_shared/customers";
import { downloadFile } from "./_shared/drive";

// Apre il PDF dell'informativa firmata (dal Drive), solo a chi puo' vedere il cliente
export const handler = route("GET", async (event) => {
  const auth = await requireUser(event, ["customers.view_own", "customers.view_all"]);
  if ("response" in auth) return auth.response;
  const { user } = auth;

  const id = event.queryStringParameters?.id ?? "";
  if (!UUID_RE.test(id)) return json(400, { error: "Documento non valido" });
  const row = (
    await sql`
      SELECT r.drive_file_id, r.customer_id, c.agent_id,
             (SELECT coalesce(array_agg(sa.agent_id::text), '{}') FROM customer_agents sa WHERE sa.customer_id = c.id) AS shared_ids
      FROM privacy_requests r JOIN customers c ON c.id = r.customer_id
      WHERE r.id = ${id} AND r.status = 'firmata'`
  )[0];
  if (!row || !row.drive_file_id || !canViewCustomer(user, row.agent_id, row.shared_ids)) return json(404, { error: "Documento non trovato" });

  const data = await downloadFile(row.drive_file_id);
  await logAudit(user.id, "privacy_aperta", "customers", row.customer_id);
  const response: HandlerResponse = {
    statusCode: 200,
    isBase64Encoded: true,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": 'inline; filename="Informativa privacy firmata.pdf"',
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
    body: data.toString("base64"),
  };
  return response;
});
