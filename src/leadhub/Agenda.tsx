import { useCallback, useEffect, useState } from "react"
import {
  createAgendaItem,
  deleteAgendaItem,
  fetchAgenda,
  fetchColleagues,
  shareLead,
  type Colleague,
  setAppointmentResult,
  setCallbackResult,
  updateAgendaItem,
  type AgendaItem,
} from "../services/leadsApi"
import {
  AppointmentBadge,
  Badge,
  DateTimePicker,
  LIcon,
  SectorBadge,
  errorText,
  fullName,
  localDateIso,
  googleMapsUrl,
  appleMapsUrl,
  placeOf,
  streetLine,
  saveToContacts,
  timeHM,
  useOnline,
} from "./shared"

/* ---------- Scheda per aggiungere o modificare ---------- */

type Draft = {
  first_name: string
  last_name: string
  phone: string
  phone2: string
  address: string
  house_number: string
  street_type: string
  city: string
  sector: string
  note: string
}

function ItemModal({
  item,
  day,
  onClose,
  onSaved,
}: {
  item: AgendaItem | null
  day: string
  onClose: () => void
  onSaved: () => void
}) {
  const initial = item ? new Date(item.appointment_at) : null
  const [date, setDate] = useState(initial ? localDateIso(initial) : day)
  const [time, setTime] = useState(
    initial ? `${String(initial.getHours()).padStart(2, "0")}:${String(Math.round(initial.getMinutes() / 15) * 15 % 60).padStart(2, "0")}` : "15:00",
  )
  const [d, setD] = useState<Draft>({
    first_name: item?.first_name ?? "",
    last_name: item?.last_name ?? "",
    phone: item?.phone ?? "",
    phone2: item?.phone2 ?? "",
    address: item?.address ?? "",
    house_number: item?.house_number ?? "",
    street_type: item?.street_type ?? "",
    city: item?.city ?? "",
    sector: item?.sector ?? "",
    note: "",
  })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const set = (k: keyof Draft) => (e: { target: { value: string } }) => setD((x) => ({ ...x, [k]: e.target.value }))

  const save = async () => {
    setError("")
    if (!d.first_name.trim() && !d.last_name.trim()) return setError("Scrivi nome o cognome del contatto")
    const when = new Date(`${date}T${time}`)
    if (isNaN(when.getTime())) return setError("Scegli data e ora")
    setBusy(true)
    try {
      const fields = {
        first_name: d.first_name,
        last_name: d.last_name,
        address: d.address,
        house_number: d.house_number,
        street_type: d.street_type,
        city: d.city,
        sector: d.sector,
        // il secondo numero si puo' anche svuotare (= nessun secondo numero)
        phone2: d.phone2,
        ...(d.phone.trim() || !item ? { phone: d.phone } : {}),
        ...(d.note.trim() ? { note: d.note.trim() } : {}),
      }
      if (item) await updateAgendaItem(item.id, { ...fields, when: when.toISOString() })
      else await createAgendaItem({ ...fields, appointment_at: when.toISOString() })
      onSaved()
    } catch (e) {
      setError(errorText(e))
      setBusy(false)
    }
  }

  const isCall = item?.kind === "richiamo"
  return (
    <div className="lh-sheet-layer" onClick={onClose}>
      <div className="lh-sheet tall" role="dialog" aria-label="Appuntamento" onClick={(e) => e.stopPropagation()}>
        <div className="lh-sheet-grip" />
        <h2>{item ? (isCall ? "Modifica richiamo" : "Modifica appuntamento") : "Nuovo appuntamento"}</h2>
        <div className="lh-form">
          <label>
            <span>Nome</span>
            <input value={d.first_name} onChange={set("first_name")} autoComplete="off" />
          </label>
          <label>
            <span>Cognome</span>
            <input value={d.last_name} onChange={set("last_name")} autoComplete="off" />
          </label>
          <label>
            <span>Telefono</span>
            <input type="tel" inputMode="tel" value={d.phone} onChange={set("phone")} />
          </label>
          <label>
            <span>Secondo numero</span>
            <input type="tel" inputMode="tel" value={d.phone2} onChange={set("phone2")} placeholder="Facoltativo" />
          </label>
          <label>
            <span>Via</span>
            <input value={d.street_type} onChange={set("street_type")} maxLength={20} placeholder="V, STR, SP…" autoComplete="off" style={{ textTransform: "uppercase" }} />
          </label>
          <label>
            <span>Indirizzo</span>
            <input value={d.address} onChange={set("address")} />
          </label>
          <label>
            <span>Civico</span>
            <input value={d.house_number} onChange={set("house_number")} />
          </label>
          <label>
            <span>Città</span>
            <input value={d.city} onChange={set("city")} />
          </label>
          <label>
            <span>Tipologia</span>
            <select value={d.sector} onChange={set("sector")}>
              <option value="">—</option>
              <option>Luce</option>
              <option>Gas</option>
              <option>Telefonia</option>
            </select>
          </label>
        </div>
        <DateTimePicker date={date} time={time} onChange={(a, b) => (setDate(a), setTime(b))} />
        <label className="lh-sheet-note">
          <span>Nota (facoltativa)</span>
          <input value={d.note} maxLength={500} onChange={set("note")} placeholder="Es. citofono, orario migliore…" />
        </label>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <div className="lh-sheet-actions">
          <button type="button" className="lh-big secondary" onClick={onClose} disabled={busy}>
            Annulla
          </button>
          <button type="button" className="lh-big green" onClick={save} disabled={busy}>
            <LIcon name="check" size={20} /> {busy ? "Salvo…" : "Salva"}
          </button>
        </div>
      </div>
    </div>
  )
}

