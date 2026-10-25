import { useEffect, useRef, useState, type ReactNode } from "react"
import "../leadhub.css"
import type { AppointmentResult, LeadOutcome } from "../services/leadsApi"

/* ---------- Icone (stesso stile lineare del resto del CRM) ---------- */

const paths = {
  phone: <path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2z" />,
  calendar: (
    <>
      <rect x="3" y="4" width="18" height="17" rx="2" />
      <path d="M16 2v4M8 2v4M3 10h18" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </>
  ),
  pin: (
    <>
      <path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 0 1 16 0z" />
      <circle cx="12" cy="10" r="3" />
    </>
  ),
  pencil: <path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" />,
  check: <path d="m5 12 4 4L19 6" />,
  close: <path d="M18 6 6 18M6 6l12 12" />,
  undo: <path d="M3 7v6h6M3 13a9 9 0 1 0 3-7.7" />,
  skip: <path d="m5 4 10 8-10 8zM19 5v14" />,
  voicemail: (
    <>
      <circle cx="6" cy="12" r="4" />
      <circle cx="18" cy="12" r="4" />
      <path d="M6 16h12" />
    </>
  ),
  userx: (
    <>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="m17 8 5 5M22 8l-5 5" />
    </>
  ),
  thumbdown: <path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.7a2 2 0 0 0-2 1.7l-1.4 9a2 2 0 0 0 2 2.3zM17 2h3a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2h-3" />,
  refresh: <path d="M21 12a9 9 0 1 1-3-6.7L21 8M21 3v5h-5" />,
  upload: <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12" />,
  download: <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" />,
  trash: <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />,
  wifioff: <path d="M2 2l20 20M8.5 16.4a5 5 0 0 1 7 0M2 8.8a15 15 0 0 1 4.2-2.7M10.7 5.1A15 15 0 0 1 22 8.8M5 12.9a10 10 0 0 1 5.2-2.8M19 12.9a10 10 0 0 0-2.4-1.9M12 20h.01" />,
  shield: (
    <>
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      <path d="m9 12 2 2 4-4" />
    </>
  ),
  navigation: <path d="m3 11 19-9-9 19-2-8z" />,
  user: (
    <>
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </>
  ),
  list: <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />,
  radio: (
    <>
      <circle cx="12" cy="12" r="2" />
      <path d="M16.2 7.8a6 6 0 0 1 0 8.4M7.8 16.2a6 6 0 0 1 0-8.4M19 5a10 10 0 0 1 0 14M5 19a10 10 0 0 1 0-14" />
    </>
  ),
  file: (
    <>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <path d="M14 2v6h6" />
    </>
  ),
  warning: (
    <>
      <path d="M10.3 2.9 1.8 17a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 2.9a2 2 0 0 0-3.4 0z" />
      <path d="M12 9v4M12 17h.01" />
    </>
  ),
  search: (
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="m21 21-4.3-4.3" />
    </>
  ),
  plus: <path d="M12 5v14M5 12h14" />,
  contact: (
    <>
      <path d="M16 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2z" />
      <circle cx="11" cy="10" r="2.5" />
      <path d="M6.5 17a4.5 4.5 0 0 1 9 0" />
    </>
  ),
  euro: <path d="M18 7a7 7 0 1 0 0 10M4 10h10M4 14h10" />,
}

export type LIconName = keyof typeof paths

export function LIcon({ name, size = 18 }: { name: LIconName; size?: number }) {
  return (
    <svg
      className="icon"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[name]}
    </svg>
  )
}

/* ---------- Badge di stato: verde / giallo / rosso / neutro ---------- */

type Tone = "green" | "yellow" | "red" | "neutral" | "blue"

export function Badge({ tone, children }: { tone: Tone; children: ReactNode }) {
  return (
    <span className={`lh-badge ${tone}`}>
      <i />
      {children}
    </span>
  )
}

export const outcomeLabel: Record<LeadOutcome, string> = {
  nuovo: "Da chiamare",
  appuntamento: "Appuntamento",
  da_ricontattare: "Da ricontattare",
  non_interessato: "Non interessato",
  segreteria: "Segreteria/NR",
  numero_errato: "Numero inesistente",
  persona_sbagliata: "Trasferito/persona sbagliata",
}

const outcomeTone: Record<LeadOutcome, Tone> = {
  nuovo: "neutral",
  appuntamento: "green",
  da_ricontattare: "yellow",
  non_interessato: "red",
  segreteria: "yellow",
  numero_errato: "red",
  persona_sbagliata: "red",
}

export function OutcomeBadge({ value }: { value: LeadOutcome }) {
  return <Badge tone={outcomeTone[value]}>{outcomeLabel[value]}</Badge>
}

