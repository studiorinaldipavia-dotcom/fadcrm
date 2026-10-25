import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  addLeadRows,
  assignLeads,
  closeLeadSession,
  createLeadList,
  deleteLeadList,
  deleteWrongLeads,
  fetchControlRoom,
  fetchLeadAdmin,
  fetchLeadReport,
  saveLeadSettings,
  purgeLeadList,
  releaseAgentLeads,
  reopenLeadSession,
  type ControlData,
  type LeadAdminData,
  type LeadList,
  type ReportData,
} from "../services/leadsApi"
import { FIELDS, guessMapping, parseFile, toImportRows, type ParsedSheet } from "./importer"
import { Badge, LIcon, OutcomeBadge, SessionBadge, ago, dateTimeIt, downloadCsv, errorText, fullName, outcomeLabel } from "./shared"
import type { ImportRow } from "../services/leadsApi"

/** 1 lista = 50 contatti */
const LEADS_PER_LIST = 50
const listsOf = (n: number) => {
  const x = Math.round((n / LEADS_PER_LIST) * 10) / 10
  return `${x.toLocaleString("it-IT")} ${x === 1 ? "lista" : "liste"}`
}

// Contatti non ancora trattati (nessun esito), con tra parentesi quante liste da 50 avanzano
function UntreatedSummary({ data }: { data: LeadAdminData }) {
  const u = data.untreated
  const cards: [string, number, string][] = [
    ["Non trattati avanzati", u.total, "Nessun esito ancora registrato"],
    ["Ancora da assegnare", u.unassigned, "Nel database, senza agente"],
    ["Assegnati e non trattati", u.assigned, "Nelle code degli agenti"],
  ]
  return (
    <div className="metrics-grid lh-untreated">
      {cards.map(([label, n, hint]) => (
        <article className="metric-card" key={label}>
          <div className="metric-copy">
            <p className="eyebrow">{label}</p>
            <div className="metric-row">
              <strong>{n.toLocaleString("it-IT")}</strong>
              <span className="lh-untreated-lists">({listsOf(n)})</span>
            </div>
            <p className="muted">{hint}</p>
          </div>
        </article>
      ))}
    </div>
  )
}

type Tab = "liste" | "assegnazione" | "control" | "report"

const TABS: { id: Tab; label: string; icon: "upload" | "user" | "radio" | "shield" }[] = [
  { id: "liste", label: "Liste e upload", icon: "upload" },
  { id: "assegnazione", label: "Assegnazione", icon: "user" },
  { id: "control", label: "Control Room", icon: "radio" },
  { id: "report", label: "Report e pulizia", icon: "shield" },
]

function Flash({ ok, error, onClose }: { ok?: string; error?: string; onClose: () => void }) {
  if (!ok && !error) return null
  return (
    <p className={error ? "form-error" : "form-ok flush"} role={error ? "alert" : "status"} onClick={onClose}>
      {error || ok}
    </p>
  )
}

/* ================= LISTE ================= */

function listStatus(list: LeadList, nowMs: number) {
  if (list.anonymized_at) return <Badge tone="neutral">Dati rimossi</Badge>
  if (list.session_closed_at && list.purge_after) {
    const left = new Date(list.purge_after).getTime() - nowMs
    if (left <= 0) return <Badge tone="red">Pulizia in corso</Badge>
    const h = Math.floor(left / 3600000)
    const m = Math.floor((left % 3600000) / 60000)
    return <Badge tone="yellow">Chiusa · pulizia tra {h}h {m}m</Badge>
  }
  return <Badge tone="green">Sessione aperta</Badge>
}

/** Anteprima in stile Call Mode: ogni riquadro e' nella posizione in cui lo vedra' l'agente e,
 *  sotto, si sceglie la colonna del file che lo riempie. */