/* ---------- Condividi con altri agenti ---------- */

function ShareModal({ item, onClose, onSaved }: { item: AgendaItem; onClose: () => void; onSaved: () => void }) {
  const [people, setPeople] = useState<Colleague[] | null>(null)
  const [picked, setPicked] = useState<string[]>(item.shared_with.filter((p) => p.by_me).map((p) => p.id))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    fetchColleagues()
      .then((r) => setPeople(r.people))
      .catch((e) => {
        setError(errorText(e))
        setPeople([])
      })
  }, [])

  const toggle = (id: string) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]))

  const save = async () => {
    setBusy(true)
    setError("")
    try {
      await shareLead(item.id, picked)
      onSaved()
    } catch (e) {
      setError(errorText(e))
      setBusy(false)
    }
  }

  return (
    <div className="lh-sheet-layer" onClick={onClose}>
      <div className="lh-sheet" role="dialog" aria-label="Condividi appuntamento" onClick={(e) => e.stopPropagation()}>
        <div className="lh-sheet-grip" />
        <h2>Condividi con i colleghi</h2>
        <p className="lh-sheet-hint">I colleghi scelti vedono data, ora, indirizzo e telefono di questo appuntamento nella loro Agenda lead (sola lettura).</p>
        {people === null && <p className="muted">Caricamento…</p>}
        {people && people.length === 0 && !error && <p className="muted">Non ci sono altri colleghi attivi.</p>}
        <div className="lh-share-list">
          {people?.map((p) => (
            <label key={p.id} className={`lh-share-row ${picked.includes(p.id) ? "on" : ""}`}>
              <input type="checkbox" checked={picked.includes(p.id)} onChange={() => toggle(p.id)} />
              <span>
                <strong>
                  {p.first_name} {p.last_name}
                </strong>
                <small>{p.role_label}</small>
              </span>
            </label>
          ))}
        </div>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <div className="lh-sheet-actions">
          <button type="button" className="lh-big secondary" onClick={onClose} disabled={busy}>
            Annulla
          </button>
          <button type="button" className="lh-big green" onClick={save} disabled={busy || !people}>
            <LIcon name="check" size={20} /> {busy ? "Salvo…" : picked.length ? `Condividi con ${picked.length}` : "Salva"}
          </button>
        </div>
      </div>
    </div>
  )
}

