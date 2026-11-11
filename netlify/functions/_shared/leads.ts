import { sql } from "./auth";
import { romeLocalToUtc, todayInRome } from "./dates";

/** Tipo di via: testo libero (V, VLE, STR, SP, ...). Max 20 caratteri, maiuscolo, senza punti. */
export function cleanStreetType(raw: unknown): string | null {
  const t = String(raw ?? "").replace(/\./g, "").replace(/\s+/g, " ").trim().toUpperCase().slice(0, 20);
  return t || null;
}

/** Nomi estesi per le sigle piu' comuni (le altre restano come scritte) */
export const STREET_NAMES: Record<string, string> = {
  V: "Via", VLE: "Viale", VCO: "Vicolo", PZ: "Piazza", PZLE: "Piazzale",
  STR: "Strada", SP: "Strada provinciale", SS: "Strada statale", SR: "Strada regionale",
};
export const streetTypeName = (code: string | null | undefined) => (code ? (STREET_NAMES[code] ?? code) : "");

export const SECTORS = ["Luce", "Gas", "Telefonia"] as const;
export const AGENT_OUTCOMES = ["appuntamento", "da_ricontattare", "non_interessato", "segreteria"] as const;

/** Minuti dopo i quali un lead "da ricontattare" / "segreteria" torna in coda */
export const RETRY_MINUTES = 60;
/** Dopo quanti tentativi la segreteria non viene piu' riproposta */
export const MAX_VOICEMAIL_TRIES = 3;

/** Inizio e fine del giorno italiano (come istanti UTC). Se "day" e' AAAA-MM-GG usa quel giorno. */
export function romeDayRange(day?: string | null): { start: Date; end: Date; label: string } {
  let y: number, m: number, d: number;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day ?? "");
  if (match) {
    y = Number(match[1]);
    m = Number(match[2]);
    d = Number(match[3]);
  } else {
    ({ y, m, d } = todayInRome());
  }
  const start = romeLocalToUtc(y, m, d, 0, 0);
  const end = new Date(start.getTime() + 25 * 3600 * 1000); // 25h per assorbire il cambio ora
  // fine esatta = mezzanotte successiva in ora italiana
  const next = new Date(Date.UTC(y, m - 1, d + 1));
  const exactEnd = romeLocalToUtc(next.getUTCFullYear(), next.getUTCMonth() + 1, next.getUTCDate(), 0, 0);
  return {
    start,
    end: exactEnd.getTime() > start.getTime() ? exactEnd : end,
    label: `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`,
  };
}

/** Telefono: tiene solo cifre e un "+" iniziale. Valido se ha tra 6 e 15 cifre. */
export function cleanPhone(raw: unknown): string | null {
  const text = String(raw ?? "").trim();
  if (!text) return null;
  const plus = text.startsWith("+") || text.startsWith("00");
  let digits = text.replace(/\D/g, "");
  if (text.startsWith("00")) digits = digits.slice(2);
  if (digits.length < 6 || digits.length > 15) return null;
  return (plus ? "+" : "") + digits;
}

export function phoneKey(phone: string | null): string {
  return (phone ?? "").replace(/\D/g, "").replace(/^(0039|39)(?=\d{8,})/, "");
}

export function cleanText(raw: unknown, max = 200): string | null {
  const text = String(raw ?? "").replace(/\s+/g, " ").trim().slice(0, max);
  return text || null;
}

/** Codice fiscale / P.IVA: maiuscolo, 11-16 caratteri. Vuoto = nessuno. Non valido = undefined */
export function cleanFiscal(raw: unknown): string | null | undefined {
  const t = String(raw ?? "").replace(/\s+/g, "").toUpperCase();
  if (!t) return null;
  return /^[A-Z0-9]{11,16}$/.test(t) ? t : undefined;
}

export function cleanNotes(raw: unknown, max = 1000): string | null {
  const text = String(raw ?? "").trim().slice(0, max);
  return text || null;
}

