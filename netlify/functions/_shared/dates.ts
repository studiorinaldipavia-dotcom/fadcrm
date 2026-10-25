// Date in ora italiana (Europe/Rome), senza librerie esterne.

function romeParts(date: Date) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Rome",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const get = (type: string) => Number(parts.find((p) => p.type === type)!.value);
  return { y: get("year"), m: get("month"), d: get("day"), h: get("hour") % 24, min: get("minute"), s: get("second") };
}

/** Data di oggi in Italia */
export function todayInRome(now = new Date()): { y: number; m: number; d: number } {
  const p = romeParts(now);
  return { y: p.y, m: p.m, d: p.d };
}

/** Ora locale italiana (anno, mese 1-12, giorno, ora, minuti) -> istante UTC corretto, anche con l'ora legale */
export function romeLocalToUtc(y: number, m: number, d: number, h: number, min: number): Date {
  const wanted = Date.UTC(y, m - 1, d, h, min);
  let guess = wanted;
  for (let i = 0; i < 3; i++) {
    const p = romeParts(new Date(guess));
    const shown = Date.UTC(p.y, p.m - 1, p.d, p.h, p.min);
    guess += wanted - shown;
  }
  return new Date(guess);
}

/** Aggiunge mesi a una data, fermandosi all'ultimo giorno del mese se serve (31 gennaio + 1 mese = 28/29 febbraio) */
export function addMonths(y: number, m: number, d: number, add: number): { y: number; m: number; d: number } {
  const index = m - 1 + add;
  const year = y + Math.floor(index / 12);
  const month = ((index % 12) + 12) % 12;
  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  return { y: year, m: month + 1, d: Math.min(d, lastDay) };
}