export function AppointmentBadge({ value }: { value: AppointmentResult }) {
  if (value === "contratto_chiuso") return <Badge tone="green">Contratto concluso</Badge>
  if (value === "chiamato_senza_trattativa") return <Badge tone="neutral">Chiamato senza trattativa</Badge>
  if (value === "incontrato_con_trattativa") return <Badge tone="yellow">Con trattativa</Badge>
  if (value === "incontrato_senza_trattativa") return <Badge tone="neutral">Senza trattativa</Badge>
  if (value === "annullato") return <Badge tone="red">Annullato / non visto</Badge>
  return <Badge tone="yellow">In attesa</Badge>
}

export function SectorBadge({ sector }: { sector: string | null }) {
  if (!sector) return null
  const cls = sector === "Luce" ? "luce" : sector === "Gas" ? "gas" : sector === "Telefonia" ? "tel" : "altro"
  return <span className={`lh-sector ${cls}`}>{sector}</span>
}

/* ---------- Utilita' ---------- */

export function errorText(error: unknown): string {
  if (error instanceof TypeError) return "Connessione assente o instabile. Controlla la rete e riprova."
  return error instanceof Error ? error.message : "Errore imprevisto"
}

/** Vero se l'errore e' un problema di rete (non una risposta del server) */
export const isNetworkError = (error: unknown) => error instanceof TypeError

export function useOnline(): boolean {
  const [online, setOnline] = useState(() => navigator.onLine)
  useEffect(() => {
    const on = () => setOnline(true)
    const off = () => setOnline(false)
    window.addEventListener("online", on)
    window.addEventListener("offline", off)
    return () => {
      window.removeEventListener("online", on)
      window.removeEventListener("offline", off)
    }
  }, [])
  return online
}

/** Ora e minuti attuali in Italia (per le finestre 09:00-13:00 e 14:00) */
export function romeMinutes(date = new Date()): number {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Rome",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date)
  const h = Number(parts.find((p) => p.type === "hour")?.value ?? 0) % 24
  const m = Number(parts.find((p) => p.type === "minute")?.value ?? 0)
  return h * 60 + m
}

export function SessionBadge({ session }: { session?: { start: string; end: string; active: boolean } }) {
  if (!session) return null
  if (session.active) return <Badge tone="green">Call Mode attiva · {session.start}–{session.end}</Badge>
  return <Badge tone="red">Call Mode chiusa · attiva {session.start}–{session.end}</Badge>
}

export const fullName = (a: { first_name: string | null; last_name: string | null }) =>
  [a.first_name, a.last_name].filter(Boolean).join(" ") || "Contatto senza nome"

export const timeHM = (iso: string) =>
  new Date(iso).toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" })

export const dateTimeIt = (iso: string) =>
  new Date(iso).toLocaleString("it-IT", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })

export function ago(iso: string | null, now = Date.now()): string {
  if (!iso) return "—"
  const s = Math.max(0, Math.floor((now - new Date(iso).getTime()) / 1000))
  if (s < 60) return "ora"
  if (s < 3600) return `${Math.floor(s / 60)} min fa`
  return `${Math.floor(s / 3600)} h fa`
}

export function localDateIso(date = new Date()): string {
  const d = new Date(date.getTime() - date.getTimezoneOffset() * 60000)
  return d.toISOString().slice(0, 10)
}

/** Link per aprire la navigazione: Apple Maps su iPhone/iPad, Google Maps altrove */
export function mapsLinks(address: string, city: string | null) {
  const q = encodeURIComponent([address, city].filter(Boolean).join(", "))
  const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  const google = `https://www.google.com/maps/dir/?api=1&destination=${q}`
  const apple = `https://maps.apple.com/?daddr=${q}`
  return { primary: ios ? apple : google, primaryLabel: ios ? "Apple Maps" : "Google Maps", other: ios ? google : apple, otherLabel: ios ? "Google Maps" : "Apple Maps" }
}

export const googleMapsUrl = (place: string) => `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(place)}`
export const appleMapsUrl = (place: string) => `https://maps.apple.com/?daddr=${encodeURIComponent(place)}`

export function downloadCsv(filename: string, rows: (string | number | null)[][]) {
  const escape = (v: string | number | null) => {
    const text = v === null || v === undefined ? "" : String(v)
    return /[";\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
  }
  const csv = "\uFEFF" + rows.map((r) => r.map(escape).join(";")).join("\r\n")
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }))
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export const STREET_TYPES: { code: string; name: string }[] = [
  { code: "V", name: "Via" },
  { code: "VLE", name: "Viale" },
  { code: "VCO", name: "Vicolo" },
  { code: "PZ", name: "Piazza" },
  { code: "PZLE", name: "Piazzale" },
  { code: "STR", name: "Strada" },
  { code: "SP", name: "Strada provinciale" },
  { code: "SS", name: "Strada statale" },
  { code: "SR", name: "Strada regionale" },
]
/** Sigla nota -> nome esteso (V = Via, STR = Strada, SP = Strada provinciale...); le altre restano come scritte */
const streetName = (code?: string | null) => (code ? (STREET_TYPES.find((t) => t.code === code.toUpperCase())?.name ?? code) : "")