/* ---------- Scheda singolo appuntamento / richiamo ---------- */

/* ---------- Scelta data e ora quando un richiamo diventa appuntamento ---------- */

function PickTimeSheet({ busy, onCancel, onConfirm }: { busy: boolean; onCancel: () => void; onConfirm: (iso: string) => void }) {
  const [date, setDate] = useState(localDateIso())
  const [time, setTime] = useState("15:00")
  return (
    <div className="lh-sheet-layer" onClick={onCancel}>
      <div className="lh-sheet" role="dialog" aria-label="Fissa appuntamento" onClick={(e) => e.stopPropagation()}>
        <div className="lh-sheet-grip" />
        <h2>Fissa appuntamento</h2>
        <DateTimePicker date={date} time={time} onChange={(d, t) => (setDate(d), setTime(t))} />
        <div className="lh-sheet-actions">
          <button type="button" className="lh-big secondary" onClick={onCancel} disabled={busy}>
            Annulla
          </button>
          <button type="button" className="lh-big green" onClick={() => onConfirm(new Date(`${date}T${time}`).toISOString())} disabled={busy}>
            <LIcon name="check" size={20} /> {busy ? "Salvo…" : "Salva appuntamento"}
          </button>
        </div>
      </div>
    </div>
  )
}

function AgendaCard({
  item,
  canDelete,
  onChanged,
  onEdit,
  onShare,
  onOpenCustomer,
}: {
  item: AgendaItem
  canDelete: boolean
  onChanged: () => void
  onEdit: () => void
  onShare: () => void
  onOpenCustomer: (id: string) => void
}) {
  const online = useOnline()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const [created, setCreated] = useState<string | null>(null)
  const [open, setOpen] = useState(false)
  const [pickTime, setPickTime] = useState(false)

  const isCall = item.kind === "richiamo"
  const result = item.appointment_result
  // appuntamento esitato: la scheda si riduce a esito, nome, numero e indirizzo; la "v" apre gli esiti modificabili
  const done = !isCall && !!result && result !== "in_attesa"
  const collapsed = done && !open
  const customerId = created ?? item.customer_id
  const place = placeOf(item)
  const street = streetLine(item)
  const destination = [street, item.city].filter(Boolean).join(", ")
  // modificare ed eliminare: solo chi ha creato l'appuntamento. Esitare e condividere: anche chi lo riceve condiviso.
  const editable = !item.shared && !item.anonymized && !customerId
  const canShare = !item.anonymized && !customerId
  const showResults = !isCall && !item.anonymized && !customerId && result !== "contratto_chiuso"

  const choose = async (value: "contratto_chiuso" | "incontrato_con_trattativa" | "incontrato_senza_trattativa" | "annullato") => {
    if (value === result) return
    const text =
      value === "contratto_chiuso"
        ? "Segnare il contratto come concluso? Il contatto diventa un cliente nel CRM."
        : value === "incontrato_con_trattativa"
          ? "Segnare l'incontro come avvenuto CON trattativa?"
          : value === "annullato"
            ? "Segnare l'appuntamento come annullato o non visto? Conta come pacco."
            : "Segnare l'incontro come avvenuto SENZA trattativa?"
    if (!window.confirm(text)) return
    setBusy(true)
    setError("")
    try {
      const res = await setAppointmentResult(item.id, value)
      if (res.customer_id) {
        setCreated(res.customer_id)
        setOpen(true) // resta aperta: compare "Apri scheda cliente"
      }
      onChanged()
    } catch (e) {
      setError(errorText(e))
    } finally {
      setBusy(false)
    }
  }

  // esito di un richiamo (non entra in Performance)
  const callbackChoose = async (value: "contratto_chiuso" | "appuntamento" | "annullato" | "chiamato_senza_trattativa", when?: string) => {
    if (value !== "appuntamento") {
      const text =
        value === "contratto_chiuso"
          ? "Segnare il contratto come fatto? Il contatto diventa un cliente nel CRM."
          : value === "annullato"
            ? "Segnare il richiamo come annullato / pacco?"
            : "Segnare come chiamato senza trattativa?"
      if (!window.confirm(text)) return
    }
    setBusy(true)
    setError("")
    try {
      await setCallbackResult(item.id, value, when)
      setPickTime(false)
      onChanged()
    } catch (e) {
      setError(errorText(e))
    } finally {
      setBusy(false)
    }
  }

  const remove = async () => {
    if (!window.confirm(isCall ? "Eliminare questo richiamo?" : "Eliminare questo appuntamento?")) return
    setBusy(true)
    setError("")
    try {
      await deleteAgendaItem(item.id)
      onChanged()
    } catch (e) {
      setError(errorText(e))
      setBusy(false)
    }
  }

  return (
    <article className={`lh-appt ${isCall ? "call" : ""} ${done ? "done" : ""} ${collapsed ? "collapsed" : ""} ${item.shared ? "shared" : ""}`}>
      <div className="lh-appt-time">
        <strong>{timeHM(item.appointment_at)}</strong>
        {isCall ? <Badge tone="blue">Richiamo</Badge> : result && <AppointmentBadge value={result} />}
      </div>
      <div className="lh-appt-body">
        {/* nome, numero, via/città + icona per salvare in rubrica */}
        <div className="lh-contact">
          <div className="lh-contact-info">
            <div className="lh-appt-head">
              <h3>{item.anonymized ? "Dati rimossi (GDPR)" : fullName(item)}</h3>
              <SectorBadge sector={item.sector} />
            </div>
            {!item.anonymized && (
              <>
                {item.phone && (
                  <p className="lh-appt-line">
                    <LIcon name="phone" size={15} /> <a href={`tel:${item.phone}`}>{item.phone}</a>
                    {item.phone2 && (
                      <>
                        {" · "}
                        <a href={`tel:${item.phone2}`}>{item.phone2}</a>
                      </>
                    )}
                  </p>
                )}
                <p className={`lh-appt-line ${place ? "" : "muted"}`}>
                  <LIcon name="pin" size={15} /> {place || "Nessun indirizzo: aggiungilo con Modifica"}
                </p>
                {item.result_by && (
                  <p className="lh-result-by">
                    Esitato da <strong>{item.result_by}</strong>
                  </p>
                )}
              </>
            )}
          </div>
          {!item.anonymized && (
            <div className="lh-contact-side">
              {!collapsed && (
                <button type="button" className="lh-contact-save" onClick={() => saveToContacts(item)} title="Salva in rubrica" aria-label="Salva il contatto in rubrica">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M4 4h13a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4z" />
                    <path d="M4 8H2M4 12H2M4 16H2" />
                    <circle cx="12" cy="10" r="2.5" />
                    <path d="M7.5 17a4.5 4.5 0 0 1 9 0" />
                  </svg>
                </button>
              )}
              {done && (
                <button type="button" className={`lh-chevron ${open ? "open" : ""}`} onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-label={open ? "Riduci" : "Mostra gli esiti"} title={open ? "Riduci" : "Mostra gli esiti"}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="m6 9 6 6 6-6" />
                  </svg>
                </button>
              )}
            </div>
          )}
        </div>

        {!collapsed && (
          <>
        {!item.anonymized && (item.notes || item.provider) && (
          <div className="lh-notes-row">
            <div>
              <span>Note</span>
              <p>{item.notes || "—"}</p>
            </div>
            <div>
              <span>Gestore</span>
              <p>{item.provider || "—"}</p>
            </div>
          </div>
        )}

        {item.shared && (
          <p className="lh-shared-by">
            Condiviso da <strong>{item.shared_by}</strong>
            {item.owner_name && item.owner_name !== item.shared_by && (
              <>
                {" "}
                · Appuntamento di <strong>{item.owner_name}</strong>
              </>
            )}
          </p>
        )}
        {item.shared_with.length > 0 && <p className="lh-shared-by">Condiviso con {item.shared_with.map((p) => p.name).join(", ")}</p>}

        {!item.anonymized && destination && (
          <div className="lh-maps-stack">
            <a className="lh-map-btn" href={googleMapsUrl(destination)} target="_blank" rel="noopener noreferrer">
              <LIcon name="navigation" size={17} /> Indicazioni Google Maps
            </a>
            <a className="lh-map-btn" href={appleMapsUrl(destination)} target="_blank" rel="noopener noreferrer">
              <LIcon name="navigation" size={17} /> Indicazioni Apple Maps
            </a>
          </div>
        )}

        {isCall && item.phone && !item.shared && (
          <a className="lh-big call" href={`tel:${item.phone}`}>
            <LIcon name="phone" size={20} /> Chiama ora
          </a>
        )}

        {isCall && !item.shared && !item.anonymized && (
          <div className="lh-results">
            <button type="button" className="lh-big green" disabled={busy || !online} onClick={() => callbackChoose("contratto_chiuso")}>
              <LIcon name="check" size={22} /> Contratto fatto
            </button>
            <div className="lh-results-row">
              <button type="button" className="lh-result-btn yellow" disabled={busy || !online} onClick={() => setPickTime(true)}>
                Appuntamento
              </button>
              <button type="button" className="lh-result-btn gray" disabled={busy || !online} onClick={() => callbackChoose("chiamato_senza_trattativa")}>
                Chiamato senza trattativa
              </button>
            </div>
            <button type="button" className="lh-big red-outline" disabled={busy || !online} onClick={() => callbackChoose("annullato")}>
              <LIcon name="close" size={20} /> Annullato / pacco
            </button>
          </div>
        )}

        {showResults && (
          <div className="lh-results">
            <button type="button" className="lh-big green" disabled={busy || !online} onClick={() => choose("contratto_chiuso")}>
              <LIcon name="check" size={22} /> Contratto concluso
            </button>
            <div className="lh-results-row">
              <button
                type="button"
                className={`lh-result-btn yellow ${result === "incontrato_con_trattativa" ? "picked" : ""}`}
                disabled={busy || !online}
                onClick={() => choose("incontrato_con_trattativa")}
              >
                Incontrato con trattativa
              </button>
              <button
                type="button"
                className={`lh-result-btn gray ${result === "incontrato_senza_trattativa" ? "picked" : ""}`}
                disabled={busy || !online}
                onClick={() => choose("incontrato_senza_trattativa")}
              >
                Incontrato senza trattativa
              </button>
            </div>
            <button
              type="button"
              className={`lh-big red-outline ${result === "annullato" ? "picked" : ""}`}
              disabled={busy || !online}
              onClick={() => choose("annullato")}
            >
              <LIcon name="close" size={20} /> Annullato / non visto (pacco)
            </button>
          </div>
        )}

        {result === "contratto_chiuso" && customerId && (
          <div className="lh-appt-actions">
            <button type="button" className="primary-button" onClick={() => onOpenCustomer(customerId)}>
              Apri scheda cliente
            </button>
          </div>
        )}

        {canShare && (
          <div className="lh-appt-tools">
            <button type="button" className="lh-link" onClick={onShare} disabled={busy}>
              <LIcon name="user" size={14} /> Condividi
            </button>
            {editable && (
              <button type="button" className="lh-link" onClick={onEdit} disabled={busy}>
                <LIcon name="pencil" size={14} /> Modifica
              </button>
            )}
            {editable && canDelete && (
              <button type="button" className="lh-link danger" onClick={remove} disabled={busy || !online}>
                <LIcon name="trash" size={14} /> Elimina
              </button>
            )}
          </div>
        )}
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
          </>
        )}
      </div>
      {pickTime && <PickTimeSheet busy={busy} onCancel={() => setPickTime(false)} onConfirm={(iso) => callbackChoose("appuntamento", iso)} />}
    </article>
  )
}