function MappingPreview({
  sheet,
  mapping,
  rows,
  index,
  onIndex,
  onMap,
}: {
  sheet: ParsedSheet
  mapping: Record<keyof ImportRow, number> | null
  rows: ImportRow[]
  index: number
  onIndex: (i: number) => void
  onMap: (key: keyof ImportRow, col: number) => void
}) {
  const row = rows[index]
  const fieldOf = (key: keyof ImportRow) => FIELDS.find((f) => f.key === key)!

  const pick = (key: keyof ImportRow) => (
    <select
      className="lh-pick"
      aria-label={`Colonna per ${fieldOf(key).label}`}
      value={mapping?.[key] ?? -1}
      onChange={(e) => onMap(key, Number(e.target.value))}
    >
      <option value={-1}>— non presente —</option>
      {sheet.headers.map((h, i) => (
        <option key={i} value={i}>
          {h}
        </option>
      ))}
    </select>
  )

  const box = (key: keyof ImportRow, label: string, opts: { big?: boolean; multiline?: boolean } = {}) => {
    const value = row?.[key] ?? ""
    return (
      <div className={`lh-field box lh-mapbox ${opts.big ? "big" : ""} ${opts.multiline ? "multi" : ""}`}>
        <span className="lh-field-label">
          {label}
          {fieldOf(key).required && " *"}
        </span>
        <div className={`lh-field-value static ${value ? "" : "empty"}`}>
          <span>{value || label}</span>
        </div>
        {pick(key)}
      </div>
    )
  }

  const fullName = [row?.first_name, row?.last_name].filter(Boolean).join(" ")

  return (
    <div className="lh-map">
      <div className="lh-map-nav">
        <span>
          Esempio: contatto <b>{rows.length ? index + 1 : 0}</b> di {rows.length.toLocaleString("it-IT")}
        </span>
        <span className="lh-map-nav-btns">
          <button type="button" className="secondary-button" disabled={index <= 0} onClick={() => onIndex(index - 1)} aria-label="Contatto precedente">
            ‹
          </button>
          <button type="button" className="secondary-button" disabled={index >= rows.length - 1} onClick={() => onIndex(index + 1)} aria-label="Contatto successivo">
            ›
          </button>
        </span>
      </div>

      <article className="lh-lead">
        <div className="lh-lead-top">
          <div className="lh-city">{box("city", "Città")}</div>
          <div className="lh-attempt">
            <span className="lh-field-label">Tentativo</span>
            <strong>1</strong>
            <small>Esito: nessuno</small>
          </div>
        </div>

        {box("fiscal_code", "Codice fiscale")}

        <div className="lh-field box lh-mapbox big">
          <span className="lh-field-label">Nome e cognome</span>
          <div className={`lh-field-value static ${fullName ? "" : "empty"}`}>
            <span>{fullName || "Nome e cognome"}</span>
          </div>
          <div className="lh-map-pair">
            <label>
              <small>Nome</small>
              {pick("first_name")}
            </label>
            <label>
              <small>Cognome</small>
              {pick("last_name")}
            </label>
          </div>
        </div>

        <div className="lh-row2 phones">
          {box("phone", "Numero di telefono", { big: true })}
          {box("phone2", "Secondo numero", { big: true })}
        </div>

        <div className="lh-row2 addr">
          {box("street_type", "Via")}
          {box("address", "Indirizzo")}
          {box("house_number", "Civico")}
        </div>

        <div className="lh-row2 notes">
          {box("notes", "Note", { multiline: true })}
          {box("provider", "Gestore", { multiline: true })}
        </div>

        <div className="lh-map-extra">
          <p className="lh-field-label">Altri dati (non nella scheda, servono per assegnare le liste)</p>
          <div className="lh-row2">
            {box("province", "Provincia")}
            {box("sector", "Settore")}
          </div>
        </div>
      </article>
    </div>
  )
}

function UploadPanel({ onDone }: { onDone: () => void }) {
  const [sheet, setSheet] = useState<ParsedSheet | null>(null)
  const [filename, setFilename] = useState("")
  const [name, setName] = useState("")
  const [mapping, setMapping] = useState<Record<keyof ImportRow, number> | null>(null)
  const [error, setError] = useState("")
  const [result, setResult] = useState("")
  const [progress, setProgress] = useState<number | null>(null)
  const [previewIdx, setPreviewIdx] = useState(0)
  const fileRef = useRef<HTMLInputElement>(null)

  const reset = () => {
    setPreviewIdx(0)
    setSheet(null)
    setMapping(null)
    setFilename("")
    setName("")
    if (fileRef.current) fileRef.current.value = ""
  }

  const pick = async (file: File | undefined) => {
    if (!file) return
    setError("")
    setResult("")
    try {
      const parsed = await parseFile(file)
      setSheet(parsed)
      setMapping(guessMapping(parsed.headers))
      setFilename(file.name)
      setName(file.name.replace(/\.[^.]+$/, ""))
    } catch (e) {
      reset()
      setError(errorText(e))
    }
  }

  const rows = useMemo(() => (sheet && mapping ? toImportRows(sheet, mapping) : []), [sheet, mapping])
  const withPhone = rows.filter((r) => r.phone.trim()).length

  const run = async () => {
    if (!sheet || !mapping) return
    if (mapping.phone < 0) {
      setError("Indica quale colonna contiene il telefono")
      return
    }
    if (!name.trim()) {
      setError("Scrivi un nome per la lista")
      return
    }
    setError("")
    setProgress(0)
    let inserted = 0
    let noPhone = 0
    let duplicates = 0
    try {
      const { id } = await createLeadList(name.trim(), filename)
      const chunk = 500
      for (let i = 0; i < rows.length; i += chunk) {
        const res = await addLeadRows(id, rows.slice(i, i + chunk))
        inserted += res.inserted
        noPhone += res.no_phone
        duplicates += res.duplicates
        setProgress(Math.min(100, Math.round(((i + chunk) / rows.length) * 100)))
      }
      setResult(
        `Lista importata: ${inserted} contatti salvati` +
          (noPhone ? `, ${noPhone} scartati senza telefono valido` : "") +
          (duplicates ? `, ${duplicates} doppioni ignorati` : "") +
          ".",
      )
      reset()
      onDone()
    } catch (e) {
      setError(
        `${errorText(e)} L'importazione si è fermata dopo ${inserted} contatti: ritrovi la lista parziale qui sotto, puoi eliminarla e ricaricare il file.`,
      )
      onDone()
    } finally {
      setProgress(null)
    }
  }

  return (
    <section className="panel standalone-panel">
      <div className="panel-heading">
        <div>
          <p className="panel-kicker neutral">CSV o Excel (.xlsx)</p>
          <h2>Carica una nuova lista</h2>
        </div>
      </div>
      <div className="lh-pad">
        <Flash ok={result} error={error} onClose={() => (setResult(""), setError(""))} />
        {!sheet ? (
          <label className="lh-drop">
            <LIcon name="upload" size={26} />
            <strong>Scegli il file con i contatti</strong>
            <span>Colonne consigliate: Nome, Cognome, Telefono, Indirizzo, Città, Settore, Note. In Excel formatta il telefono come testo.</span>
            <input ref={fileRef} type="file" accept=".csv,.txt,.xlsx" onChange={(e) => pick(e.target.files?.[0])} />
          </label>
        ) : (
          <>
            <div className="form-grid lh-import-name">
              <label className="full">
                <span>Nome della lista</span>
                <input value={name} maxLength={120} onChange={(e) => setName(e.target.value)} />
              </label>
            </div>
            <p className="modal-hint lh-hint">
              File <b>{filename}</b>: {rows.length.toLocaleString("it-IT")} righe, {withPhone.toLocaleString("it-IT")} con telefono. Sotto ogni riquadro scegli
              la colonna del file: la scheda è identica a quella che vedranno agenti e trainer in Call Mode.
            </p>
            <MappingPreview
              sheet={sheet}
              mapping={mapping}
              rows={rows}
              index={Math.min(previewIdx, Math.max(0, rows.length - 1))}
              onIndex={setPreviewIdx}
              onMap={(key, col) => setMapping((m) => (m ? { ...m, [key]: col } : m))}
            />
            <div className="lh-actions-row">
              <button type="button" className="secondary-button" onClick={reset} disabled={progress !== null}>
                Annulla
              </button>
              <button type="button" className="primary-button" onClick={run} disabled={progress !== null}>
                {progress !== null ? `Importo… ${progress}%` : `Importa ${withPhone.toLocaleString("it-IT")} contatti`}
              </button>
            </div>
          </>
        )}
      </div>
    </section>
  )
}

