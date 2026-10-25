import { createHash } from "node:crypto";
import { json, logAudit, parseBody, requireUser, route, sql } from "./_shared/auth";
import { addHistory, canEditCustomer, canViewCustomer, UUID_RE } from "./_shared/customers";
import { deleteFile, driveConfigured, ensureCustomerFolder, uploadPdf } from "./_shared/drive";

const MAX_BYTES = 4 * 1024 * 1024;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// Registra un'informativa gia' firmata altrove (carta o altro sistema), caricando il PDF
export const handler = route("POST", async (event) => {
  const auth = await requireUser(event, ["customers.edit_own", "customers.edit_all"]);
  if ("response" in auth) return auth.response;
  const { user } = auth;
  if (!driveConfigured()) return json(503, { error: "Google Drive non è ancora configurato su Netlify" });

  const body = parseBody(event);
  const customerId = String(body.customer_id ?? "");
  const signedAt = String(body.signed_at ?? "");
  if (!UUID_RE.test(customerId)) return json(400, { error: "Cliente non valido" });
  if (!DATE_RE.test(signedAt) || signedAt > new Date().toISOString().slice(0, 10)) {
    return json(400, { error: "Data di firma non valida" });
  }
  if (typeof body.consent_marketing !== "boolean" || typeof body.consent_third_parties !== "boolean") {
    return json(400, { error: "Indica i due consensi (consento / non consento)" });
  }
  if (body.mimeType !== "application/pdf") return json(400, { error: "Sono ammessi solo file PDF" });

  const customer = (
    await sql`SELECT id, first_name, last_name, agent_id, drive_folder_id, (SELECT coalesce(array_agg(agent_id::text), '{}') FROM customer_agents WHERE customer_id = customers.id) AS shared_ids FROM customers WHERE id = ${customerId}`
  )[0];
  if (!customer || !canViewCustomer(user, customer.agent_id, customer.shared_ids)) return json(404, { error: "Cliente non trovato" });
  if (!canEditCustomer(user, customer.agent_id, customer.shared_ids)) return json(403, { error: "Non puoi modificare questo cliente" });

  const pdf = Buffer.from(String(body.fileBase64 ?? ""), "base64");
  if (pdf.length === 0 || pdf.length > MAX_BYTES) return json(400, { error: "Il PDF deve essere al massimo di 4 MB" });
  if (pdf.subarray(0, 5).toString("latin1") !== "%PDF-") return json(400, { error: "Il file non è un PDF valido" });

  const folderId = await ensureCustomerFolder(customer, async (id) => {
    await sql`UPDATE customers SET drive_folder_id = ${id} WHERE id = ${customer.id}`;
  });
  const fullName = `${customer.first_name} ${customer.last_name}`;
  const uploaded = await uploadPdf(folderId, `Informativa privacy firmata - ${fullName}.pdf`, pdf);
  try {
    const when = `${signedAt}T12:00:00Z`;
    const sha = createHash("sha256").update(pdf).digest("hex");
    const rows = await sql`
      INSERT INTO privacy_requests (customer_id, method, status, template_rev, sent_by, signed_at, signer_name,
                                    consent_marketing, consent_third_parties, drive_file_id, drive_link, document_sha256)
      VALUES (${customerId}, 'caricata', 'firmata', 'caricata', ${user.id}, ${when}::timestamptz, ${fullName},
              ${body.consent_marketing}, ${body.consent_third_parties}, ${uploaded.fileId}, ${uploaded.link}, ${sha})
      RETURNING id`;
    // I consensi in scheda seguono la firma piu' recente
    await sql`
      UPDATE customers SET privacy_marketing = ${body.consent_marketing}, privacy_third_parties = ${body.consent_third_parties},
             privacy_signed_at = ${when}::timestamptz
      WHERE id = ${customerId} AND (privacy_signed_at IS NULL OR privacy_signed_at <= ${when}::timestamptz)`;
    await addHistory(customerId, user.id, "privacy_caricata", `Informativa privacy firmata caricata (firma del ${signedAt})`);
    await logAudit(user.id, "privacy_caricata", "customers", customerId, { signed_at: signedAt });
    return json(200, { id: rows[0].id });
  } catch (error) {
    await deleteFile(uploaded.fileId);
    throw error;
  }
});
