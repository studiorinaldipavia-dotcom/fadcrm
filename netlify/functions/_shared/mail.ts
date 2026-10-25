import { google } from "googleapis";
import { buildMime, type MailInput } from "./mime";

export type { MailInput };

// L'invio email puo' passare da tre strade (variabile MAIL_PROVIDER, oppure automatico):
//  - "resend": servizio gratuito (3.000 email/mese, max 100 al giorno) con il TUO dominio (es. privacy@fad.it)
//  - "brevo":  servizio gratuito (300 email al giorno) con il TUO dominio
//  - "gmail":  account Google aziendale tramite Gmail API (il mittente e' l'account Google)
// Se MAIL_PROVIDER non c'e': usa Resend se c'e' RESEND_API_KEY, Brevo se c'e' BREVO_API_KEY, altrimenti Gmail.
type Provider = "resend" | "brevo" | "gmail";

function provider(): Provider {
  const wanted = (process.env.MAIL_PROVIDER ?? "").toLowerCase();
  if (wanted === "resend" || wanted === "brevo" || wanted === "gmail") return wanted;
  if (process.env.RESEND_API_KEY) return "resend";
  if (process.env.BREVO_API_KEY) return "brevo";
  return "gmail";
}

export function mailConfigured(): boolean {
  if (!process.env.MAIL_FROM_ADDRESS) return false;
  switch (provider()) {
    case "resend":
      return Boolean(process.env.RESEND_API_KEY);
    case "brevo":
      return Boolean(process.env.BREVO_API_KEY);
    default:
      return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET && process.env.GOOGLE_REFRESH_TOKEN);
  }
}

const fromName = () => (process.env.MAIL_FROM_NAME || "F.A.D. SRL").replace(/[\r\n"<>]+/g, " ").trim();
const replyTo = () => (process.env.MAIL_REPLY_TO || "").trim() || undefined;

async function failIfNotOk(res: Response, who: string) {
  if (res.ok) return;
  // si registra solo l'esito (mai la chiave): il dettaglio aiuta a capire se manca la verifica del dominio
  const detail = (await res.text().catch(() => "")).slice(0, 300);
  throw new Error(`${who}: invio rifiutato (${res.status}) ${detail}`);
}

export async function sendMail(input: MailInput): Promise<void> {
  const kind = provider();

  if (kind === "resend") {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: `${fromName()} <${process.env.MAIL_FROM_ADDRESS}>`,
        to: [input.to],
        subject: input.subject,
        html: input.html,
        text: input.text,
        ...(replyTo() ? { reply_to: replyTo() } : {}),
        ...(input.attachment ? { attachments: [{ filename: input.attachment.filename, content: input.attachment.content.toString("base64") }] } : {}),
      }),
    });
    return failIfNotOk(res, "Resend");
  }

  if (kind === "brevo") {
    const res = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: { "api-key": process.env.BREVO_API_KEY!, "Content-Type": "application/json", accept: "application/json" },
      body: JSON.stringify({
        sender: { name: fromName(), email: process.env.MAIL_FROM_ADDRESS },
        to: [{ email: input.to }],
        subject: input.subject,
        htmlContent: input.html,
        textContent: input.text,
        ...(replyTo() ? { replyTo: { email: replyTo() } } : {}),
        ...(input.attachment ? { attachment: [{ name: input.attachment.filename, content: input.attachment.content.toString("base64") }] } : {}),
      }),
    });
    return failIfNotOk(res, "Brevo");
  }

  const oauth = new google.auth.OAuth2(process.env.GOOGLE_CLIENT_ID, process.env.GOOGLE_CLIENT_SECRET);
  oauth.setCredentials({ refresh_token: process.env.GOOGLE_REFRESH_TOKEN });
  const gmail = google.gmail({ version: "v1", auth: oauth });
  const raw = Buffer.from(buildMime(input, process.env.MAIL_FROM_ADDRESS!, fromName()), "utf8").toString("base64url");
  await gmail.users.messages.send({ userId: "me", requestBody: { raw } });
}
