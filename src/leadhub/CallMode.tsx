import { useCallback, useEffect, useRef, useState, type ReactNode } from "react"
import {
  dialLead,
  editLead,
  fetchQueue,
  markWrongNumber,
  searchLeads,
  setLeadOutcome,
  undoLeadOutcome,
  type LeadEdit,
  type QueueData,
  type QueueLead,
  type SearchHit,
} from "../services/leadsApi"
import {
  Badge,
  DateTimePicker,
  LIcon,
  OutcomeBadge,
  SessionBadge,
  dateTimeIt,
  errorText,
  fullName,
  localDateIso,
  useOnline,
} from "./shared"

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

/* ---------- Campo modificabile con un click ---------- */

function InlineField({
  label,
  value,
  placeholder,
  size = "normal",
  type = "text",
  upper = false,
  multiline = false,
  box = false,
  autoEdit = false,
  maxLength,
  onDone,
  onSave,
}: {
  label: string
  value: string | null
  placeholder: string
  size?: "big" | "normal"
  type?: "text" | "tel"
  upper?: boolean
  multiline?: boolean
  box?: boolean
  /** parte direttamente in modifica (es. nuovo secondo numero) */
  autoEdit?: boolean
  maxLength?: number
  /** chiamato quando la modifica finisce (salvata, annullata o invariata) */
  onDone?: () => void
  onSave: (value: string) => Promise<void>
}) {
  const [editing, setEditing] = useState(autoEdit)
  const [draft, setDraft] = useState(value ?? "")
  const [state, setState] = useState<"idle" | "saving" | "saved">("idle")
  const [error, setError] = useState("")
  const cancelled = useRef(false)

  useEffect(() => {
    if (!editing) setDraft(value ?? "")
  }, [value, editing])

  const commit = async () => {
    if (cancelled.current) {
      cancelled.current = false
      setEditing(false)
      onDone?.()
      return
    }
    const next = draft.trim()
    if (next === (value ?? "")) {
      setEditing(false)
      onDone?.()
      return
    }
    setState("saving")
    setError("")
    try {
      await onSave(next)
      setEditing(false)
      onDone?.()
      setState("saved")
      setTimeout(() => setState("idle"), 1400)
    } catch (e) {
      setError(errorText(e))
      setState("idle")
    }
  }

  return (
    <div className={`lh-field ${size} ${box ? "box" : ""}`}>
      <span className="lh-field-label">
        {label}
        {state === "saving" && <em>Salvataggio…</em>}
        {state === "saved" && (
          <em className="ok">
            <LIcon name="check" size={11} /> Salvato
          </em>
        )}
      </span>
      {editing && multiline ? (
        <textarea
          autoFocus
          rows={3}
          value={draft}
          placeholder={placeholder}
          disabled={state === "saving"}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              cancelled.current = true
              ;(e.target as HTMLTextAreaElement).blur()
            }
          }}
        />
      ) : editing ? (
        <input
          autoFocus
          type={type}
          maxLength={maxLength}
          inputMode={type === "tel" ? "tel" : undefined}
          value={draft}
          placeholder={placeholder}
          style={upper ? { textTransform: "uppercase" } : undefined}
          disabled={state === "saving"}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") (e.target as HTMLInputElement).blur()
            if (e.key === "Escape") {
              cancelled.current = true
              ;(e.target as HTMLInputElement).blur()
            }
          }}
        />
      ) : (
        <button type="button" className={`lh-field-value ${value ? "" : "empty"}`} onClick={() => setEditing(true)} title="Tocca per modificare">
          <span>{value || placeholder}</span>
          <LIcon name="pencil" size={13} />
        </button>
      )}
      {error && <p className="lh-field-error">{error}</p>}
    </div>
  )
}

/* ---------- Fogli dal basso: appuntamento e richiamo ---------- */

function useNowSlot() {
  const d = new Date(Date.now() + 3600000)
  d.setMinutes(Math.ceil(d.getMinutes() / 15) * 15, 0, 0)
  return { date: localDateIso(d), time: `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}` }
}