/** Normalizza il settore ai tre valori previsti (Luce, Gas, Telefonia) */
export function normSector(raw: unknown): string | null {
  const t = String(raw ?? "").trim().toLowerCase();
  if (!t) return null;
  if (t.includes("luce") || t.includes("elettric") || t.includes("energia")) return "Luce";
  if (t.includes("gas")) return "Gas";
  if (t.includes("tel") || t.includes("fibra") || t.includes("fastweb") || t.includes("internet") || t.includes("mobile")) return "Telefonia";
  return String(raw).trim().slice(0, 40);
}

/** Prodotto del CRM corrispondente al settore del lead */
export function productForSector(sector: string | null): string[] {
  if (sector === "Luce") return ["Luce"];
  if (sector === "Gas") return ["Gas"];
  if (sector === "Telefonia") return ["Telefonia Fastweb"];
  return [];
}

/* ---------- Orario della Call Mode (default 09:00-15:30, regolabile da manager e amministratore) ---------- */

export const CALL_END_OPTIONS = ["13:30", "15:30", "17:30"] as const;

const toMinutes = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + (m || 0);
};

export function romeMinutesNow(date = new Date()): number {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Rome", hour: "2-digit", minute: "2-digit", hour12: false }).formatToParts(date);
  const h = Number(parts.find((p) => p.type === "hour")?.value ?? 0) % 24;
  const m = Number(parts.find((p) => p.type === "minute")?.value ?? 0);
  return h * 60 + m;
}

export type CallWindow = { start: string; end: string; active: boolean };

export async function getCallWindow(): Promise<CallWindow> {
  const rows = await sql`SELECT key, value FROM leadhub_settings WHERE key IN ('call_start', 'call_end')`;
  const map = Object.fromEntries(rows.map((r) => [r.key as string, r.value as string]));
  const start = /^\d{2}:\d{2}$/.test(map.call_start ?? "") ? map.call_start : "09:00";
  const end = /^\d{2}:\d{2}$/.test(map.call_end ?? "") ? map.call_end : "15:30";
  const now = romeMinutesNow();
  return { start, end, active: now >= toMinutes(start) && now < toMinutes(end) };
}


/* ---------- Modalita' di chiamata: telefono normale (tel:) oppure VoIP ---------- */

export type DialConfig = {
  /** modalita' effettiva per chi chiede: la scelta personale, altrimenti quella aziendale */
  mode: "tel" | "voip";
  template: string;
  prefix: string;
  /** il VoIP e' utilizzabile (l'amministratore ha impostato un collegamento valido) */
  available: boolean;
  /** scelta personale dell'agente (null = non ha scelto: vale l'impostazione aziendale) */
  personal: "tel" | "voip" | null;
};

/** Il collegamento VoIP puo' usare solo questi schemi (niente javascript:, data: ecc.) */
export function validDialTemplate(template: string): boolean {
  return template.length <= 300 && template.includes("{numero}") && /^(sip:|sips:|callto:|tel:|https:\/\/)/i.test(template);
}

export async function getDialConfig(userId?: string): Promise<DialConfig> {
  const keys = ["dial_mode", "voip_template", "voip_prefix", ...(userId ? [`dial_user:${userId}`] : [])];
  const rows = await sql`SELECT key, value FROM leadhub_settings WHERE key = ANY(${keys}::text[])`;
  const map = Object.fromEntries(rows.map((r) => [r.key as string, r.value as string]));
  const template = map.voip_template ?? "";
  const available = validDialTemplate(template);
  const mine = userId ? map[`dial_user:${userId}`] : undefined;
  const personal = mine === "voip" || mine === "tel" ? mine : null;
  const wanted = personal ?? (map.dial_mode === "voip" ? "voip" : "tel");
  return {
    mode: wanted === "voip" && available ? "voip" : "tel",
    template,
    prefix: /^\+?\d{0,6}$/.test(map.voip_prefix ?? "") ? (map.voip_prefix ?? "") : "",
    available,
    personal,
  };
}
