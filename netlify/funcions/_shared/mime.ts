import { randomBytes } from "node:crypto";

const clean = (value: string) => value.replace(/[\r\n]+/g, " ").trim();
const encodeHeader = (value: string) => `=?UTF-8?B?${Buffer.from(clean(value), "utf8").toString("base64")}?=`;
const wrap76 = (b64: string) => b64.replace(/(.{76})/g, "$1\r\n");

export type MailInput = {
  to: string;
  subject: string;
  text: string;
  html: string;
  attachment?: { filename: string; content: Buffer; mimeType: string };
};

export function buildMime(input: MailInput, fromAddress: string, fromName: string): string {
  const mixed = "m" + randomBytes(12).toString("hex");
  const alt = "a" + randomBytes(12).toString("hex");
  const lines: string[] = [
    `From: ${encodeHeader(fromName)} <${clean(fromAddress)}>`,
    `To: ${clean(input.to)}`,
    `Subject: ${encodeHeader(input.subject)}`,
    "MIME-Version: 1.0",
    `Content-Type: multipart/${input.attachment ? "mixed" : "alternative"}; boundary="${input.attachment ? mixed : alt}"`,
    "",
  ];
  if (input.attachment) lines.push(`--${mixed}`, `Content-Type: multipart/alternative; boundary="${alt}"`, "");
  lines.push(
    `--${alt}`,
    'Content-Type: text/plain; charset="UTF-8"',
    "Content-Transfer-Encoding: base64",
    "",
    wrap76(Buffer.from(input.text, "utf8").toString("base64")),
    `--${alt}`,
    'Content-Type: text/html; charset="UTF-8"',
    "Content-Transfer-Encoding: base64",
    "",
    wrap76(Buffer.from(input.html, "utf8").toString("base64")),
    `--${alt}--`,
  );
  if (input.attachment) {
    lines.push(
      `--${mixed}`,
      `Content-Type: ${input.attachment.mimeType}; name="${clean(input.attachment.filename)}"`,
      "Content-Transfer-Encoding: base64",
      `Content-Disposition: attachment; filename="${clean(input.attachment.filename)}"`,
      "",
      wrap76(input.attachment.content.toString("base64")),
      `--${mixed}--`,
    );
  }
  return lines.join("\r\n");
}