function Sheet({ title, children, onCancel }: { title: string; children: ReactNode; onCancel: () => void }) {
  return (
    <div className="lh-sheet-layer" onClick={onCancel}>
      <div className="lh-sheet" role="dialog" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <div className="lh-sheet-grip" />
        <h2>{title}</h2>
        {children}
      </div>
    </div>
  )
}

function AppointmentSheet({ busy, onCancel, onConfirm }: { busy: boolean; onCancel: () => void; onConfirm: (iso: string, note: string) => void }) {
  const slot = useNowSlot()
  const [date, setDate] = useState(slot.date)
  const [time, setTime] = useState(slot.time)
  const [note, setNote] = useState("")
  const [error, setError] = useState("")

  const confirm = () => {
    const d = new Date(`${date}T${time}`)
    if (isNaN(d.getTime())) return setError("Scegli data e ora dell'appuntamento")
    onConfirm(d.toISOString(), note.trim())
  }
  return (
    <Sheet title="Fissa appuntamento" onCancel={onCancel}>
      <DateTimePicker date={date} time={time} onChange={(d, t) => (setDate(d), setTime(t))} />
      <label className="lh-sheet-note">
        <span>Nota (facoltativa)</span>
        <input type="text" maxLength={500} value={note} placeholder="Es. citofono, orario migliore…" onChange={(e) => setNote(e.target.value)} />
      </label>
      {error && <p className="form-error">{error}</p>}
      <div className="lh-sheet-actions">
        <button type="button" className="lh-big secondary" onClick={onCancel} disabled={busy}>
          Annulla
        </button>
        <button type="button" className="lh-big green" onClick={confirm} disabled={busy}>
          <LIcon name="check" size={20} /> {busy ? "Salvo…" : "Salva appuntamento"}
        </button>
      </div>
    </Sheet>
  )
}

function CallbackSheet({ busy, onCancel, onConfirm }: { busy: boolean; onCancel: () => void; onConfirm: (iso: string | null) => void }) {
  const slot = useNowSlot()
  const [custom, setCustom] = useState(false)
  const [date, setDate] = useState(slot.date)
  const [time, setTime] = useState(slot.time)

  return (
    <Sheet title="Quando lo richiami?" onCancel={onCancel}>
      {!custom ? (
        <div className="lh-cb-options">
          <button type="button" className="lh-big yellow" disabled={busy} onClick={() => onConfirm(null)}>
            <LIcon name="clock" size={20} /> Fra un'ora
          </button>
          <button type="button" className="lh-big secondary" disabled={busy} onClick={() => setCustom(true)}>
            <LIcon name="calendar" size={20} /> Seleziona giorno e ora
          </button>
        </div>
      ) : (
        <>
          <DateTimePicker date={date} time={time} onChange={(d, t) => (setDate(d), setTime(t))} />
          <div className="lh-sheet-actions">
            <button type="button" className="lh-big secondary" onClick={() => setCustom(false)} disabled={busy}>
              Indietro
            </button>
            <button type="button" className="lh-big yellow" onClick={() => onConfirm(new Date(`${date}T${time}`).toISOString())} disabled={busy}>
              <LIcon name="check" size={20} /> {busy ? "Salvo…" : "Salva richiamo"}
            </button>
          </div>
        </>
      )}
      <p className="lh-sheet-hint">Il richiamo viene inserito anche in Agenda lead e nel Calendario.</p>
      {!custom && (
        <button type="button" className="lh-big secondary" onClick={onCancel} disabled={busy}>
          Annulla
        </button>
      )}
    </Sheet>
  )
}

/* ---------- Risultati della ricerca (la barra e' quella in alto) ---------- */

