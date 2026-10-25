import { createHash, randomBytes } from "node:crypto";
import { json, logAudit, parseBody, requireUser, route, sql } from "./_shared/auth";
import { addHistory, canEditCustomer, canViewCustomer, UUID_RE } from "./_shared/customers";
import { mailConfigured, sendMail } from "./_shared/mail";
import { PRIVACY_REV } from "./_shared/privacyText";

const esc = (value: string) =>
  value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DAYS = 14;

const siteUrl = (host?: string) =>
  (process.env.SITE_URL || process.env.URL || `https://${host ?? ""}`).replace(/\/+$/, "");

// Prepara il link personale di firma e, se richiesto, lo invia per email al cliente
export const handler = route("POST", async (event) => {
  const auth = await requireUser(event, ["customers.edit_own", "customers.edit_all"]);
  if ("response" in auth) return auth.response;
  const { user } = auth;

  const body = parseBody(event);
  const customerId = String(body.customer_id ?? "");
  const mode = body.mode === "link" ? "link" : "email";
  if (!UUID_RE.test(customerId)) return json(400, { error: "Cliente non valido" });

  const customer = (
    await sql`SELECT id, first_name, last_name, email, phone, fiscal_code, agent_id, (SELECT coalesce(array_agg(agent_id::text), '{}') FROM customer_agents WHERE customer_id = customers.id) AS shared_ids FROM customers WHERE id = ${customerId}`
  )[0];
  if (!customer || !canViewCustomer(user, customer.agent_id, customer.shared_ids)) return json(404, { error: "Cliente non trovato" });
  if (!canEditCustomer(user, customer.agent_id, customer.shared_ids)) return json(403, { error: "Non puoi modificare questo cliente" });

  if (!customer.fiscal_code) {
    return json(400, { error: "Inserisci il codice fiscale del cliente (Modifica cliente) prima di inviare l'informativa" });
  }
  if (!customer.email && !customer.phone) {
    return json(400, { error: "Il cliente non ha né email né telefono: aggiungine almeno uno" });
  }
  if (mode === "email") {
    if (!customer.email || !EMAIL_RE.test(customer.email)) {
      return json(400, { error: "Aggiungi l'email del cliente (Modifica cliente) per inviare l'informativa" });
    }
    if (!mailConfigured()) {
      return json(503, { error: "L'invio email non è ancora configurato su Netlify. Usa «Copia link» oppure configura l'email." });
    }
  }

  const recent = await sql`
    SELECT 1 FROM privacy_requests
    WHERE customer_id = ${customerId} AND status = 'inviata' AND created_at > now() - interval '60 seconds'`;
  if (recent.length > 0) return json(429, { error: "Informativa appena inviata: attendi un minuto prima di riprovare" });

  // Il nuovo link sostituisce quelli precedenti ancora in attesa
  await sql`UPDATE privacy_requests SET status = 'annullata' WHERE customer_id = ${customerId} AND status = 'inviata'`;

  const token = randomBytes(32).toString("base64url");
  const hash = createHash("sha256").update(token).digest("hex");
  const rows = await sql`
    INSERT INTO privacy_requests (customer_id, token_hash, email, template_rev, sent_by, expires_at)
    VALUES (${customerId}, ${hash}, ${customer.email}, ${PRIVACY_REV}, ${user.id}, now() + make_interval(days => ${DAYS}))
    RETURNING id`;
  const link = `${siteUrl(event.headers["host"])}/#firma=${token}`;

  if (mode === "email") {
    const name = `${customer.first_name} ${customer.last_name}`;
    try {
      await sendMail({
        to: customer.email,
        subject: "Informativa privacy da firmare - F.A.D. SRL",
        text:
          `Gentile ${name},\n\nper completare la sua pratica la invitiamo a leggere e firmare online l'informativa sul trattamento dei dati personali di F.A.D. SRL. Richiede circa due minuti.\n\n` +
          `Apra questo link personale (valido ${DAYS} giorni):\n${link}\n\n` +
          `Se non si aspettava questo messaggio, lo ignori.\n\nF.A.D. SRL`,
        html:
          `<div style="font-family:Arial,sans-serif;font-size:15px;color:#171716;max-width:520px">` +
          `<p>Gentile ${esc(name)},</p>` +
          `<p>per completare la sua pratica la invitiamo a leggere e firmare online l'informativa sul trattamento dei dati personali di F.A.D. SRL. Richiede circa due minuti.</p>` +
          `<p style="margin:26px 0"><a href="${esc(link)}" style="background:#f36a21;color:#fff;padding:13px 22px;border-radius:8px;text-decoration:none;font-weight:bold">Leggi e firma l'informativa</a></p>` +
          `<p style="font-size:13px;color:#60605b">Il link è personale e valido ${DAYS} giorni. Se non si aspettava questo messaggio, lo ignori.</p>` +
          `<p style="font-size:13px;color:#60605b">F.A.D. SRL</p></div>`,
      });
    } catch (error) {
      console.error(error);
      await sql`UPDATE privacy_requests SET status = 'annullata' WHERE id = ${rows[0].id}`;
      return json(502, { error: "Invio email non riuscito. Controlla la configurazione oppure usa «Copia link»." });
    }
  }

  await addHistory(
    customerId,
    user.id,
    "privacy_inviata",
    mode === "email" ? `Informativa privacy inviata a ${customer.email}` : "Link di firma dell'informativa privacy generato",
  );
  await logAudit(user.id, "privacy_inviata", "customers", customerId, { mode });
  return json(200, { link, emailed: mode === "email", email: customer.email });
});
