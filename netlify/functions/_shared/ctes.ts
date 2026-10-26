// Parsing condiviso dei campi economici delle CTE dei prodotti.
// Accetta numeri o testo con la virgola ("0,1234"); vuoto = nessun valore.
export function parseMoney(value: unknown, decimals: number, max = 1_000_000): number | null | "invalid" {
  if (value === null || value === undefined) return null;
  const text = String(value).trim().replace(",", ".");
  if (text === "") return null;
  const n = Number(text);
  if (!Number.isFinite(n) || n < 0 || n > max) return "invalid";
  return Math.round(n * 10 ** decimals) / 10 ** decimals;
}
