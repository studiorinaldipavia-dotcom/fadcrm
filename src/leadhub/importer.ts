// Lettura di file CSV / Excel e mappatura delle colonne sui campi del lead.
import type { ImportRow } from "../services/leadsApi"

export type ParsedSheet = { headers: string[]; rows: string[][] }

export const FIELDS: { key: keyof ImportRow; label: string; hints: string[]; required?: boolean }[] = [
  { key: "first_name", label: "Nome", hints: ["nome", "first", "name", "nominativo"] },
  { key: "last_name", label: "Cognome", hints: ["cognome", "last", "surname"] },
  { key: "fiscal_code", label: "Codice fiscale", hints: ["codicefiscale", "codfiscale", "cf", "codicef", "partitaiva", "piva", "fiscalcode"] },
  { key: "phone", label: "Telefono", hints: ["telefono", "cellulare", "tel", "phone", "mobile", "numero", "cell"], required: true },
  { key: "phone2", label: "Secondo numero", hints: ["telefono2", "tel2", "cellulare2", "cell2", "secondonumero", "secondotelefono", "altronumero", "altrotelefono", "numero2", "phone2"] },
  { key: "street_type", label: "Tipo via (V, STR, SP…)", hints: ["tipovia", "tipologiavia", "toponimo", "tipoindirizzo"] },
  { key: "address", label: "Via / Indirizzo", hints: ["indirizzo", "via", "address", "residenza"] },
  { key: "house_number", label: "Civico", hints: ["civico", "numerocivico", "ncivico", "nc", "housenumber"] },
  { key: "city", label: "Città / Comune", hints: ["citta", "città", "comune", "city", "localita", "località"] },
  { key: "province", label: "Provincia", hints: ["provincia", "prov", "pr"] },
  { key: "sector", label: "Settore", hints: ["settore", "servizio", "prodotto", "sector", "categoria", "offerta"] },
  { key: "provider", label: "Gestore attuale", hints: ["gestore", "fornitore", "operatore", "provider", "compagnia"] },
  { key: "notes", label: "Note", hints: ["note", "notes", "annotazioni", "commenti"] },
]

// ordine in cui si cercano le colonne: i campi piu' "specifici" prima, per non rubare colonne agli altri
const GUESS_ORDER: (keyof ImportRow)[] = [
  "street_type", "house_number", "fiscal_code", "first_name", "last_name", "phone2", "phone", "address", "city", "province", "sector", "provider", "notes",
]

export const MAX_ROWS = 20000

function detectDelimiter(text: string): string {
  const firstLine = text.split(/\r?\n/, 1)[0] ?? ""
  const counts = [";", ",", "\t"].map((d) => ({ d, n: firstLine.split(d).length - 1 }))
  counts.sort((a, b) => b.n - a.n)
  return counts[0].n > 0 ? counts[0].d : ";"
}

/** Lettore CSV (virgolette, a capo dentro i campi, separatore ; , o tab) */
export function parseCsv(text: string): string[][] {
  const clean = text.replace(/^\uFEFF/, "")
  const delimiter = detectDelimiter(clean)
  const rows: string[][] = []
  let row: string[] = []
  let cell = ""
  let quoted = false
  for (let i = 0; i < clean.length; i++) {
    const c = clean[i]
    if (quoted) {
      if (c === '"') {
        if (clean[i + 1] === '"') {
          cell += '"'
          i++
        } else quoted = false
      } else cell += c
    } else if (c === '"') quoted = true
    else if (c === delimiter) {
      row.push(cell)
      cell = ""
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && clean[i + 1] === "\n") i++
      row.push(cell)
      cell = ""
      if (row.some((v) => v.trim() !== "")) rows.push(row)
      row = []
    } else cell += c
  }
  row.push(cell)
  if (row.some((v) => v.trim() !== "")) rows.push(row)
  return rows
}

function decode(buffer: ArrayBuffer): string {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(buffer)
  } catch {
    // i CSV esportati da Excel in italiano sono spesso in Windows-1252
    return new TextDecoder("windows-1252").decode(buffer)
  }
}

const asText = (v: unknown): string => {
  if (v === null || v === undefined) return ""
  if (v instanceof Date) return v.toLocaleDateString("it-IT")
  return String(v).trim()
}

export async function parseFile(file: File): Promise<ParsedSheet> {
  if (file.size > 15 * 1024 * 1024) throw new Error("Il file è troppo grande (massimo 15 MB)")
  const name = file.name.toLowerCase()
  let grid: string[][]
  if (name.endsWith(".xlsx")) {
    const mod: any = await import("read-excel-file")
    const read = mod.default ?? mod
    const raw: unknown[][] = await read(file)
    grid = raw.map((r) => r.map(asText))
  } else if (name.endsWith(".csv") || name.endsWith(".txt")) {
    grid = parseCsv(decode(await file.arrayBuffer()))
  } else {
    throw new Error("Formato non supportato: carica un file .csv o .xlsx (in Excel: Salva con nome → CSV)")
  }
  grid = grid.filter((r) => r.some((v) => v !== ""))
  if (grid.length < 2) throw new Error("Il file non contiene righe di dati")
  if (grid.length - 1 > MAX_ROWS) throw new Error(`Troppe righe: massimo ${MAX_ROWS.toLocaleString("it-IT")} per file`)
  const width = Math.max(...grid.slice(0, 50).map((r) => r.length))
  const headers = Array.from({ length: width }, (_, i) => grid[0][i] || `Colonna ${i + 1}`)
  return { headers, rows: grid.slice(1) }
}

const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "")

/** Indovina la colonna giusta per ogni campo dal titolo (-1 = nessuna) */
export function guessMapping(headers: string[]): Record<keyof ImportRow, number> {
  const used = new Set<number>()
  const result = {} as Record<keyof ImportRow, number>
  // prima i titoli identici, poi quelli che contengono l'indizio
  for (const pass of ["exact", "contains"] as const) {
    for (const key of GUESS_ORDER) {
      const field = FIELDS.find((f) => f.key === key)!
      if (result[field.key] !== undefined && result[field.key] >= 0) continue
      const index = headers.findIndex((h, i) => {
        if (used.has(i)) return false
        const n = norm(h)
        return field.hints.some((hint) => (pass === "exact" ? n === norm(hint) : n.includes(norm(hint)) && norm(hint).length > 2))
      })
      result[field.key] = index
      if (index >= 0) used.add(index)
    }
  }
  return result
}

export function toImportRows(sheet: ParsedSheet, mapping: Record<keyof ImportRow, number>): ImportRow[] {
  const get = (row: string[], key: keyof ImportRow) => (mapping[key] >= 0 ? (row[mapping[key]] ?? "").trim() : "")
  return sheet.rows.map((row) => ({
    first_name: get(row, "first_name"),
    last_name: get(row, "last_name"),
    phone: get(row, "phone"),
    phone2: get(row, "phone2"),
    address: get(row, "address"),
    house_number: get(row, "house_number"),
    street_type: get(row, "street_type"),
    fiscal_code: get(row, "fiscal_code"),
    provider: get(row, "provider"),
    city: get(row, "city"),
    province: get(row, "province"),
    sector: get(row, "sector"),
    notes: get(row, "notes"),
  }))
}