export function LeadAgendaPage({ onOpenCustomer }: { onOpenCustomer: (id: string) => void }) {
  const [day, setDay] = useState(localDateIso())
  const [items, setItems] = useState<AgendaItem[] | null>(null)
  const [session, setSession] = useState<{ active: boolean } | null>(null)
  const [error, setError] = useState("")
  const [modal, setModal] = useState<AgendaItem | "new" | null>(null)
  const [sharing, setSharing] = useState<AgendaItem | null>(null)

  const load = useCallback(async () => {
    setError("")
    try {
      const res = await fetchAgenda(day)
      setItems(res.items)
      setSession(res.session)
    } catch (e) {
      setError(errorText(e))
      setItems((cur) => cur ?? [])
    }
  }, [day])

  useEffect(() => {
    setItems(null)
    load()
  }, [load])

  const shift = (days: number) => {
    const d = new Date(`${day}T12:00:00`)
    d.setDate(d.getDate() + days)
    setDay(localDateIso(d))
  }

  const total = items?.length ?? 0
  const closed = items?.filter((i) => i.appointment_result === "contratto_chiuso").length ?? 0
  const pending = items?.filter((i) => i.kind === "appuntamento" && !i.shared && i.appointment_result === "in_attesa").length ?? 0
  const callbacks = items?.filter((i) => i.kind === "richiamo").length ?? 0
  const label = new Date(`${day}T12:00:00`).toLocaleDateString("it-IT", { weekday: "long", day: "numeric", month: "long" })

  return (
    <div className="lh-agenda">
      <div className="lh-agenda-bar">
        <div className="month-switch">
          <button type="button" className="icon-button" onClick={() => shift(-1)} title="Giorno precedente">
            ‹
          </button>
          <strong>{label}</strong>
          <button type="button" className="icon-button" onClick={() => shift(1)} title="Giorno successivo">
            ›
          </button>
        </div>
        <button type="button" className="secondary-button" onClick={() => setDay(localDateIso())}>
          Oggi
        </button>
        <button type="button" className="primary-button" onClick={() => setModal("new")}>
          <LIcon name="plus" size={15} /> Aggiungi
        </button>
        <div className="lh-agenda-counts">
          <Badge tone="yellow">{pending} da svolgere</Badge>
          {callbacks > 0 && <Badge tone="blue">{callbacks} richiami</Badge>}
          <Badge tone="green">{closed} chiusi</Badge>
        </div>
      </div>

      {error && (
        <p className="form-error" role="alert">
          {error}{" "}
          <button type="button" className="lh-link" onClick={load}>
            Riprova
          </button>
        </p>
      )}
      {items === null && <p className="muted">Caricamento…</p>}
      {items && total === 0 && !error && (
        <div className="lh-empty">
          <div className="lh-empty-icon">
            <LIcon name="calendar" size={28} />
          </div>
          <h2>Nessun appuntamento</h2>
          <p>Gli appuntamenti e i richiami fissati dal Call Mode compaiono qui in ordine di orario. Puoi anche aggiungerne uno a mano.</p>
        </div>
      )}
      <div className="lh-agenda-list">
        {items?.map((item) => (
          <AgendaCard
            key={item.id}
            item={item}
            canDelete={session?.active ?? false}
            onChanged={load}
            onEdit={() => setModal(item)}
            onShare={() => setSharing(item)}
            onOpenCustomer={onOpenCustomer}
          />
        ))}
      </div>

      {sharing && (
        <ShareModal
          item={sharing}
          onClose={() => setSharing(null)}
          onSaved={() => {
            setSharing(null)
            load()
          }}
        />
      )}

      {modal && (
        <ItemModal
          item={modal === "new" ? null : modal}
          day={day}
          onClose={() => setModal(null)}
          onSaved={() => {
            setModal(null)
            load()
          }}
        />
      )}
    </div>
  )
}