function LeadSearchResults({ query, onPick, onClose }: { query: string; onPick: (id: string) => void; onClose: () => void }) {
  const [hits, setHits] = useState<SearchHit[]>([])
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const q = query.trim()
  const numeric = /^[\d\s+()./-]+$/.test(q)
  const valid = numeric ? q.replace(/\D/g, "").length >= 3 : q.length >= 2

  useEffect(() => {
    if (!valid) {
      setHits([])
      return
    }
    setLoading(true)
    const t = setTimeout(async () => {
      try {
        const res = await searchLeads(q)
        setHits(res.results)
        setError("")
      } catch (e) {
        setError(errorText(e))
      } finally {
        setLoading(false)
      }
    }, 250)
    return () => clearTimeout(t)
  }, [q, valid])

  if (!q) return null
  return (
    <div className="lh-search">
      <div className="lh-search-head">
        <span>Ricerca tra i tuoi lead: «{q}»</span>
        <button type="button" className="icon-button" onClick={onClose} title="Chiudi ricerca">
          <LIcon name="close" size={15} />
        </button>
      </div>
      {!valid && <p className="lh-search-empty">Scrivi almeno 3 cifre del numero (anche solo le ultime) oppure 2 lettere del nome.</p>}
      {error && <p className="form-error">{error}</p>}
      {valid && !loading && hits.length === 0 && !error && <p className="lh-search-empty">Nessun contatto tra i tuoi.</p>}
      {hits.map((h) => (
        <button type="button" key={h.id} className="lh-hit" onClick={() => onPick(h.id)}>
          <span>
            <strong>{fullName(h)}</strong>
            <small>
              {h.phone} {h.city ? `· ${h.city}` : ""}
            </small>
          </span>
          <OutcomeBadge value={h.outcome} />
        </button>
      ))}
    </div>
  )
}

/* ---------- Pagina Call Mode ---------- */

type SheetKind = null | "appointment" | "callback"