/** "Via Roma 5" a partire da tipo via, indirizzo e civico */
export const streetLine = (a: { address: string | null; house_number?: string | null; street_type?: string | null }) =>
  [streetName(a.street_type), a.address, a.house_number].filter(Boolean).join(" ")

export const placeOf = (a: { address: string | null; house_number?: string | null; street_type?: string | null; city: string | null }) =>
  [streetLine(a), a.city].filter(Boolean).join(", ")

/** Scarica una scheda contatto (.vcf): su telefono si apre l'importazione in rubrica */
export function saveToContacts(c: {
  first_name: string | null
  last_name: string | null
  phone: string | null
  phone2?: string | null
  address: string | null
  house_number?: string | null
  street_type?: string | null
  city: string | null
  province?: string | null
}) {
  const esc = (v: string) => v.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n")
  const lines = [
    "BEGIN:VCARD",
    "VERSION:3.0",
    `N:${esc(c.last_name ?? "")};${esc(c.first_name ?? "")};;;`,
    `FN:${esc([c.first_name, c.last_name].filter(Boolean).join(" ") || "Contatto FAD LeadHub")}`,
    c.phone ? `TEL;TYPE=CELL:${c.phone}` : "",
    c.phone2 ? `TEL;TYPE=CELL:${c.phone2}` : "",
    c.address || c.city ? `ADR;TYPE=HOME:;;${esc(streetLine(c))};${esc(c.city ?? "")};${esc(c.province ?? "")};;Italia` : "",
    "ORG:FAD LeadHub",
    "END:VCARD",
  ].filter(Boolean)
  const url = URL.createObjectURL(new Blob([lines.join("\r\n")], { type: "text/vcard;charset=utf-8" }))
  const a = document.createElement("a")
  a.href = url
  a.download = `${[c.first_name, c.last_name].filter(Boolean).join("-").replace(/\W+/g, "-") || "contatto"}.vcf`
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 2000)
}

/* ---------- Scelta giorno e ora SENZA i selettori nativi del telefono ---------- */

const DAY_NAMES = ["Dom", "Lun", "Mar", "Mer", "Gio", "Ven", "Sab"]
const HOURS = Array.from({ length: 15 }, (_, i) => i + 7) // 07 ... 21
const MINUTES = ["00", "15", "30", "45"]

export function DateTimePicker({
  date,
  time,
  onChange,
}: {
  date: string
  time: string
  onChange: (date: string, time: string) => void
}) {
  const today = localDateIso()
  const days: string[] = []
  const first = date && date < today ? date : today
  for (let i = 0; i < 28; i++) {
    const d = new Date(`${first}T12:00:00`)
    d.setDate(d.getDate() + i)
    days.push(localDateIso(d))
  }
  const [hh, mm] = (time || "15:00").split(":")
  const selected = useRef<HTMLButtonElement | null>(null)
  useEffect(() => {
    selected.current?.scrollIntoView({ block: "nearest", inline: "center" })
  }, [])
  const label = (iso: string) => {
    if (iso === today) return "Oggi"
    const d = new Date(`${iso}T12:00:00`)
    if (iso === localDateIso(new Date(Date.now() + 86400000))) return "Domani"
    return `${DAY_NAMES[d.getDay()]} ${d.getDate()}`
  }
  return (
    <div className="lh-dtp">
      <div className="lh-dtp-days" role="listbox" aria-label="Giorno">
        {days.map((d) => (
          <button
            key={d}
            type="button"
            ref={d === date ? selected : undefined}
            className={`lh-dtp-chip ${d === date ? "on" : ""}`}
            onClick={() => onChange(d, time)}
          >
            <small>{new Date(`${d}T12:00:00`).toLocaleDateString("it-IT", { month: "short" })}</small>
            <b>{label(d)}</b>
          </button>
        ))}
      </div>
      <div className="lh-dtp-hours" role="listbox" aria-label="Ora">
        {HOURS.map((h) => {
          const v = String(h).padStart(2, "0")
          return (
            <button key={v} type="button" className={`lh-dtp-chip small ${v === hh ? "on" : ""}`} onClick={() => onChange(date, `${v}:${mm}`)}>
              {v}
            </button>
          )
        })}
      </div>
      <div className="lh-dtp-mins" role="listbox" aria-label="Minuti">
        {MINUTES.map((m) => (
          <button key={m} type="button" className={`lh-dtp-chip small ${m === mm ? "on" : ""}`} onClick={() => onChange(date, `${hh}:${m}`)}>
            :{m}
          </button>
        ))}
      </div>
      <p className="lh-dtp-sum">
        {new Date(`${date}T12:00:00`).toLocaleDateString("it-IT", { weekday: "long", day: "numeric", month: "long" })} · <b>{time}</b>
      </p>
    </div>
  )
}
