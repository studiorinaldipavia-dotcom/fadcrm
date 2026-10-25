import { createHash } from "node:crypto";
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { PRIVACY_FOOTER, PRIVACY_HEADER, privacyBlocks, type PrivacyPerson } from "./privacyText";

const PAGE_W = 595.28;
const PAGE_H = 841.89;
const MARGIN_X = 50;
const TOP = PAGE_H - 92; // sotto l'intestazione
const BOTTOM = 56;
const SIZE = 8.6;
const LEADING = 11.6;

export type SignedPrivacy = {
  person: PrivacyPerson;
  consentMarketing: boolean;
  consentThird: boolean;
  code: string; // codice ID della conferma
  signedAt: Date;
  signerName: string;
  ip: string;
};

/** Codice ID breve e ripetibile della conferma (derivato dall'identificativo della richiesta) */
export function privacyCode(requestId: string): string {
  return "PRV-" + createHash("sha256").update(requestId).digest("hex").slice(0, 8).toUpperCase();
}

/** "martedì 13 ottobre 2026, ore 14:35" in ora italiana */
export function formatRomeLong(date: Date): string {
  const day = new Intl.DateTimeFormat("it-IT", { timeZone: "Europe/Rome", weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(date);
  const time = new Intl.DateTimeFormat("it-IT", { timeZone: "Europe/Rome", hour: "2-digit", minute: "2-digit" }).format(date);
  return `${day}, ore ${time}`;
}

export function formatRome(date: Date): string {
  const parts = new Intl.DateTimeFormat("it-IT", {
    timeZone: "Europe/Rome",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "00";
  return `${get("day")}/${get("month")}/${get("year")} ${get("hour")}:${get("minute")}:${get("second")}`;
}

// Font standard del PDF: sostituisce i caratteri che non supportano (es. nomi con lettere rare)
function makeSafe(font: PDFFont) {
  const supported = new Set(font.getCharacterSet());
  return (text: string) =>
    Array.from(text.replace(/[\r\n\t]+/g, " "))
      .map((ch) => {
        if (supported.has(ch.codePointAt(0)!)) return ch;
        const extra: Record<string, string> = { "Ł": "L", "ł": "l", "Đ": "D", "đ": "d", "Ø": "O", "ø": "o", "ß": "ss", "Æ": "AE", "æ": "ae", "Œ": "OE", "œ": "oe" };
        const base = extra[ch] ?? ch.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        return base && Array.from(base).every((c) => supported.has(c.codePointAt(0)!)) ? base : "?";
      })
      .join("");
}

export async function buildPrivacyPdf(data: SignedPrivacy): Promise<Buffer> {
  const pdf = await PDFDocument.create();
  pdf.setTitle("Informativa privacy firmata");
  pdf.setAuthor("F.A.D. SRL / FAD LeadHub");
  pdf.setCreationDate(data.signedAt);

  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const safe = makeSafe(font);
  const black = rgb(0.1, 0.1, 0.1);

  let page: PDFPage = pdf.addPage([PAGE_W, PAGE_H]);
  let y = TOP;

  const newPage = () => {
    page = pdf.addPage([PAGE_W, PAGE_H]);
    y = TOP;
  };
  const ensure = (height: number) => {
    if (y - height < BOTTOM) newPage();
  };

  const wrap = (text: string, f: PDFFont, size: number, maxWidth: number): string[] => {
    const lines: string[] = [];
    let line = "";
    for (const word of safe(text).split(" ")) {
      const candidate = line ? `${line} ${word}` : word;
      if (f.widthOfTextAtSize(candidate, size) <= maxWidth) {
        line = candidate;
      } else {
        if (line) lines.push(line);
        // parola piu' lunga della riga (es. indirizzi web): la spezza
        let rest = word;
        while (f.widthOfTextAtSize(rest, size) > maxWidth) {
          let cut = rest.length - 1;
          while (cut > 1 && f.widthOfTextAtSize(rest.slice(0, cut), size) > maxWidth) cut--;
          lines.push(rest.slice(0, cut));
          rest = rest.slice(cut);
        }
        line = rest;
      }
    }
    if (line) lines.push(line);
    return lines;
  };

  const paragraph = (text: string, opts: { bold?: boolean; size?: number; after?: number; before?: number } = {}) => {
    const f = opts.bold ? bold : font;
    const size = opts.size ?? SIZE;
    const lead = size * 1.35;
    y -= opts.before ?? 0;
    for (const line of wrap(text, f, size, PAGE_W - MARGIN_X * 2)) {
      ensure(lead);
      page.drawText(line, { x: MARGIN_X, y: y - size, size, font: f, color: black });
      y -= lead;
    }
    y -= opts.after ?? 4;
  };

  const checkbox = (x: number, baseY: number, checked: boolean) => {
    page.drawRectangle({ x, y: baseY - 1, width: 9, height: 9, borderColor: black, borderWidth: 0.8 });
    if (checked) {
      page.drawLine({ start: { x: x + 1.5, y: baseY + 0.5 }, end: { x: x + 7.5, y: baseY + 6.5 }, thickness: 1.1, color: black });
      page.drawLine({ start: { x: x + 1.5, y: baseY + 6.5 }, end: { x: x + 7.5, y: baseY + 0.5 }, thickness: 1.1, color: black });
    }
  };

  for (const block of privacyBlocks(data.person)) {
    if (block.type === "title") paragraph(block.text, { bold: true, size: 9, after: 8 });
    else if (block.type === "h") paragraph(block.text, { bold: true, before: 4, after: 3 });
    else if (block.type === "p") paragraph(block.text);
    else if (block.type === "declaration") paragraph(block.text, { before: 6, after: 8 });
    else if (block.type === "consent") {
      paragraph(block.text, { after: 3 });
      const yes = block.id === "marketing" ? data.consentMarketing : data.consentThird;
      ensure(18);
      const baseY = y - 10;
      page.drawText("Consento", { x: MARGIN_X, y: baseY, size: SIZE, font: bold, color: black });
      checkbox(MARGIN_X + 48, baseY, yes);
      page.drawText("Non consento", { x: MARGIN_X + 80, y: baseY, size: SIZE, font: bold, color: black });
      checkbox(MARGIN_X + 140, baseY, !yes);
      y -= 20;
    }
  }

  // Conferma digitale (senza firma disegnata): giorno, data, ora e codice ID
  ensure(90);
  page.drawText("Conferma digitale dell'interessato:", { x: MARGIN_X, y: y - SIZE, size: SIZE, font: bold, color: black });
  y -= 18;
  paragraph(`Confermato ${formatRomeLong(data.signedAt)} da ${data.signerName}.`, { bold: true, before: 2 });
  paragraph(`Codice ID della conferma: ${data.code} - IP: ${data.ip}`, { bold: true, before: 2 });

  // Intestazione e piè di pagina su ogni pagina (con "Pag n di N")
  const pages = pdf.getPages();
  pages.forEach((p, index) => {
    PRIVACY_HEADER.forEach((line, i) => {
      p.drawText(safe(line), { x: MARGIN_X, y: PAGE_H - 36 - i * 9.5, size: 7.5, font: i === 0 ? bold : font, color: black });
    });
    p.drawText(`Pag ${index + 1} di ${pages.length}`, { x: MARGIN_X, y: 34, size: 7.5, font, color: black });
    p.drawText(safe(PRIVACY_FOOTER), { x: MARGIN_X, y: 24, size: 7, font, color: rgb(0.35, 0.35, 0.35) });
  });

  return Buffer.from(await pdf.save());
}