export function CallModePage({ query, onClearQuery }: { query: string; onClearQuery: () => void }) {
  const online = useOnline()
  const [data, setData] = useState<QueueData | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState("")
  const [actionError, setActionError] = useState("")
  const [notice, setNotice] = useState("")
  const [busy, setBusy] = useState(false)
  const [leaving, setLeaving] = useState(false)
  const [sheet, setSheet] = useState<SheetKind>(null)
  const [note, setNote] = useState("")
  const [showNote, setShowNote] = useState(false)
  const [dialed, setDialed] = useState(false)
  const [addingPhone2, setAddingPhone2] = useState(false)
  const [skipped, setSkipped] = useState<string[]>([])
  const [toast, setToast] = useState<{ text: string; leadId: string } | null>(null)
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // filtro per citta': si ricorda anche se chiudi l'app
  const [cityFilter, setCityFilter] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem("lh_call_cities") ?? "[]")
    } catch {
      return []
    }
  })
  const [cityOpen, setCityOpen] = useState(false)
  const citiesRef = useRef<string[]>(cityFilter)

  const load = useCallback(async (exclude: string[], focus?: string) => {
    setLoadError("")
    try {
      const next = await fetchQueue(exclude, focus, citiesRef.current ?? [])
      setData(next)
      setNote("")
      setShowNote(false)
      setDialed(false)
      setAddingPhone2(false)
      setActionError("")
      return true
    } catch (e) {
      setLoadError(errorText(e))
      return false
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load([])
  }, [load])

  // con la coda vuota controlla ogni 30 secondi se sono arrivati nuovi lead o richiami
  const lead = data?.lead ?? null
  useEffect(() => {
    if (lead || loading) return
    const t = setInterval(() => load(skipped), 30000)
    return () => clearInterval(t)
  }, [lead, loading, load, skipped])

  const showToast = (text: string, leadId: string) => {
    if (toastTimer.current) clearTimeout(toastTimer.current)
    setToast({ text, leadId })
    toastTimer.current = setTimeout(() => setToast(null), 8000)
  }

  /** Salva l'esito, poi passa al lead successivo con una breve transizione */
  const commit = async (run: () => Promise<unknown>, toastText: string) => {
    if (!lead || busy) return
    setBusy(true)
    setActionError("")
    const leadId = lead.id
    try {
      await run()
    } catch (e) {
      setActionError(errorText(e))
      setBusy(false)
      return
    }
    setSheet(null)
    setLeaving(true)
    await sleep(160)
    await load(skipped)
    showToast(toastText, leadId)
    setLeaving(false)
    setBusy(false)
  }

  const quickOutcome = (outcome: "non_interessato" | "segreteria") => {
    if (!lead) return
    commit(
      () => setLeadOutcome(lead.id, outcome, note.trim() ? { note: note.trim() } : {}),
      outcome === "segreteria" ? "Segreteria/NR: il contatto va a fine lista" : "Non interessato",
    )
  }

  const saveAppointment = (iso: string, apptNote: string) => {
    if (!lead) return
    const merged = [note.trim(), apptNote].filter(Boolean).join(" · ")
    commit(
      () => setLeadOutcome(lead.id, "appuntamento", { appointment_at: iso, ...(merged ? { note: merged } : {}) }),
      `Appuntamento fissato: ${dateTimeIt(iso)}`,
    )
  }

  const saveCallback = (iso: string | null) => {
    if (!lead) return
    commit(
      () => setLeadOutcome(lead.id, "da_ricontattare", { ...(iso ? { callback_at: iso } : {}), ...(note.trim() ? { note: note.trim() } : {}) }),
      iso ? `Richiamo fissato: ${dateTimeIt(iso)}` : "Richiamo fra un'ora (in Agenda lead)",
    )
  }

  const wrongNumber = (reason: "inesistente" | "persona_sbagliata") => {
    if (!lead) return
    const ask =
      reason === "inesistente"
        ? "Segnalare questo numero come inesistente? Esce dalla lista."
        : "Segnalare il contatto come trasferito / persona sbagliata? Esce dalla lista e conta come contatto."
    if (!window.confirm(ask)) return
    commit(
      () => markWrongNumber(lead.id, reason),
      reason === "inesistente" ? "Numero segnalato come inesistente" : "Segnato come trasferito / persona sbagliata (conta come contatto)",
    )
  }

  const skip = async () => {
    if (!lead) return
    const next = [...skipped, lead.id]
    setSkipped(next)
    setLeaving(true)
    await sleep(140)
    await load(next)
    setLeaving(false)
  }

  const undo = async () => {
    if (!toast) return
    const id = toast.leadId
    setToast(null)
    try {
      await undoLeadOutcome(id)
      const rest = skipped.filter((x) => x !== id)
      setSkipped(rest)
      await load(rest, id)
    } catch (e) {
      setActionError(errorText(e))
    }
  }

  const openFromSearch = async (id: string) => {
    onClearQuery()
    setLoading(true)
    await load(
      skipped.filter((x) => x !== id),
      id,
    )
  }

  const patchLead = (fields: Partial<QueueLead>) => setData((d) => (d && d.lead ? { ...d, lead: { ...d.lead, ...fields } } : d))

  const saveField = (field: keyof LeadEdit) => async (value: string) => {
    if (!lead) return
    const res = await editLead(lead.id, { [field]: value })
    patchLead(res.lead)
    if (res.moved_to) {
      setNotice(`Città cambiata: il contatto è stato spostato nel foglio «${res.moved_to}»`)
      setTimeout(() => setNotice(""), 7000)
    }
  }

  const applyCities = (next: string[]) => {
    setCityFilter(next)
    citiesRef.current = next
    try {
      localStorage.setItem("lh_call_cities", JSON.stringify(next))
    } catch {
      /* memoria del browser non disponibile */
    }
    load(skipped)
  }
  const toggleCity = (key: string) => applyCities(cityFilter.includes(key) ? cityFilter.filter((k) => k !== key) : [...cityFilter, key])

  const counts = data?.counts
  const session = data?.session
  const active = session?.active ?? true
  const done = counts?.calls ?? 0
  const remaining = counts?.to_call ?? 0
  const progress = done + remaining > 0 ? Math.round((done / (done + remaining)) * 100) : 0
  const today = new Date().toLocaleDateString("it-IT", { day: "numeric", month: "long", year: "numeric" })

  if (loading) return <p className="muted">Caricamento…</p>

  return (
    <div className={`lh-call ${lead && active ? "" : "no-bar"}`}>
      {!online && (
        <div className="lh-offline" role="alert">
          <LIcon name="wifioff" size={16} /> Sei offline: gli esiti non possono essere salvati finché non torna la connessione.
        </div>
      )}

      <div className="lh-strip">
        <div className="lh-strip-head">
          <strong>Call mode · {today}</strong>
        </div>
        <div className="lh-cityrow">
          <button type="button" className={`lh-cityfilter ${cityFilter.length ? "on" : ""}`} onClick={() => setCityOpen((o) => !o)} aria-expanded={cityOpen}>
            <LIcon name="pin" size={15} /> Città
            <b>
              {cityFilter.length === 0
                ? `Tutte (${data?.cities.length ?? 0})`
                : cityFilter.map((k) => data?.cities.find((c) => c.key === k)?.label ?? (k === "__none__" ? "Senza città" : k)).join(", ")}
            </b>
          </button>
          {cityFilter.length > 0 && (
            <button type="button" className="lh-link" onClick={() => applyCities([])}>
              Mostra tutte
            </button>
          )}
        </div>
        {cityOpen && (
          <div className="lh-citypanel">
            <p>Scegli una o più città: vedi solo quei contatti. Finiti i nuovi contatti di quelle città, richiami anche le loro segreterie.</p>
            {(() => {
              const known = data?.cities ?? []
              const extra = cityFilter.filter((k) => !known.some((c) => c.key === k)).map((k) => ({ key: k, label: k === "__none__" ? "Senza città" : k, n: 0 }))
              const all = [...known, ...extra]
              return all.length === 0 ? (
                <p className="muted">Nessun contatto da chiamare.</p>
              ) : (
                all.map((c) => (
                  <label key={c.key} className={`lh-cityrow-item ${cityFilter.includes(c.key) ? "on" : ""}`}>
                    <input type="checkbox" checked={cityFilter.includes(c.key)} onChange={() => toggleCity(c.key)} />
                    <span>{c.label}</span>
                    <b>{c.n}</b>
                  </label>
                ))
              )
            })()}
          </div>
        )}
        <div className="lh-strip-counts">
          <span>
            <b>{counts?.to_call ?? 0}</b> da chiamare
          </span>
          <span>
            <b>{counts?.contacts ?? 0}</b> contatti
          </span>
          <span>
            <b>{done}</b> chiamati
          </span>
          <span>
            <b>{counts?.appointments ?? 0}</b> app
          </span>
        </div>
        <div className="progress lh-progress" aria-label={`Avanzamento ${progress}%`}>
          <span className="orange" style={{ width: `${progress}%` }} />
        </div>
        <div className="lh-strip-foot">
          <SessionBadge session={session} />
          {counts && counts.due > 0 && <Badge tone="yellow">{counts.due} richiami scaduti</Badge>}
        </div>
      </div>

      <LeadSearchResults query={query} onPick={openFromSearch} onClose={onClearQuery} />

      {loadError && (
        <div className="lh-error-card" role="alert">
          <LIcon name={online ? "warning" : "wifioff"} size={18} />
          <div>
            <strong>Non riesco a caricare il prossimo contatto</strong>
            <p>{loadError}</p>
          </div>
          <button type="button" className="secondary-button" onClick={() => load(skipped)}>
            <LIcon name="refresh" size={15} /> Riprova
          </button>
        </div>
      )}

      {!active && session && (
        <div className="lh-closed" role="status">
          <strong>La Call Mode non è attiva.</strong> Si lavora dalle {session.start} alle {session.end}: fuori orario i nuovi contatti non si vedono e
          i pulsanti Chiama ed esito sono nascosti. La ricerca e le statistiche della giornata restano disponibili.
        </div>
      )}

      {!lead && !loadError && active && (
        <div className="lh-empty">
          <div className="lh-empty-icon">
            <LIcon name="check" size={30} />
          </div>
          <h2>{skipped.length > 0 ? "Hai finito i contatti disponibili" : "Nessun contatto da chiamare"}</h2>
          <p>
            {cityFilter.length > 0
              ? "Nelle città selezionate non ci sono altri contatti da chiamare (comprese le segreterie di oggi). Scegli altre città o mostra tutte per continuare."
              : counts && counts.waiting > 0
              ? `Hai ${counts.waiting} richiami programmati: torneranno qui all'orario previsto.`
              : counts && counts.total === 0
                ? "Non hai ancora lead assegnati. Quando il responsabile te li assegna, compaiono qui."
                : "Ottimo lavoro! Controlla l'Agenda lead per gli appuntamenti presi."}
          </p>
          <div className="lh-empty-actions">
            <button type="button" className="secondary-button" onClick={() => load(skipped)}>
              <LIcon name="refresh" size={15} /> Aggiorna
            </button>
            {skipped.length > 0 && (
              <button
                type="button"
                className="primary-button"
                onClick={() => {
                  setSkipped([])
                  load([])
                }}
              >
                Riprendi i {skipped.length} saltati
              </button>
            )}
          </div>
        </div>
      )}

      {lead && (
        <>
          <article key={lead.id} className={`lh-lead ${leaving ? "leaving" : "entering"}`}>
            <div className="lh-lead-top">
              <div className="lh-city">
                <InlineField label="Città" value={lead.city} placeholder="Città" onSave={saveField("city")} />
              </div>
              <div className="lh-attempt">
                <span className="lh-field-label">Tentativo</span>
                <strong>{lead.call_count + 1}</strong>
                {lead.outcome !== "nuovo" ? <OutcomeBadge value={lead.outcome} /> : <small>Esito: nessuno</small>}
              </div>
              {active && (
                <button type="button" className="lh-skip" onClick={skip} disabled={busy}>
                  Salta <LIcon name="skip" size={13} />
                </button>
              )}
            </div>

            <InlineField label="Codice fiscale" value={lead.fiscal_code} placeholder="Codice fiscale" upper box onSave={saveField("fiscal_code")} />
            <InlineField
              label="Nome e cognome"
              size="big"
              box
              value={fullName(lead) === "Contatto senza nome" ? null : fullName(lead)}
              placeholder="Nome e cognome"
              onSave={async (value) => {
                const [first, ...rest] = value.split(/\s+/).filter(Boolean)
                const res = await editLead(lead.id, { first_name: first ?? "", last_name: rest.join(" ") })
                patchLead(res.lead)
              }}
            />
            {lead.phone2 || addingPhone2 ? (
              // secondo numero presente: la riga si divide a meta' tra primo e secondo numero
              <div className="lh-row2 phones">
                <InlineField label="Numero di telefono" size="big" box type="tel" value={lead.phone} placeholder="Numero di telefono" onSave={saveField("phone")} />
                <InlineField
                  label="Secondo numero"
                  size="big"
                  box
                  type="tel"
                  value={lead.phone2}
                  placeholder="Secondo numero"
                  autoEdit={!lead.phone2}
                  onDone={() => setAddingPhone2(false)}
                  onSave={saveField("phone2")}
                />
              </div>
            ) : (
              // niente secondo numero: interfaccia invariata + tastino "+" a destra del primo numero
              <div className="lh-phone-wrap">
                <InlineField label="Numero di telefono" size="big" box type="tel" value={lead.phone} placeholder="Numero di telefono" onSave={saveField("phone")} />
                <button type="button" className="lh-add-phone" onClick={() => setAddingPhone2(true)} title="Aggiungi un secondo numero" aria-label="Aggiungi un secondo numero">
                  <LIcon name="plus" size={18} />
                </button>
              </div>
            )}

            <div className="lh-row2 addr">
              <div className="lh-type">
                <InlineField label="Via" box upper maxLength={20} value={lead.street_type} placeholder="V, STR, SP…" onSave={saveField("street_type")} />
              </div>
              <InlineField label="Indirizzo" box value={lead.address} placeholder="Indirizzo" onSave={saveField("address")} />
              <InlineField label="Civico" box value={lead.house_number} placeholder="N°" onSave={saveField("house_number")} />
            </div>

            <div className="lh-row2 notes">
              <InlineField label="Note" box multiline value={lead.notes} placeholder="Note" onSave={saveField("notes")} />
              <InlineField label="Gestore" box multiline value={lead.provider} placeholder="Gestore" onSave={saveField("provider")} />
            </div>

            <div className="lh-links">
              {showNote ? (
                <label className="lh-quicknote">
                  <input type="text" value={note} maxLength={500} autoFocus placeholder="Nota: si salva con l'esito" onChange={(e) => setNote(e.target.value)} />
                </label>
              ) : (
                <button type="button" className="lh-link" onClick={() => setShowNote(true)}>
                  + Aggiungi una nota all'esito
                </button>
              )}
              {active && (
                <div className="lh-wrong">
                  <button type="button" className="lh-link danger" onClick={() => wrongNumber("inesistente")} disabled={busy}>
                    <LIcon name="userx" size={14} /> Inesistente
                  </button>
                  <button type="button" className="lh-link danger" onClick={() => wrongNumber("persona_sbagliata")} disabled={busy}>
                    <LIcon name="userx" size={14} /> Trasferito / persona sbagliata
                  </button>
                </div>
              )}
            </div>

            {notice && (
              <p className="form-ok flush" role="status">
                {notice}
              </p>
            )}
            {actionError && (
              <p className="form-error" role="alert">
                {actionError}
              </p>
            )}
          </article>

          {active && (
          <div className="lh-actionbar">
            {dialed && <p className="lh-dialed">Chiamata avviata: scegli l'esito appena finisci.</p>}
            <div className="lh-callrow">
              <a
                className={`lh-big call ${lead.phone ? "" : "disabled"}`}
                href={lead.phone ? `tel:${lead.phone}` : undefined}
                onClick={() => {
                  if (!lead.phone) return
                  setDialed(true)
                  dialLead(lead.id).catch(() => {})
                }}
              >
                <LIcon name="phone" size={22} /> Chiama ora
              </a>
              {lead.phone2 && (
                <a
                  className="lh-big call alt"
                  href={`tel:${lead.phone2}`}
                  onClick={() => {
                    setDialed(true)
                    dialLead(lead.id).catch(() => {})
                  }}
                >
                  <LIcon name="phone" size={20} /> 2° numero
                </a>
              )}
            </div>
            <div className="lh-outcomes">
              <button type="button" className="lh-out green" disabled={busy || !online} onClick={() => setSheet("appointment")}>
                <LIcon name="calendar" size={19} />
                <span>Appuntamento</span>
              </button>
              <button type="button" className="lh-out yellow" disabled={busy || !online} onClick={() => setSheet("callback")}>
                <LIcon name="clock" size={19} />
                <span>Da ricontattare</span>
              </button>
              <button type="button" className="lh-out red" disabled={busy || !online} onClick={() => quickOutcome("non_interessato")}>
                <LIcon name="thumbdown" size={19} />
                <span>Non interessato</span>
              </button>
              <button type="button" className="lh-out gray" disabled={busy || !online} onClick={() => quickOutcome("segreteria")}>
                <LIcon name="voicemail" size={19} />
                <span>Segreteria/NR</span>
              </button>
            </div>
          </div>
          )}
        </>
      )}

      {toast && (
        <div className="lh-toast" role="status">
          <span>{toast.text}</span>
          <button type="button" onClick={undo}>
            <LIcon name="undo" size={14} /> Annulla
          </button>
        </div>
      )}

      {sheet === "appointment" && lead && <AppointmentSheet busy={busy} onCancel={() => setSheet(null)} onConfirm={saveAppointment} />}
      {sheet === "callback" && lead && <CallbackSheet busy={busy} onCancel={() => setSheet(null)} onConfirm={saveCallback} />}
    </div>
  )
}