function ListsTab({ data, reload }: { data: LeadAdminData; reload: () => Promise<void> }) {
  const [msg, setMsg] = useState({ ok: "", error: "" })
  const [busy, setBusy] = useState("")
  const nowMs = new Date(data.now).getTime()

  const act = async (id: string, label: string, confirmText: string | null, fn: () => Promise<string>) => {
    if (confirmText && !window.confirm(confirmText)) return
    setBusy(id + label)
    setMsg({ ok: "", error: "" })
    try {
      const ok = await fn()
      setMsg({ ok, error: "" })
      await reload()
    } catch (e) {
      setMsg({ ok: "", error: errorText(e) })
    } finally {
      setBusy("")
    }
  }

  return (
    <div className="settings-stack">
      <UntreatedSummary data={data} />
      <UploadPanel onDone={reload} />
      <section className="panel standalone-panel">
        <div className="panel-heading">
          <div>
            <p className="panel-kicker neutral">Una lista = una sessione di chiamata</p>
            <h2>
              Liste caricate <span className="task-count">{data.lists.length}</span>
            </h2>
          </div>
        </div>
        <div className="lh-pad tight">
          <Flash ok={msg.ok} error={msg.error} onClose={() => setMsg({ ok: "", error: "" })} />
          <p className="modal-hint lh-hint">
            <LIcon name="shield" size={14} /> Quando chiudi la sessione, 24 ore dopo nomi, telefoni e indirizzi vengono anonimizzati automaticamente
            (restano solo gli esiti per le statistiche). Gli appuntamenti futuri non ancora svolti sono esclusi.
          </p>
        </div>
        {data.lists.length === 0 ? (
          <p className="muted pad">Nessuna lista: carica il primo file qui sopra.</p>
        ) : (
          <div className="lh-scroll">
            <div className="lh-table lists">
              <div className="lh-tr head">
                <span>Lista</span>
                <span>Contatti</span>
                <span>Assegnati</span>
                <span>Non trattati</span>
                <span>Trattati</span>
                <span>Appunt.</span>
                <span>Stato</span>
                <span />
              </div>
              {data.lists.map((l) => (
                <div className="lh-tr" key={l.id}>
                  <span>
                    <strong>{l.name}</strong>
                    <small className="cell-note">{dateTimeIt(l.created_at)}</small>
                  </span>
                  <span>{l.total}</span>
                  <span>{l.assigned}</span>
                  <span>
                    {l.anonymized_at ? "—" : l.untreated}
                    {!l.anonymized_at && <small className="cell-note">({listsOf(l.untreated)})</small>}
                  </span>
                  <span>{l.worked}</span>
                  <span>
                    {l.appointments}
                    {l.closed ? ` (${l.closed} chiusi)` : ""}
                  </span>
                  <span>{listStatus(l, nowMs)}</span>
                  <span className="lh-row-actions">
                    {!l.anonymized_at &&
                      (l.session_closed_at ? (
                        <button
                          type="button"
                          className="link-button"
                          disabled={!!busy}
                          onClick={() => act(l.id, "open", null, async () => (await reopenLeadSession(l.id), "Sessione riaperta"))}
                        >
                          Riapri
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="link-button"
                          disabled={!!busy}
                          onClick={() =>
                            act(l.id, "close", `Chiudere la sessione di "${l.name}"? Tra 24 ore i dati personali dei contatti saranno anonimizzati.`, async () => (await closeLeadSession(l.id), "Sessione chiusa: pulizia automatica tra 24 ore"))
                          }
                        >
                          Chiudi sessione
                        </button>
                      ))}
                    {!l.anonymized_at && (
                      <button
                        type="button"
                        className="link-button"
                        disabled={!!busy}
                        onClick={() =>
                          act(l.id, "purge", `Anonimizzare ORA tutti i contatti di "${l.name}"? L'operazione non si può annullare.`, async () => {
                            const r = await purgeLeadList(l.id)
                            return `${r.anonymized} contatti anonimizzati`
                          })
                        }
                      >
                        Ripulisci ora
                      </button>
                    )}
                    <button
                      type="button"
                      className="link-button danger"
                      disabled={!!busy}
                      onClick={() =>
                        act(l.id, "del", `Eliminare definitivamente la lista "${l.name}" e tutti i suoi contatti?`, async () => (await deleteLeadList(l.id), "Lista eliminata"))
                      }
                    >
                      Elimina
                    </button>
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>
    </div>
  )
}

/* ================= ASSEGNAZIONE ================= */

function AssignTab({ data, reload, onOpenAgents }: { data: LeadAdminData; reload: () => Promise<void>; onOpenAgents?: () => void }) {
  const [listId, setListId] = useState("")
  const [city, setCity] = useState("")
  const [sector, setSector] = useState("")
  const [mode, setMode] = useState<"round_robin" | "manual">("round_robin")
  const [selected, setSelected] = useState<string[]>(() => data.agents.map((a) => a.id))
  const [manualAgent, setManualAgent] = useState("")
  const [count, setCount] = useState("")
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState({ ok: "", error: "" })

  const lists = data.lists.filter((l) => !l.anonymized_at && l.unassigned > 0)
  const available = listId
    ? (data.lists.find((l) => l.id === listId)?.unassigned ?? 0)
    : data.lists.reduce((s, l) => s + (l.anonymized_at ? 0 : l.unassigned), 0)
  const cityInfo = city ? data.cities.find((c) => c.city === city)?.n : null
  const people = mode === "round_robin" ? selected.length : manualAgent ? 1 : 0
  const base = cityInfo ?? available
  const total = count ? Math.min(Number(count) || 0, base) : base
  const each = people ? Math.floor(total / people) : 0

  const toggle = (id: string) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]))

  const assign = async () => {
    setMsg({ ok: "", error: "" })
    const ids = mode === "round_robin" ? selected : manualAgent ? [manualAgent] : []
    if (ids.length === 0) {
      setMsg({ ok: "", error: "Scegli almeno un agente" })
      return
    }
    setBusy(true)
    try {
      const res = await assignLeads({
        mode,
        agent_ids: ids,
        ...(listId ? { list_id: listId } : {}),
        ...(city ? { city } : {}),
        ...(sector ? { sector } : {}),
        ...(count ? { count: Number(count) } : {}),
      })
      const detail = Object.entries(res.per_agent)
        .map(([id, n]) => `${data.agents.find((a) => a.id === id)?.first_name ?? "?"}: ${n}`)
        .join(" · ")
      setMsg({ ok: res.assigned ? `Assegnati ${res.assigned} contatti (${detail})` : "Nessun contatto da assegnare con questi filtri", error: "" })
      await reload()
    } catch (e) {
      setMsg({ ok: "", error: errorText(e) })
    } finally {
      setBusy(false)
    }
  }

  const release = async (agentId: string, name: string) => {
    if (!window.confirm(`Riprendere i contatti non ancora chiamati da ${name}? Tornano disponibili per una nuova assegnazione.`)) return
    setMsg({ ok: "", error: "" })
    try {
      const res = await releaseAgentLeads(agentId, listId || undefined)
      setMsg({ ok: `${res.released} contatti ripresi da ${name}`, error: "" })
      await reload()
    } catch (e) {
      setMsg({ ok: "", error: errorText(e) })
    }
  }

  return (
    <div className="lh-assign">
      <UntreatedSummary data={data} />
      <section className="panel standalone-panel">
        <div className="panel-heading">
          <div>
            <p className="panel-kicker neutral">Contatti non ancora assegnati</p>
            <h2>
              Distribuisci i contatti <span className="task-count">{available}</span>
            </h2>
          </div>
        </div>
        <div className="lh-pad">
          <Flash ok={msg.ok} error={msg.error} onClose={() => setMsg({ ok: "", error: "" })} />
          <div className="lh-filters">
            <label>
              <span>Lista</span>
              <select value={listId} onChange={(e) => setListId(e.target.value)}>
                <option value="">Tutte le liste</option>
                {lists.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name} ({l.unassigned})
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>Zona / città</span>
              <select value={city} onChange={(e) => setCity(e.target.value)}>
                <option value="">Tutte le città</option>
                {data.cities.map((c) => (
                  <option key={c.city} value={c.city}>
                    {c.city} ({c.n})
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>Settore</span>
              <select value={sector} onChange={(e) => setSector(e.target.value)}>
                <option value="">Tutti i settori</option>
                {data.sectors
                  .filter((s) => s.sector !== "—")
                  .map((s) => (
                    <option key={s.sector} value={s.sector}>
                      {s.sector} ({s.n})
                    </option>
                  ))}
              </select>
            </label>
          </div>

          <div className="chip-row lh-mode">
            <button type="button" className={`chip ${mode === "round_robin" ? "on" : ""}`} onClick={() => setMode("round_robin")}>
              Equa (round-robin)
            </button>
            <button type="button" className={`chip ${mode === "manual" ? "on" : ""}`} onClick={() => setMode("manual")}>
              Manuale a un agente
            </button>
          </div>

          {data.agents.length === 0 ? (
            <p className="form-error">
              Nessun agente attivo con il permesso LeadHub.{" "}
              {onOpenAgents && (
                <button type="button" className="lh-link" onClick={onOpenAgents}>
                  Apri Agenti &amp; permessi
                </button>
              )}
            </p>
          ) : (
            <div className="lh-agent-list">
              {data.agents.map((a) => (
                <div className="lh-agent" key={a.id}>
                  <label>
                    {mode === "round_robin" ? (
                      <input type="checkbox" checked={selected.includes(a.id)} onChange={() => toggle(a.id)} />
                    ) : (
                      <input type="radio" name="manual-agent" checked={manualAgent === a.id} onChange={() => setManualAgent(a.id)} />
                    )}
                    <span className="mini-avatar">{`${a.first_name[0] ?? ""}${a.last_name[0] ?? ""}`.toUpperCase()}</span>
                    <span className="lh-agent-name">
                      <strong>
                        {a.first_name} {a.last_name}
                      </strong>
                      <small>
                        {a.to_call} da chiamare ({listsOf(a.to_call)}) · {a.assigned} assegnati
                      </small>
                    </span>
                  </label>
                  {a.to_call > 0 && (
                    <button type="button" className="link-button" onClick={() => release(a.id, `${a.first_name} ${a.last_name}`)}>
                      Riprendi non lavorati
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}

          <div className="lh-assign-foot">
            {mode === "manual" && (
              <label className="lh-count">
                <span>Quanti contatti</span>
                <input type="number" min={1} inputMode="numeric" placeholder="Tutti" value={count} onChange={(e) => setCount(e.target.value)} />
              </label>
            )}
            <p className="lh-preview">
              {total > 0 && people > 0
                ? mode === "round_robin"
                  ? `${total} contatti su ${people} agenti: circa ${each} a testa`
                  : `${total} contatti a un agente`
                : "Niente da assegnare con questi filtri"}
            </p>
            <button type="button" className="primary-button" disabled={busy || total === 0 || people === 0} onClick={assign}>
              {busy ? "Assegno…" : "Assegna ora"}
            </button>
          </div>
          {onOpenAgents && (
            <button type="button" className="lh-link" onClick={onOpenAgents}>
              Aggiungi, modifica o disattiva agenti in «Agenti &amp; permessi» →
            </button>
          )}
        </div>
      </section>
    </div>
  )
}

/* ================= CONTROL ROOM ================= */

const feedText = (kind: string, outcome: string | null) => {
  if (kind === "appointment_result") return outcome === "contratto_chiuso" ? "ha chiuso un contratto" : "ha annullato un appuntamento"
  if (outcome === "appuntamento") return "ha fissato un appuntamento"
  if (outcome === "numero_errato") return "ha segnalato un numero inesistente"
  if (outcome === "persona_sbagliata") return "ha segnalato trasferito / persona sbagliata"
  return `esito: ${outcomeLabel[(outcome ?? "nuovo") as keyof typeof outcomeLabel] ?? outcome}`
}

function ControlTab() {
  const [data, setData] = useState<ControlData | null>(null)
  const [error, setError] = useState("")
  const [tick, setTick] = useState(Date.now())

  const load = useCallback(async () => {
    try {
      setData(await fetchControlRoom())
      setError("")
    } catch (e) {
      setError(errorText(e))
    }
  }, [])

  useEffect(() => {
    load()
    const t = setInterval(() => {
      if (!document.hidden) load()
      setTick(Date.now())
    }, 10000)
    return () => clearInterval(t)
  }, [load])

  const sum = (key: "calls" | "appointments" | "closed" | "dials") => data?.agents.reduce((s, a) => s + a[key], 0) ?? 0
  const calls = sum("calls")
  const rate = calls > 0 ? Math.round((sum("appointments") / calls) * 100) : 0
  const live = data?.session.active ?? false

  const dot = (last: string | null, toCall: number) => {
    if (!last) return <span className="light" style={{ background: "var(--line-strong)" }} title="Nessuna attività oggi" />
    const min = (tick - new Date(last).getTime()) / 60000
    const cls = min < 5 ? "green" : min < 15 ? "yellow" : toCall > 0 && live ? "red" : "yellow"
    return <span className={`light ${cls}`} />
  }

  return (
    <div className="settings-stack">
      <div className="lh-live-head">
        <span className={`lh-live ${error ? "off" : ""}`}>
          <i /> {error ? "Connessione persa" : "Live · aggiornamento ogni 10 s"}
        </span>
        <SessionBadge session={data?.session} />
      </div>
      {data && (
        <section className="panel standalone-panel">
          <div className="lh-pad lh-hours">
            <div>
              <strong>Orario Call Mode</strong>
              <p className="muted">Per tutti dalle {data.session.start}. Fuori orario i nuovi contatti non si vedono e i pulsanti Chiama ed esito spariscono.</p>
            </div>
            <div className="chip-row">
              {data.end_options.map((o) => (
                <button
                  key={o}
                  type="button"
                  className={`chip ${data.session.end === o ? "on" : ""}`}
                  onClick={async () => {
                    try {
                      await saveLeadSettings(o)
                      await load()
                    } catch (e) {
                      setError(errorText(e))
                    }
                  }}
                >
                  fino alle {o}
                </button>
              ))}
            </div>
          </div>
        </section>
      )}
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}

      <div className="metrics-grid lh-metrics">
        {data && (
          <article className="metric-card">
            <div className="metric-icon violet">
              <LIcon name="calendar" />
            </div>
            <div className="metric-copy">
              <p className="eyebrow">Media appuntamenti</p>
              <div className="metric-row">
                <strong>{data.average.avg.toLocaleString("it-IT")}</strong>
              </div>
              <p className="muted">
                {data.average.total} fissati da {data.average.agents} agenti che hanno chiamato
              </p>
            </div>
          </article>
        )}
        <article className="metric-card">
          <div className="metric-icon blue">
            <LIcon name="phone" />
          </div>
          <div className="metric-copy">
            <p className="eyebrow">Chiamate fatte</p>
            <div className="metric-row">
              <strong>{calls}</strong>
            </div>
            <p className="muted">{sum("dials")} avviate con «Chiama ora»</p>
          </div>
        </article>
        <article className="metric-card">
          <div className="metric-icon orange">
            <LIcon name="calendar" />
          </div>
          <div className="metric-copy">
            <p className="eyebrow">Appuntamenti presi</p>
            <div className="metric-row">
              <strong>{sum("appointments")}</strong>
            </div>
            <p className="muted">oggi</p>
          </div>
        </article>
        <article className="metric-card">
          <div className="metric-icon green">
            <LIcon name="check" />
          </div>
          <div className="metric-copy">
            <p className="eyebrow">Contratti chiusi</p>
            <div className="metric-row">
              <strong>{sum("closed")}</strong>
            </div>
            <p className="muted">dagli appuntamenti</p>
          </div>
        </article>
        <article className="metric-card">
          <div className="metric-icon violet">
            <LIcon name="euro" />
          </div>
          <div className="metric-copy">
            <p className="eyebrow">Conversione</p>
            <div className="metric-row">
              <strong>{rate}%</strong>
            </div>
            <p className="muted">appuntamenti / chiamate</p>
          </div>
        </article>
      </div>

      <section className="panel standalone-panel">
        <div className="panel-heading">
          <div>
            <p className="panel-kicker neutral">{data ? new Date(data.day + "T12:00:00").toLocaleDateString("it-IT", { weekday: "long", day: "numeric", month: "long" }) : "Oggi"}</p>
            <h2>Agenti in chiamata</h2>
          </div>
        </div>
        {!data ? (
          <p className="muted pad">Caricamento…</p>
        ) : data.agents.length === 0 ? (
          <p className="muted pad">Nessun agente ha lead assegnati o attività oggi.</p>
        ) : (
          <div className="lh-scroll">
            <div className="lh-table control">
              <div className="lh-tr head">
                <span>Agente</span>
                <span>Chiamate</span>
                <span>Contatti</span>
                <span>Appunt.</span>
                <span>Chiusi</span>
                <span>Conv.</span>
                <span>Avanzamento</span>
                <span>Ultima attività</span>
              </div>
              {data.agents.map((a) => {
                const total = a.assigned
                // trattati = lead esitati oggi (uno per lead), sul totale degli assegnati del giorno
                const pct = total > 0 ? Math.min(100, Math.round((a.worked / total) * 100)) : 0
                return (
                  <div className="lh-tr" key={a.id}>
                    <span>
                      <strong>
                        {a.first_name} {a.last_name}
                      </strong>
                      <small className="cell-note">
                        {a.not_interested} no · {a.callbacks} richiami · {a.voicemail} segr. · {a.wrong} inesistenti · {a.moved} trasferiti
                      </small>
                    </span>
                    <span>
                      <b>{a.calls}</b>
                    </span>
                    <span>
                      <b>{a.contacts}</b>
                    </span>
                    <span>{a.appointments}</span>
                    <span>{a.closed}</span>
                    <span>{a.calls > 0 ? `${Math.round((a.appointments / a.calls) * 100)}%` : "—"}</span>
                    <span className="lh-progress-cell">
                      <span className="progress">
                        <span className="orange" style={{ width: `${pct}%` }} />
                      </span>
                      <small>
                        {a.worked}/{total}
                      </small>
                    </span>
                    <span className="lh-last">
                      {dot(a.last_activity, a.to_call)} {ago(a.last_activity, tick)}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </section>

      <section className="panel standalone-panel">
        <div className="panel-heading">
          <div>
            <p className="panel-kicker neutral">Ultimi esiti</p>
            <h2>Attività recente</h2>
          </div>
        </div>
        <div className="doc-list">
          {(!data || data.feed.length === 0) && <p className="muted pad">Ancora nessuna attività oggi.</p>}
          {data?.feed.map((f) => (
            <div className="doc-row" key={f.id}>
              <LIcon name={f.outcome === "contratto_chiuso" ? "check" : f.outcome === "appuntamento" ? "calendar" : "phone"} size={17} />
              <div>
                <strong>
                  {f.first_name} {f.last_name} {feedText(f.kind, f.outcome)}
                </strong>
                <small>
                  {f.sector ?? "—"} · {ago(f.created_at, tick)}
                </small>
              </div>
              {f.outcome === "appuntamento" || f.outcome === "contratto_chiuso" ? (
                <Badge tone="green">{f.outcome === "contratto_chiuso" ? "Chiuso" : "Fissato"}</Badge>
              ) : f.outcome === "non_interessato" || f.outcome === "numero_errato" || f.outcome === "persona_sbagliata" || f.outcome === "annullato" ? (
                <Badge tone="red">{f.outcome === "non_interessato" ? "No" : f.outcome === "annullato" ? "Annullato" : f.outcome === "persona_sbagliata" ? "Trasferito" : "Inesistente"}</Badge>
              ) : (
                <Badge tone="yellow">In corso</Badge>
              )}
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}

/* ================= REPORT E PULIZIA ================= */

const FIELD_LABEL: Record<string, string> = { first_name: "Nome", last_name: "Cognome", phone: "Telefono", phone2: "Secondo numero", address: "Via", house_number: "Civico", street_type: "Tipo via", provider: "Gestore", notes: "Note", city: "Città", fiscal_code: "Cod. fiscale", sector: "Tipologia" }

function ReportTab({ data, reload }: { data: LeadAdminData; reload: () => Promise<void> }) {
  const [listId, setListId] = useState("")
  const [report, setReport] = useState<ReportData | null>(null)
  const [msg, setMsg] = useState({ ok: "", error: "" })
  const [busy, setBusy] = useState(false)
  const [exportOutcome, setExportOutcome] = useState("segreteria")

  const load = useCallback(async () => {
    try {
      setReport(await fetchLeadReport(listId || undefined))
    } catch (e) {
      setMsg({ ok: "", error: errorText(e) })
    }
  }, [listId])

  useEffect(() => {
    setReport(null)
    load()
  }, [load])

  const list = data.lists.find((l) => l.id === listId)

  const exportByOutcome = async () => {
    setBusy(true)
    try {
      const res = await fetchLeadReport(listId || undefined, false, exportOutcome)
      downloadCsv(`contatti-${exportOutcome}${list ? "-" + list.name.replace(/\W+/g, "-") : ""}.csv`, [
        ["Lista", "Nome", "Cognome", "Telefono", "Telefono 2", "Via", "Civico", "Città", "Provincia", "Codice fiscale", "Settore", "Gestore", "Esito", "Data esito", "Tentativi", "Appuntamento", "Esito appuntamento", "Note", "Agente"],
        ...res.by_outcome.map((r) => [
          r.list_name, r.first_name, r.last_name, r.phone, r.phone2, r.address, r.house_number, r.city, r.province, r.fiscal_code, r.sector, r.provider,
          outcomeLabel[(r.outcome ?? "nuovo") as keyof typeof outcomeLabel] ?? r.outcome,
          r.outcome_at ? dateTimeIt(r.outcome_at) : null,
          r.call_count,
          r.appointment_at ? dateTimeIt(r.appointment_at) : null,
          r.appointment_result, r.notes,
          [r.agent_first_name, r.agent_last_name].filter(Boolean).join(" ") || null,
        ]),
      ])
      setMsg({ ok: `Scaricati ${res.by_outcome.length} contatti con esito «${outcomeLabel[exportOutcome as keyof typeof outcomeLabel] ?? exportOutcome}»`, error: "" })
    } catch (e) {
      setMsg({ ok: "", error: errorText(e) })
    } finally {
      setBusy(false)
    }
  }

  const exportClean = async () => {
    if (!listId) return
    setBusy(true)
    try {
      const res = await fetchLeadReport(listId, true)
      const rows: (string | null)[][] = [
        ["Nome", "Cognome", "Telefono", "Via", "Civico", "Città", "Provincia", "Settore", "Esito", "Appuntamento", "Esito appuntamento", "Note", "Agente"],
        ...res.clean.map((r) => [
          r.first_name,
          r.last_name,
          r.phone,
          r.address,
          r.house_number,
          r.city,
          r.province,
          r.sector,
          outcomeLabel[(r.outcome ?? "nuovo") as keyof typeof outcomeLabel] ?? r.outcome,
          r.appointment_at ? dateTimeIt(r.appointment_at) : null,
          r.appointment_result,
          r.notes,
          [r.agent_first_name, r.agent_last_name].filter(Boolean).join(" ") || null,
        ]),
      ]
      downloadCsv(`dati-puliti-${(list?.name ?? "lista").replace(/\W+/g, "-")}.csv`, rows)
      setMsg({ ok: `Esportati ${res.clean.length} contatti con i dati corretti dagli agenti`, error: "" })
    } catch (e) {
      setMsg({ ok: "", error: errorText(e) })
    } finally {
      setBusy(false)
    }
  }

  const exportCorrections = () => {
    if (!report) return
    downloadCsv("segnalazioni-lead.csv", [
      ["Lista", "Tipo", "Nome", "Cognome", "Telefono", "Indirizzo", "Città", "Valori originali", "Agente", "Data"],
      ...report.corrections.map((c) => [
        c.list_name,
        c.wrong_number ? (c.outcome === "persona_sbagliata" ? "Trasferito / persona sbagliata" : "Numero inesistente") : "Dati corretti",
        c.first_name,
        c.last_name,
        c.phone,
        c.address,
        c.city,
        c.orig_data ? Object.entries(c.orig_data).map(([k, v]) => `${FIELD_LABEL[k] ?? k}: ${v ?? "—"}`).join(" | ") : null,
        [c.agent_first_name, c.agent_last_name].filter(Boolean).join(" ") || null,
        dateTimeIt((c.corrected_at ?? c.outcome_at) as string),
      ]),
    ])
  }

  const wrongCount = report?.corrections.filter((c) => c.wrong_number).length ?? 0

  const deleteWrong = async () => {
    if (!window.confirm(`Eliminare dal database ${wrongCount} contatti segnalati come inesistenti o trasferiti${list ? ` nella lista "${list.name}"` : ""}?`)) return
    setBusy(true)
    try {
      const res = await deleteWrongLeads(listId || undefined)
      setMsg({ ok: `${res.deleted} contatti eliminati`, error: "" })
      await Promise.all([load(), reload()])
    } catch (e) {
      setMsg({ ok: "", error: errorText(e) })
    } finally {
      setBusy(false)
    }
  }

  const purge = async () => {
    if (!list || !window.confirm(`Anonimizzare ORA tutti i contatti di "${list.name}"? L'operazione non si può annullare.`)) return
    setBusy(true)
    try {
      const res = await purgeLeadList(list.id)
      setMsg({ ok: `${res.anonymized} contatti anonimizzati`, error: "" })
      await Promise.all([load(), reload()])
    } catch (e) {
      setMsg({ ok: "", error: errorText(e) })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="settings-stack">
      <section className="panel standalone-panel">
        <div className="panel-heading">
          <div>
            <p className="panel-kicker neutral">Cosa hanno corretto o segnalato gli agenti</p>
            <h2>Report e pulizia</h2>
          </div>
        </div>
        <div className="lh-pad">
          <Flash ok={msg.ok} error={msg.error} onClose={() => setMsg({ ok: "", error: "" })} />
          <div className="lh-filters">
            <label>
              <span>Lista</span>
              <select value={listId} onChange={(e) => setListId(e.target.value)}>
                <option value="">Tutte le liste</option>
                {data.lists.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="chip-row">
            {(report?.summary ?? []).map((s) => (
              <span key={s.outcome} className="lh-summary-chip">
                <OutcomeBadge value={s.outcome} /> <b>{s.n}</b>
              </span>
            ))}
          </div>
          <div className="lh-export-outcome">
            <label>
              <span>Scarica i contatti per esito</span>
              <select value={exportOutcome} onChange={(e) => setExportOutcome(e.target.value)}>
                {(["nuovo", "appuntamento", "da_ricontattare", "non_interessato", "segreteria", "persona_sbagliata", "numero_errato"] as const).map((o) => (
                  <option key={o} value={o}>
                    {outcomeLabel[o]}
                  </option>
                ))}
              </select>
            </label>
            <button type="button" className="secondary-button" disabled={busy} onClick={exportByOutcome}>
              <LIcon name="download" size={15} /> Scarica elenco {listId ? "della lista" : "di tutte le liste"}
            </button>
          </div>
          <div className="lh-actions-row left">
            <button type="button" className="secondary-button" disabled={busy || !listId || !!list?.anonymized_at} onClick={exportClean} title={listId ? "" : "Scegli una lista"}>
              <LIcon name="download" size={15} /> Esporta dati puliti
            </button>
            <button type="button" className="secondary-button" disabled={!report || report.corrections.length === 0} onClick={exportCorrections}>
              <LIcon name="download" size={15} /> Esporta segnalazioni
            </button>
            <button type="button" className="secondary-button" disabled={busy || wrongCount === 0} onClick={deleteWrong}>
              <LIcon name="trash" size={15} /> Elimina inesistenti e trasferiti ({wrongCount})
            </button>
            <button type="button" className="secondary-button danger-outline" disabled={busy || !list || !!list.anonymized_at} onClick={purge}>
              <LIcon name="shield" size={15} /> Ripulisci lista (anonimizza)
            </button>
          </div>
          {!listId && <p className="modal-hint lh-hint">Per esportare i dati puliti o ripulire il database scegli una lista.</p>}
        </div>
      </section>

      <section className="panel standalone-panel">
        <div className="panel-heading">
          <div>
            <p className="panel-kicker neutral">Contatti modificati o segnalati</p>
            <h2>
              Correzioni <span className="task-count">{report?.corrections.length ?? 0}</span>
            </h2>
          </div>
        </div>
        {!report ? (
          <p className="muted pad">Caricamento…</p>
        ) : report.corrections.length === 0 ? (
          <p className="muted pad">Nessuna correzione o segnalazione finora.</p>
        ) : (
          <div className="lh-scroll">
            <div className="lh-table report">
              <div className="lh-tr head">
                <span>Contatto</span>
                <span>Segnalazione</span>
                <span>Valore originale → corretto</span>
                <span>Agente</span>
                <span>Quando</span>
              </div>
              {report.corrections.map((c) => (
                <div className="lh-tr" key={c.id}>
                  <span>
                    <strong>{fullName(c)}</strong>
                    <small className="cell-note">
                      {c.list_name} · {c.phone ?? "—"}
                    </small>
                  </span>
                  <span>{c.wrong_number ? <Badge tone="red">{c.outcome === "persona_sbagliata" ? "Trasferito / persona sbagliata" : "Numero inesistente"}</Badge> : <Badge tone="yellow">Dati corretti</Badge>}</span>
                  <span className="lh-diff">
                    {c.orig_data
                      ? Object.entries(c.orig_data).map(([k, v]) => (
                          <small key={k}>
                            <b>{FIELD_LABEL[k] ?? k}:</b> <s>{v || "—"}</s> → {(c as unknown as Record<string, string | null>)[k] || "—"}
                          </small>
                        ))
                      : "—"}
                  </span>
                  <span>{[c.agent_first_name, c.agent_last_name].filter(Boolean).join(" ") || "—"}</span>
                  <span>{dateTimeIt((c.corrected_at ?? c.outcome_at) as string)}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>
    </div>
  )
}

/* ================= PAGINA ================= */

export function LeadHubAdminPage({ onOpenAgents }: { onOpenAgents?: () => void }) {
  const [tab, setTab] = useState<Tab>("liste")
  const [data, setData] = useState<LeadAdminData | null>(null)
  const [error, setError] = useState("")

  const reload = useCallback(async () => {
    try {
      setData(await fetchLeadAdmin())
      setError("")
    } catch (e) {
      setError(errorText(e))
    }
  }, [])

  useEffect(() => {
    reload()
  }, [reload])

  return (
    <div className="lh-admin">
      <div className="filter-row lh-tabs" role="tablist">
        {TABS.map((t) => (
          <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} className={`chip ${tab === t.id ? "on" : ""}`} onClick={() => setTab(t.id)}>
            <LIcon name={t.icon} size={14} /> {t.label}
          </button>
        ))}
      </div>
      {error && (
        <p className="form-error" role="alert">
          {error}{" "}
          <button type="button" className="lh-link" onClick={reload}>
            Riprova
          </button>
        </p>
      )}
      {tab === "control" ? (
        <ControlTab />
      ) : !data ? (
        !error && <p className="muted">Caricamento…</p>
      ) : tab === "liste" ? (
        <ListsTab data={data} reload={reload} />
      ) : tab === "assegnazione" ? (
        <AssignTab data={data} reload={reload} onOpenAgents={onOpenAgents} />
      ) : (
        <ReportTab data={data} reload={reload} />
      )}
    </div>
  )
}
