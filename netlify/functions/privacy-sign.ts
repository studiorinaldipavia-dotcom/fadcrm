import { createHash } from "node:crypto";
import { clientIp, json, logAudit, parseBody, route, sql } from "./_shared/auth";
import { deleteFile, driveConfigured, ensureCustomerFolder, uploadPdf } from "./_shared/drive";
import { mailConfigured, sendMail } from "./_shared/mail";
import { buildPrivacyPdf, formatRomeLong, privacyCode } from "./_shared/privacyPdf";
import { PRIVACY_REV } from "./_shared/privacyText";

// Pubblico (senza login): il cliente firma. Si registrano data, ora e indirizzo IP.
export const handler = route("POST", async (event) => {
  const body = parseBody(event);
  const token = String(body.token ?? "");
  const marketing = body.consent_marketing;
  const third = body.consent_third_parties;

  if (token.length < 20 || token.length > 100) return json(400, { error: "Link non valido" });
  if (typeof marketing !== "boolean" || typeof third !== "boolean") {
    return json(400, { error: "Indica «Consento» oppure «Non consento» per entrambi i consensi" });
  }
  if (body.accept !== true) return json(400, { error: "Conferma di aver letto l'informativa" });

  if (!driveConfigured()) return json(503, { error: "Servizio momentaneamente non disponibile. Riprova più tardi." });

  const hash = createHash("sha256").update(token).digest("hex");
  const ip = clientIp(event);
  const userAgent = String(event.headers["user-agent"] ?? "").slice(0, 300);

  // "Prenota" la firma: un link si puo' usare una sola volta
  const claimed = await sql`
    UPDATE privacy_requests
    SET status = 'firmata', signed_at = now(), signer_ip = ${ip}, signer_user_agent = ${userAgent},
        consent_marketing = ${marketing}, consent_third_parties = ${third}
    WHERE token_hash = ${hash} AND status = 'inviata' AND expires_at > now()
    RETURNING id, customer_id, signed_at`;
  if (claimed.length === 0) return json(409, { error: "Questo link non è più valido o è già stato usato" });
  const request = claimed[0];

  let uploadedId: string | null = null;
  try {
    const customer = (
      await sql`SELECT id, first_name, last_name, email, phone, fiscal_code, drive_folder_id FROM customers WHERE id = ${request.customer_id}`
    )[0];
    const fullName = `${customer.first_name} ${customer.last_name}`;

    const pdf = await buildPrivacyPdf({
      person: {
        first_name: customer.first_name,
        last_name: customer.last_name,
        fiscal_code: customer.fiscal_code ?? "",
        contact: [customer.phone, customer.email].filter(Boolean).join(" / "),
      },
      consentMarketing: marketing,
      consentThird: third,
      code: privacyCode(request.id as string),
      signedAt: new Date(request.signed_at),
      signerName: fullName,
      ip,
    });
    const sha = createHash("sha256").update(pdf).digest("hex");

    const folderId = await ensureCustomerFolder(customer, async (id) => {
      await sql`UPDATE customers SET drive_folder_id = ${id} WHERE id = ${customer.id}`;
    });
    const uploaded = await uploadPdf(folderId, `Informativa privacy confermata - ${fullName}.pdf`, pdf);
    uploadedId = uploaded.fileId;

    await sql`
      UPDATE privacy_requests
      SET signer_name = ${fullName}, signer_fiscal_code = ${customer.fiscal_code}, template_rev = ${PRIVACY_REV},
          drive_file_id = ${uploaded.fileId}, drive_link = ${uploaded.link}, document_sha256 = ${sha}
      WHERE id = ${request.id}`;
    await sql`
      UPDATE customers SET privacy_marketing = ${marketing}, privacy_third_parties = ${third},
             privacy_signed_at = ${request.signed_at}
      WHERE id = ${customer.id}`;
    await sql`
      INSERT INTO customer_history (customer_id, actor_id, event_type, description)
      VALUES (${customer.id}, NULL, 'privacy_firmata',
              ${`Informativa privacy firmata dal cliente (marketing: ${marketing ? "consente" : "non consente"}, cessione a terzi: ${third ? "consente" : "non consente"})`})`;
    await logAudit(null, "privacy_firmata", "customers", customer.id, { ip, marketing, third });

    // Copia del documento firmato al cliente (se l'invio fallisce, la firma resta valida)
    if (customer.email && mailConfigured()) {
      try {
        await sendMail({
          to: customer.email,
          subject: "Copia dell'informativa privacy firmata",
          text: `Gentile ${fullName},\n\nin allegato la copia dell'informativa privacy firmata.\n\nF.A.D. SRL`,
          html: `<p style="font-family:Arial,sans-serif;font-size:15px">Gentile ${fullName.replace(/[<>&]/g, "")},<br><br>in allegato la copia dell'informativa privacy firmata.<br><br>F.A.D. SRL</p>`,
          attachment: { filename: "Informativa privacy firmata.pdf", content: pdf, mimeType: "application/pdf" },
        });
      } catch (error) {
        console.error("copia al cliente non inviata", error);
      }
    }
    return json(200, { ok: true, code: privacyCode(request.id as string), when: formatRomeLong(new Date(request.signed_at)) });
  } catch (error) {
    // Qualcosa e' andato storto dopo la prenotazione: il link torna utilizzabile
    if (uploadedId) await deleteFile(uploadedId);
    await sql`
      UPDATE privacy_requests
      SET status = 'inviata', signed_at = NULL, signer_ip = NULL, signer_user_agent = NULL,
          consent_marketing = NULL, consent_third_parties = NULL, drive_file_id = NULL, drive_link = NULL, document_sha256 = NULL
      WHERE id = ${request.id}`;
    throw error;
  }
});
