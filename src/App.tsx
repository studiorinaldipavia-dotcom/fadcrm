import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react"
import { RolesPanel } from "./RolesPanel"
import { NotificationsBell } from "./NotificationsBell"
import {
  deleteAgent,
  fetchLeaderboard,
  type LeaderboardData,
  roleLabels,
  addCustomerNote,
  privacyPdfUrl,
  signPrivacy,
  uploadSignedPrivacy,
  viewPrivacy,
  fetchAudit,
  fetchDriveStatus,
  fetchOffices,
  fetchProducts,
  recoverAdmin,
  saveOffice,
  saveProduct,
  saveCte,
  deleteCte,
  createCalendarEvent,
  deleteCalendarEvent,
  fetchCalendar,
  fetchMap,
  geocodePending,
  updateCalendarEvent,
  fetchCoaching,
  fetchDashboard,
  fetchStats,
  fetchTasks,
  fetchTaskMeta,
  createTask,
  updateTask,
  completeTask,
  markTaskLost,
  reopenTask,
  deleteTask,
  saveStats,
  changePassword,
  createAgent,
  createCustomer,
  deleteCustomer,
  fetchAgents,
  fetchCustomer,
  fetchCustomerMeta,
  addCustomerAgents,
  fetchCustomers,
  getMe,
  getStatus,
  login,
  logout,
  resetAgentPassword,
  saveTheme,
  setAgentPermissions,
  setCustomerStatus,
  setupAdmin,
  updateAgent,
  updateCustomer,
  type Agent,
  type AgentInput,
  type AgentsData,
  type PrivacyView,
  type AuditRow,
  type DriveStatus,
  type OfficeRow,
  type ProductRow,
  type CteRow,
  type DashboardCte,
  type CalendarData,
  type CalendarEvent,
  type MapData,
  type CoachingData,
  type DashboardData,
  type Light,
  type StatsData,
  type CustomerDetailData,
  type CustomerInput,
  type CustomerMeta,
  type CustomerRow,
  type TaskRow,
  type TaskMeta,
  type TaskKind,
  type TaskStatus,
  type SessionUser,
} from "./services/api"
import { CallModePage } from "./leadhub/CallMode"
import { LeadAgendaPage } from "./leadhub/Agenda"
import { LeadHubAdminPage } from "./leadhub/Admin"

type IconName = "grid" | "users" | "file" | "chart" | "map" | "calendar" | "shield" | "bag" | "settings" | "search" | "bell" | "sun" | "moon" | "plus" | "arrow" | "trend" | "warning" | "check" | "clock" | "chevron" | "close" | "menu" | "logout" | "bolt" | "phone"

const iconPaths: Record<IconName, ReactNode> = {
  grid: (
    <>
      <rect x="3" y="3" width="7" height="7" rx="2" />
      <rect x="14" y="3" width="7" height="7" rx="2" />
      <rect x="3" y="14" width="7" height="7" rx="2" />
      <rect x="14" y="14" width="7" height="7" rx="2" />
    </>
  ),
  users: (
    <>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
    </>
  ),
  file: (
    <>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <path d="M14 2v6h6M8 13h8M8 17h5" />
    </>
  ),
  chart: (
    <>
      <path d="M3 3v18h18" />
      <path d="m7 16 4-5 3 3 5-7" />
    </>
  ),
  map: (
    <>
      <polygon points="1 6 8 2 16 6 23 2 23 18 16 22 8 18 1 22 1 6" />
      <path d="M8 2v16M16 6v16" />
    </>
  ),
  calendar: (
    <>
      <rect x="3" y="4" width="18" height="17" rx="2" />
      <path d="M16 2v4M8 2v4M3 10h18M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01" />
    </>
  ),
  shield: (
    <>
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      <path d="m9 12 2 2 4-4" />
    </>
  ),
  bag: (
    <>
      <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4zM3 6h18M16 10a4 4 0 0 1-8 0" />
    </>
  ),
  settings: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-2.83 2.83-.06-.06a1.7 1.7 0 0 0-1.88-.34 1.7 1.7 0 0 0-1.03 1.55V21h-4v-.08A1.7 1.7 0 0 0 8.94 19.4a1.7 1.7 0 0 0-1.88.34l-.06.06-2.83-2.83.06-.06A1.7 1.7 0 0 0 4.57 15 1.7 1.7 0 0 0 3 14H3v-4h.08A1.7 1.7 0 0 0 4.6 8.94a1.7 1.7 0 0 0-.34-1.88L4.2 7l2.83-2.83.06.06A1.7 1.7 0 0 0 9 4.57 1.7 1.7 0 0 0 10 3V3h4v.08A1.7 1.7 0 0 0 15.06 4.6a1.7 1.7 0 0 0 1.88-.34L17 4.2 19.83 7l-.06.06A1.7 1.7 0 0 0 19.43 9 1.7 1.7 0 0 0 21 10h.08v4H21a1.7 1.7 0 0 0-1.6 1z" />
    </>
  ),
  search: (
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-4-4" />
    </>
  ),
  bell: (
    <>
      <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M14 21h-4" />
    </>
  ),
  sun: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.42 1.42M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.42-1.42M17.66 6.34l1.41-1.41" />
    </>
  ),
  moon: <path d="M21 12.8A9 9 0 1 1 11.2 3 7 7 0 0 0 21 12.8z" />,
  plus: <path d="M12 5v14M5 12h14" />,
  arrow: <path d="M5 12h14M13 6l6 6-6 6" />,
  trend: (
    <>
      <path d="m3 17 6-6 4 4 8-8" />
      <path d="M14 7h7v7" />
    </>
  ),
  warning: (
    <>
      <path d="M10.3 2.9 1.8 17a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 2.9a2 2 0 0 0-3.4 0z" />
      <path d="M12 9v4M12 17h.01" />
    </>
  ),
  check: <path d="m5 12 4 4L19 6" />,
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </>
  ),
  chevron: <path d="m9 18 6-6-6-6" />,
  close: <path d="M18 6 6 18M6 6l12 12" />,
  menu: <path d="M4 7h16M4 12h16M4 17h16" />,
  logout: (
    <>
      <path d="M10 17l5-5-5-5M15 12H3" />
      <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
    </>
  ),
  bolt: <path d="m13 2-9 12h8l-1 8 9-12h-8l1-8z" />,
  phone: (
    <path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2z" />
  ),
}

function Icon({ name, size = 19 }: { name: IconName; size?: number }) {
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
      {iconPaths[name]}
    </svg>
  )
}

const navigation = [
  { label: "Dashboard", icon: "grid" as IconName },
  { label: "Clienti", icon: "users" as IconName },
  { label: "Performance", icon: "chart" as IconName },
  { label: "Mappa clienti", icon: "map" as IconName },
  { label: "Calendario", icon: "calendar" as IconName },
  { label: "Call Mode", icon: "phone" as IconName },
  { label: "Agenda lead", icon: "clock" as IconName },
  { label: "Segreteria", icon: "check" as IconName },
]

const adminNavigation = [
  { label: "LeadHub", icon: "bolt" as IconName },
  { label: "Agenti & permessi", icon: "shield" as IconName },
  { label: "Prodotti", icon: "bag" as IconName },
  { label: "Impostazioni", icon: "settings" as IconName },
]

const requiredPermissions: Record<string, string[]> = {
  Clienti: ["customers.view_own", "customers.view_all"],
  Performance: ["stats.view_own", "stats.view_all"],
  "Mappa clienti": ["map.view_own", "map.view_all"],
  Calendario: ["calendar.view_own", "calendar.view_all"],
  "Call Mode": ["leads.work"],
  "Agenda lead": ["leads.work"],
  LeadHub: ["leads.manage"],
  Segreteria: ["tasks.manage", "tasks.view_own"],
  "Agenti & permessi": ["agents.manage"],
  Prodotti: ["products.manage"],
  Impostazioni: ["settings.manage"],
}

const pageSubtitles: Record<string, string> = {
  Clienti: "Cerca un cliente, apri la scheda, aggiungi note.",
  Performance: "Numeri commerciali per periodo, agente e ufficio.",
  "Mappa clienti": "Dove si trovano i clienti.",
  Calendario: "Appuntamenti e agenda.",
  "Call Mode": "Un contatto alla volta: chiama e registra l'esito con un tocco.",
  "Agenda lead": "Gli appuntamenti presi dai lead, in ordine di orario.",
  LeadHub: "Liste di contatti, assegnazione, control room e pulizia dati.",
  Segreteria: "KO da recuperare e task della segreteria per gli agenti.",
  "Agenti & permessi": "Crea e gestisci agenti, ruoli e permessi.",
  Prodotti: "Archivio prodotti e servizi.",
  Impostazioni: "Uffici, Google Drive e registro attività.",
}



function Button({
  children,
  className = "",
  onClick,
  title,
  type = "button",
}: {
  children?: ReactNode
  className?: string
  onClick?: () => void
  title?: string
  type?: "button" | "submit"
}) {
  return (
    <button type={type} className={className} onClick={onClick} title={title}>
      {children}
    </button>
  )
}

function MetricCard({
  label,
  value,
  change,
  detail,
  icon,
  tone,
}: {
  label: string
  value: string
  change?: string
  detail: string
  icon: IconName
  tone: string
}) {
  return (
    <article className="metric-card">
      <div className={`metric-icon ${tone}`}>
        <Icon name={icon} />
      </div>
      <div className="metric-copy">
        <p className="eyebrow">{label}</p>
        <div className="metric-row">
          <strong>{value}</strong>
          {change && (
            <span className="positive">
              <Icon name="trend" size={13} /> {change}
            </span>
          )}
        </div>
        <p className="muted">{detail}</p>
      </div>
    </article>
  )
}

function LoginPage({ onLoggedIn }: { onLoggedIn: (user: SessionUser) => void }) {
  const [visible, setVisible] = useState(false)
  const [mode, setMode] = useState<"loading" | "login" | "setup" | "recovery">("loading")
  const [info, setInfo] = useState("")
  const [error, setError] = useState("")
  const [busy, setBusy] = useState(false)
  const [form, setForm] = useState({
    first_name: "",
    last_name: "",
    email: "",
    password: "",
    token: "",
    remember: false,
  })

  useEffect(() => {
    getStatus()
      .then((status) => setMode(status.needsSetup ? "setup" : "login"))
      .catch(() => setMode("login"))
  }, [])

  const update = (key: keyof typeof form, value: string | boolean) =>
    setForm((current) => ({ ...current, [key]: value }))

  const submit = async () => {
    setError("")
    setBusy(true)
    try {
      if (mode === "recovery") {
        await recoverAdmin({ token: form.token, email: form.email, newPassword: form.password })
        setMode("login")
        setInfo("Password reimpostata. Ora puoi accedere con quella nuova.")
        setForm((current) => ({ ...current, password: "", token: "" }))
        setBusy(false)
        return
      }
      if (mode === "setup") {
        await setupAdmin({
          token: form.token,
          first_name: form.first_name,
          last_name: form.last_name,
          email: form.email,
          password: form.password,
        })
      }
      const user = await login(form.email, form.password, form.remember)
      onLoggedIn(user)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Errore imprevisto")
      setBusy(false)
    }
  }

  const isSetup = mode === "setup"
  const isRecovery = mode === "recovery"

  return (
    <main className="login-page">
      <section className="login-brand-panel">
        <div className="login-brand">
          <img className="brand-logo" src="/logo-fad-white.png" alt="FAD LeadHub" />
          <div>
            <p className="brand-name">FAD LeadHub</p>
            <p className="brand-subtitle">Lead &amp; clienti</p>
          </div>
        </div>
        <div className="login-statement">
          <p className="login-kicker">Il lavoro, sotto controllo</p>
          <h1>Un solo spazio per far crescere ogni relazione.</h1>
          <p>
            Clienti, lead e performance: tutto ciò che serve al tuo team,
            ogni giorno.
          </p>
        </div>
        <div className="login-trust">
          <span>
            <Icon name="shield" size={17} />
          </span>
          <p>
            <strong>Accesso protetto</strong>
            <small>I dati FAD LeadHub sono riservati e sicuri.</small>
          </p>
        </div>
      </section>
      <section className="login-form-panel">
        <div className="login-form-wrap">
          <div className="login-mobile-brand">
            <img className="brand-logo" src="/logo-fad.png" alt="FAD LeadHub" />
            <strong>FAD LeadHub</strong>
          </div>
          <p className="today">{isSetup ? "Primo avvio" : isRecovery ? "Recupero" : "Area riservata"}</p>
          <h2>{isSetup ? "Crea l'amministratore" : isRecovery ? "Recupero amministratore" : "Bentornato"}</h2>
          <p className="login-intro">
            {isSetup
              ? "Nessun utente è ancora presente. Crea l'account dell'amministratore."
              : isRecovery
                ? "Serve il codice RECOVERY_TOKEN impostato su Netlify. Vale solo per gli amministratori."
                : "Inserisci le tue credenziali per accedere a FAD LeadHub."}
          </p>
          {mode === "loading" ? (
            <p className="login-intro">Caricamento…</p>
          ) : (
            <form
              onSubmit={(event) => {
                event.preventDefault()
                submit()
              }}
            >
              {isSetup && (
                <>
                  <label className="field-label">
                    <span>Nome</span>
                    <input
                      required
                      value={form.first_name}
                      onChange={(e) => update("first_name", e.target.value)}
                    />
                  </label>
                  <label className="field-label">
                    <span>Cognome</span>
                    <input
                      required
                      value={form.last_name}
                      onChange={(e) => update("last_name", e.target.value)}
                    />
                  </label>
                </>
              )}
              <label className="field-label">
                <span>Email aziendale</span>
                <input
                  required
                  type="email"
                  autoComplete="username"
                  placeholder="nome@fad.it"
                  value={form.email}
                  onChange={(e) => update("email", e.target.value)}
                />
              </label>
              <label className="field-label">
                <span>{isSetup || isRecovery ? "Password (minimo 10 caratteri)" : "Password"}</span>
                <div className="password-field">
                  <input
                    required
                    minLength={isSetup || isRecovery ? 10 : undefined}
                    type={visible ? "text" : "password"}
                    autoComplete={isSetup || isRecovery ? "new-password" : "current-password"}
                    placeholder="La tua password"
                    value={form.password}
                    onChange={(e) => update("password", e.target.value)}
                  />
                  <Button
                    title="Mostra password"
                    onClick={() => setVisible(!visible)}
                  >
                    {visible ? "Nascondi" : "Mostra"}
                  </Button>
                </div>
              </label>
              {(isSetup || isRecovery) && (
                <label className="field-label">
                  <span>
                    {isRecovery
                      ? "Codice di recupero (RECOVERY_TOKEN di Netlify)"
                      : "Codice di configurazione (SETUP_TOKEN di Netlify)"}
                  </span>
                  <input
                    required
                    type="password"
                    autoComplete="off"
                    value={form.token}
                    onChange={(e) => update("token", e.target.value)}
                  />
                </label>
              )}
              {!isSetup && !isRecovery && (
                <div className="login-options">
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={form.remember}
                      onChange={(e) => update("remember", e.target.checked)}
                    />
                    <span>Ricordami</span>
                  </label>
                  <Button
                    className="forgot-button"
                    onClick={() =>
                      setInfo(
                        "Chiedi all'amministratore di generarti una password temporanea (Agenti & permessi → Nuova password temporanea).",
                      )
                    }
                  >
                    Password dimenticata?
                  </Button>
                </div>
              )}
              {info && !error && <p className="form-ok flush">{info}</p>}
              {error && (
                <p className="form-error" role="alert">
                  {error}
                </p>
              )}
              <Button className="primary-button login-submit" type="submit">
                {busy
                  ? "Attendi…"
                  : isSetup
                    ? "Crea amministratore e accedi"
                    : isRecovery
                      ? "Reimposta password"
                      : "Accedi a FAD LeadHub"}{" "}
                <Icon name="arrow" size={17} />
              </Button>
            </form>
          )}
          <p className="login-help">
            Hai bisogno di aiuto? <strong>Contatta l'amministratore</strong>
            {mode === "login" && (
              <>
                {" · "}
                <button className="link-button" onClick={() => { setError(""); setInfo(""); setMode("recovery") }}>
                  Recupero amministratore
                </button>
              </>
            )}
            {isRecovery && (
              <>
                {" · "}
                <button className="link-button" onClick={() => { setError(""); setMode("login") }}>
                  Torna al login
                </button>
              </>
            )}
          </p>
        </div>
        <p className="login-legal">
          © 2026 F.A.D. SRL · Accesso riservato
        </p>
      </section>
    </main>
  )
}


const statusLabels: Record<string, string> = { OK: "Cliente OK", NR: "Non risponde", KO: "Non interessato" }

const formatDateTime = (value: string) =>
  new Date(value).toLocaleString("it-IT", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })

const formatDate = (value: string) =>
  new Date(value).toLocaleDateString("it-IT", { day: "numeric", month: "long", year: "numeric" })

const initialsOf = (first?: string | null, last?: string | null) =>
  `${first?.[0] ?? ""}${last?.[0] ?? ""}`.toUpperCase()

function CustomerFormModal({
  customer,
  sharedIds = [],
  user,
  onClose,
  onSaved,
}: {
  customer: CustomerDetailData["customer"] | null
  sharedIds?: string[]
  user: SessionUser
  onClose: () => void
  onSaved: (id: string) => void
}) {
  const isNew = customer === null
  const [meta, setMeta] = useState<CustomerMeta | null>(null)
  const [form, setForm] = useState<CustomerInput>({
    first_name: customer?.first_name ?? "",
    last_name: customer?.last_name ?? "",
    fiscal_code: customer?.fiscal_code ?? "",
    phone: customer?.phone ?? "",
    email: customer?.email ?? "",
    address: customer?.address ?? "",
    city: customer?.city ?? "",
    province: customer?.province ?? "",
    interests: customer?.interests ?? [],
    status: customer?.status ?? "OK",
    agent_id: customer?.agent_id ?? user.id,
    shared_agent_ids: sharedIds,
    reminder_11m: customer === null,
    notes: "",
  })
  const [error, setError] = useState("")
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    fetchCustomerMeta()
      .then(setMeta)
      .catch((err) => setError(err instanceof Error ? err.message : "Errore imprevisto"))
  }, [])

  const update = (key: keyof CustomerInput, value: string) =>
    setForm((current) => ({ ...current, [key]: value }))

  const toggleShared = (id: string) =>
    meta && !meta.can_remove_agents && sharedIds.includes(id)
      ? undefined // trainer e agenti possono solo aggiungere, non togliere
      : setForm((current) => ({
      ...current,
      shared_agent_ids: current.shared_agent_ids.includes(id)
        ? current.shared_agent_ids.filter((item) => item !== id)
        : [...current.shared_agent_ids, id],
    }))

  const toggleInterest = (name: string) =>
    setForm((current) => ({
      ...current,
      interests: current.interests.includes(name)
        ? current.interests.filter((item) => item !== name)
        : [...current.interests, name],
    }))

  const submit = async () => {
    setError("")
    setBusy(true)
    try {
      if (isNew) {
        const result = await createCustomer(form)
        onSaved(result.id)
      } else {
        await updateCustomer(customer!.id, form)
        onSaved(customer!.id)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Errore imprevisto")
      setBusy(false)
    }
  }

  return (
    <div className="modal-layer" role="presentation" onMouseDown={onClose}>
      <div
        className="modal wide"
        role="dialog"
        aria-modal="true"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="modal-head">
          <div>
            <p className="panel-kicker neutral">Clienti</p>
            <h2>{isNew ? "Nuovo cliente" : "Modifica cliente"}</h2>
          </div>
          <Button className="icon-button" onClick={onClose} title="Chiudi">
            <Icon name="close" />
          </Button>
        </div>
        <form
          onSubmit={(event) => {
            event.preventDefault()
            submit()
          }}
        >
          <div className="form-grid">
            <label>
              <span>Nome</span>
              <input required value={form.first_name} onChange={(e) => update("first_name", e.target.value)} />
            </label>
            <label>
              <span>Cognome</span>
              <input required value={form.last_name} onChange={(e) => update("last_name", e.target.value)} />
            </label>
            <label className="full">
              <span>Codice fiscale / P.IVA</span>
              <input
                maxLength={16}
                autoCapitalize="characters"
                placeholder="RSSMRA80A01F205X"
                value={form.fiscal_code}
                onChange={(e) => update("fiscal_code", e.target.value.toUpperCase())}
              />
            </label>
            <label>
              <span>Telefono</span>
              <input type="tel" placeholder="333 1234567" value={form.phone} onChange={(e) => update("phone", e.target.value)} />
            </label>
            <label>
              <span>Email</span>
              <input type="email" value={form.email} onChange={(e) => update("email", e.target.value)} />
            </label>
            <label className="full">
              <span>Indirizzo</span>
              <input placeholder="Via Roma 25" value={form.address} onChange={(e) => update("address", e.target.value)} />
            </label>
            <label>
              <span>Comune</span>
              <input value={form.city} onChange={(e) => update("city", e.target.value)} />
            </label>
            <label>
              <span>Provincia</span>
              <input maxLength={2} placeholder="PV" value={form.province} onChange={(e) => update("province", e.target.value.toUpperCase())} />
            </label>
            <label>
              <span>Stato cliente</span>
              <select value={form.status} onChange={(e) => update("status", e.target.value)}>
                <option value="OK">OK · gestibile</option>
                <option value="NR">NR · non risponde</option>
                <option value="KO">KO · non interessato</option>
              </select>
            </label>
            <label>
              <span>Agente responsabile</span>
              <select
                value={form.agent_id}
                disabled={!meta || meta.agents.length <= 1}
                onChange={(e) => update("agent_id", e.target.value)}
              >
                {(meta?.agents ?? [{ id: user.id, first_name: user.first_name, last_name: user.last_name }]).map(
                  (agent) => (
                    <option key={agent.id} value={agent.id}>
                      {agent.first_name} {agent.last_name}
                    </option>
                  ),
                )}
              </select>
            </label>
            {meta && meta.share_agents.length > 1 && (
              <div className="full field-block">
                <span>
                  Altri agenti che vedono questo cliente (vedranno le task della segreteria)
                  {!meta.can_remove_agents && sharedIds.length > 0 ? " · quelli già presenti non si possono togliere" : ""}
                </span>
                <div className="chip-row">
                  {meta.share_agents
                    .filter((a) => a.id !== form.agent_id)
                    .map((agent) => (
                      <Button
                        key={agent.id}
                        className={`chip ${form.shared_agent_ids.includes(agent.id) ? "on" : ""}`}
                        onClick={() => toggleShared(agent.id)}
                      >
                        {agent.first_name} {agent.last_name}
                      </Button>
                    ))}
                </div>
              </div>
            )}
            <div className="full field-block">
              <span>Prodotti / interessi</span>
              <div className="chip-row">
                {(meta?.products ?? []).map((name) => (
                  <Button
                    key={name}
                    className={`chip ${form.interests.includes(name) ? "on" : ""}`}
                    onClick={() => toggleInterest(name)}
                  >
                    {name}
                  </Button>
                ))}
                {!meta && <small className="muted">Caricamento…</small>}
              </div>
            </div>
            {isNew && (
              <label className="check-field full">
                <input
                  type="checkbox"
                  checked={form.reminder_11m}
                  onChange={(e) => setForm({ ...form, reminder_11m: e.target.checked })}
                />
                <span>Appuntamento fra 11 mesi: «Aggiornamento tariffe» in calendario</span>
              </label>
            )}
            {isNew && (
              <label className="full">
                <span>Nota iniziale (facoltativa)</span>
                <textarea
                  rows={3}
                  maxLength={2000}
                  value={form.notes ?? ""}
                  onChange={(e) => update("notes", e.target.value)}
                />
              </label>
            )}
          </div>
          {error && (
            <p className="form-error modal-error" role="alert">
              {error}
            </p>
          )}
          <div className="modal-actions">
            <Button className="secondary-button" onClick={onClose}>
              Annulla
            </Button>
            <Button className="primary-button" type="submit">
              {busy ? "Attendi…" : isNew ? "Crea cliente" : "Salva modifiche"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}

function PrivacyUploadModal({
  customerId,
  onClose,
  onSaved,
}: {
  customerId: string
  onClose: () => void
  onSaved: () => void
}) {
  const [signedAt, setSignedAt] = useState(localIso(new Date()))
  const [marketing, setMarketing] = useState("")
  const [third, setThird] = useState("")
  const [file, setFile] = useState<File | null>(null)
  const [error, setError] = useState("")
  const [busy, setBusy] = useState(false)

  const submit = async () => {
    setError("")
    if (!file) return setError("Scegli il PDF firmato")
    if (file.type !== "application/pdf") return setError("Sono ammessi solo file PDF")
    if (file.size > 4 * 1024 * 1024) return setError("Il PDF deve essere al massimo di 4 MB")
    if (!marketing || !third) return setError("Indica i due consensi come risultano sul documento")
    setBusy(true)
    try {
      await uploadSignedPrivacy({
        customer_id: customerId,
        signed_at: signedAt,
        consent_marketing: marketing === "si",
        consent_third_parties: third === "si",
        file,
      })
      onSaved()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Errore imprevisto")
      setBusy(false)
    }
  }

  return (
    <div className="modal-layer" role="presentation" onMouseDown={onClose}>
      <div className="modal" role="dialog" aria-modal="true" onMouseDown={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div>
            <p className="panel-kicker neutral">Privacy</p>
            <h2>Carica informativa già firmata</h2>
          </div>
          <Button className="icon-button" onClick={onClose} title="Chiudi">
            <Icon name="close" />
          </Button>
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            submit()
          }}
        >
          <div className="form-grid">
            <label>
              <span>Data della firma</span>
              <input required type="date" max={localIso(new Date())} value={signedAt} onChange={(e) => setSignedAt(e.target.value)} />
            </label>
            <label>
              <span>File PDF firmato</span>
              <input type="file" accept="application/pdf" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
            </label>
            <label>
              <span>Consenso marketing (i)</span>
              <select required value={marketing} onChange={(e) => setMarketing(e.target.value)}>
                <option value="">— Scegli —</option>
                <option value="si">Consento</option>
                <option value="no">Non consento</option>
              </select>
            </label>
            <label>
              <span>Cessione a terzi (ii)</span>
              <select required value={third} onChange={(e) => setThird(e.target.value)}>
                <option value="">— Scegli —</option>
                <option value="si">Consento</option>
                <option value="no">Non consento</option>
              </select>
            </label>
          </div>
          {error && (
            <p className="form-error modal-error" role="alert">
              {error}
            </p>
          )}
          <div className="modal-actions">
            <Button className="secondary-button" onClick={onClose}>
              Annulla
            </Button>
            <Button className="primary-button" type="submit">
              {busy ? "Caricamento…" : "Salva documento"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}

const PRIVACY_APP_URL = "https://app.privaclick.eu/"

function PrivacyPanel({ data, onReload }: { data: CustomerDetailData; onReload: () => void }) {
  const [message, setMessage] = useState("")
  const [showUpload, setShowUpload] = useState(false)

  const signed = data.privacy.find((p) => p.status === "firmata")
  const pending = data.privacy.find((p) => p.status === "inviata")
  const consent = (value: boolean | null) => (value === null ? "—" : value ? "Consente" : "Non consente")

  return (
    <article className="panel">
      <div className="panel-heading">
        <div>
          <p className="panel-kicker neutral">Privacy</p>
          <h2>Informativa e consensi</h2>
        </div>
        {signed ? (
          <span className="status ok">
            <i /> Firmata
          </span>
        ) : pending && !pending.expired ? (
          <span className="status pending">
            <i /> In attesa di firma
          </span>
        ) : (
          <span className="status ko">
            <i /> Non firmata
          </span>
        )}
      </div>
      <div className="privacy-body">
        {signed ? (
          <p>
            Firmata il <strong>{formatDateTime(signed.signed_at!)}</strong>
            {signed.method === "caricata" ? " (documento caricato a mano)" : " (conferma digitale)"}.<br />
            Marketing: <strong>{consent(signed.consent_marketing)}</strong> · Cessione a terzi:{" "}
            <strong>{consent(signed.consent_third_parties)}</strong>
          </p>
        ) : pending ? (
          <p>
            {pending.expired ? "Link scaduto. " : ""}Inviata il {formatDateTime(pending.sent_at)}
            {pending.email ? ` a ${pending.email}` : ""}
            {pending.expires_at && !pending.expired ? ` · scade il ${formatDate(pending.expires_at)}` : ""}.
          </p>
        ) : (
          <p className="muted">Nessuna informativa registrata per questo cliente.</p>
        )}
        {message && <p className="form-ok flush">{message}</p>}
        <div className="verify-actions">
          {data.can_edit && (
            <>
              <a className="primary-button" href={PRIVACY_APP_URL} target="_blank" rel="noopener noreferrer">
                Privacy
              </a>
              <Button className="secondary-button" onClick={() => setShowUpload(true)}>
                Carica PDF già firmato
              </Button>
            </>
          )}
          {signed?.has_pdf && (
            <a className="secondary-button" href={privacyPdfUrl(signed.id)} target="_blank" rel="noopener noreferrer">
              Apri PDF firmato
            </a>
          )}
        </div>
      </div>
      {showUpload && (
        <PrivacyUploadModal
          customerId={data.customer.id}
          onClose={() => setShowUpload(false)}
          onSaved={() => {
            setShowUpload(false)
            setMessage("Documento salvato su Google Drive.")
            onReload()
          }}
        />
      )}
    </article>
  )
}

function PublicSignPage({ token }: { token: string }) {
  const [view, setView] = useState<PrivacyView | null>(null)
  const [error, setError] = useState("")
  const [marketing, setMarketing] = useState<boolean | null>(null)
  const [third, setThird] = useState<boolean | null>(null)
  const [accept, setAccept] = useState(false)
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState<{ code: string; when: string } | null>(null)

  useEffect(() => {
    viewPrivacy(token)
      .then(setView)
      .catch((err) => setError(err instanceof Error ? err.message : "Errore di comunicazione"))
  }, [token])

  const submit = async () => {
    setError("")
    if (marketing === null || third === null) return setError("Scegli «Consento» o «Non consento» per entrambi i consensi")
    if (!accept) return setError("Conferma la dichiarazione per poter proseguire")
    setBusy(true)
    try {
      const res = await signPrivacy({
        token,
        consent_marketing: marketing,
        consent_third_parties: third,
      })
      setDone({ code: res.code, when: res.when })
    } catch (err) {
      setError(err instanceof Error ? err.message : "Errore imprevisto")
      setBusy(false)
    }
  }

  const messages: Record<string, string> = {
    invalid: "Questo link non è valido. Controlla di aver aperto il link completo ricevuto.",
    expired: "Questo link è scaduto. Chiedi di riceverne uno nuovo.",
    signed: "Questa informativa risulta già firmata. Non serve fare altro.",
    replaced: "Questo link è stato sostituito da uno più recente. Usa l'ultimo ricevuto.",
  }

  return (
    <main className="sign-page">
      <div className="sign-card">
        <div className="sign-brand">
          <img className="brand-logo" src="/logo-fad.png" alt="FAD LeadHub" />
          <strong>FAD LeadHub</strong>
        </div>
        {!view && !error && <p className="muted">Caricamento…</p>}
        {error && !view && <p className="form-error">{error}</p>}
        {view && view.state !== "pending" && <p className="sign-message">{messages[view.state]}</p>}
        {done && (
          <div className="sign-message ok">
            <h2>Grazie, la conferma è stata registrata.</h2>
            <p className="sign-receipt">
              <span>{done.when}</span>
              <strong>Codice ID: {done.code}</strong>
            </p>
            <p>Conserva il codice ID. Se hai indicato la tua email, riceverai una copia dell'informativa confermata. Puoi chiudere questa pagina.</p>
          </div>
        )}
        {view?.state === "pending" && !done && (
          <>
            <h1>Informativa privacy</h1>
            <p className="muted">
              Leggi il documento, scegli i consensi e conferma in fondo alla pagina.
            </p>
            <div className="sign-text">
              {view.blocks.map((block, index) => {
                if (block.type === "title") return <h2 key={index}>{block.text}</h2>
                if (block.type === "h") return <h3 key={index}>{block.text}</h3>
                if (block.type === "consent") {
                  const value = block.id === "marketing" ? marketing : third
                  const set = block.id === "marketing" ? setMarketing : setThird
                  return (
                    <div className="consent-box" key={index}>
                      <p>{block.text}</p>
                      <div className="consent-choices">
                        <label>
                          <input type="radio" name={`c-${block.id}`} checked={value === true} onChange={() => set(true)} /> Consento
                        </label>
                        <label>
                          <input type="radio" name={`c-${block.id}`} checked={value === false} onChange={() => set(false)} /> Non consento
                        </label>
                      </div>
                    </div>
                  )
                }
                return <p key={index}>{block.text}</p>
              })}
            </div>
            <label className="sign-accept">
              <input type="checkbox" checked={accept} onChange={(e) => setAccept(e.target.checked)} />
              <span>
                Confermo di aver letto l'informativa e le scelte che ho indicato. Giorno, data, ora e indirizzo IP
                verranno registrati insieme a un codice ID della conferma.
              </span>
            </label>
            {error && <p className="form-error">{error}</p>}
            <Button className="primary-button sign-submit" onClick={submit}>
              {busy ? "Invio in corso…" : "Conferma e invia"}
            </Button>
          </>
        )}
      </div>
    </main>
  )
}

function AddAgentsModal({
  customerId,
  responsibleId,
  currentIds,
  onClose,
  onSaved,
}: {
  customerId: string
  responsibleId: string | null
  currentIds: string[]
  onClose: () => void
  onSaved: () => void
}) {
  const [meta, setMeta] = useState<CustomerMeta | null>(null)
  const [picked, setPicked] = useState<string[]>([])
  const [error, setError] = useState("")
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    fetchCustomerMeta()
      .then(setMeta)
      .catch((err) => setError(err instanceof Error ? err.message : "Errore imprevisto"))
  }, [])

  const options = (meta?.share_agents ?? []).filter((a) => a.id !== responsibleId && !currentIds.includes(a.id))

  const submit = async () => {
    if (picked.length === 0 || busy) return
    setBusy(true)
    setError("")
    try {
      await addCustomerAgents(customerId, picked)
      onSaved()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Errore imprevisto")
      setBusy(false)
    }
  }

  return (
    <div className="modal-layer" role="presentation" onMouseDown={onClose}>
      <div className="modal" role="dialog" aria-modal="true" onMouseDown={(event) => event.stopPropagation()}>
        <div className="modal-head">
          <div>
            <p className="panel-kicker neutral">Clienti</p>
            <h2>Aggiungi agenti al cliente</h2>
          </div>
          <Button className="icon-button" onClick={onClose} title="Chiudi">
            <Icon name="close" />
          </Button>
        </div>
        <div className="full field-block">
          <span>Gli agenti scelti vedranno il cliente e vedranno la scheda e le task collegate. Gli agenti già presenti restano.</span>
          <div className="chip-row">
            {options.map((agent) => (
              <Button
                key={agent.id}
                className={`chip ${picked.includes(agent.id) ? "on" : ""}`}
                onClick={() => setPicked((cur) => (cur.includes(agent.id) ? cur.filter((x) => x !== agent.id) : [...cur, agent.id]))}
              >
                {agent.first_name} {agent.last_name}
              </Button>
            ))}
            {!meta && !error && <small className="muted">Caricamento…</small>}
            {meta && options.length === 0 && <small className="muted">Nessun altro agente da aggiungere.</small>}
          </div>
        </div>
        {error && (
          <p className="form-error modal-error" role="alert">
            {error}
          </p>
        )}
        <div className="modal-actions">
          <Button className="secondary-button" onClick={onClose}>
            Annulla
          </Button>
          <Button className="primary-button" onClick={submit}>
            {busy ? "Attendi…" : `Aggiungi${picked.length ? ` (${picked.length})` : ""}`}
          </Button>
        </div>
      </div>
    </div>
  )
}

function ConfirmNameModal({
  name,
  title,
  warning,
  onClose,
  onConfirm,
}: {
  name: string
  title: string
  warning: string
  onClose: () => void
  onConfirm: (typed: string) => Promise<void>
}) {
  const [typed, setTyped] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const match = typed.replace(/\s+/g, " ").trim().toLowerCase() === name.replace(/\s+/g, " ").trim().toLowerCase()

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (!match || busy) return
    setBusy(true)
    setError("")
    try {
      await onConfirm(typed)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Errore imprevisto")
      setBusy(false)
    }
  }

  return (
    <div className="modal-layer" role="dialog" aria-modal="true">
      <form className="modal" onSubmit={submit}>
        <div className="modal-head">
          <div>
            <p className="today">Azione irreversibile</p>
            <h2>{title}</h2>
          </div>
          <Button className="icon-button" onClick={onClose} title="Chiudi">
            <Icon name="close" />
          </Button>
        </div>
        <div className="delete-body">
          <p className="form-error" style={{ margin: 0 }}>
            {warning}
          </p>
          <label className="delete-field">
            <span>Per confermare scrivi nome e cognome</span>
            <input value={typed} onChange={(e) => setTyped(e.target.value)} placeholder={name} autoFocus autoComplete="off" />
          </label>
          {error && <p className="form-error" style={{ margin: 0 }}>{error}</p>}
        </div>
        <div className="modal-actions">
          <Button className="secondary-button" onClick={onClose}>
            Annulla
          </Button>
          <button type="submit" className="primary-button delete-confirm" disabled={!match || busy}>
            {busy ? "Elimino…" : "Elimina definitivamente"}
          </button>
        </div>
      </form>
    </div>
  )
}

function CustomerDetail({
  id,
  user,
  version,
  onBack,
  onChanged,
  onOpenTasks,
}: {
  id: string
  user: SessionUser
  version: number
  onBack: () => void
  onChanged: () => void
  onOpenTasks: () => void
}) {
  const [data, setData] = useState<CustomerDetailData | null>(null)
  const [error, setError] = useState("")
  const [editing, setEditing] = useState(false)
  const [addingAgents, setAddingAgents] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [note, setNote] = useState("")
  const [noteError, setNoteError] = useState("")

  const load = () =>
    fetchCustomer(id)
      .then((result) => {
        setData(result)
        setError("")
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Errore imprevisto"))

  useEffect(() => {
    setData(null)
    load()
  }, [id, version])

  if (error && !data) {
    return (
      <div className="customer-detail">
        <Button className="secondary-button back-button" onClick={onBack}>
          ← Clienti
        </Button>
        <p className="form-error">{error}</p>
      </div>
    )
  }
  if (!data) return <div className="customer-detail"><p className="muted">Caricamento cliente…</p></div>

  const { customer } = data
  const place = [customer.address, [customer.city, customer.province && `(${customer.province})`].filter(Boolean).join(" ")]
    .filter(Boolean)
    .join(", ")

  const changeStatus = async (status: "OK" | "NR" | "KO") => {
    try {
      await setCustomerStatus(customer.id, status)
      await load()
      onChanged()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Errore imprevisto")
    }
  }

  const submitNote = async () => {
    setNoteError("")
    try {
      await addCustomerNote(customer.id, note)
      setNote("")
      await load()
    } catch (err) {
      setNoteError(err instanceof Error ? err.message : "Errore imprevisto")
    }
  }

  return (
    <div className="customer-detail">
      <Button className="secondary-button back-button" onClick={onBack}>
        ← Clienti
      </Button>
      <article className="panel customer-hero">
        <div className="customer-avatar">{initialsOf(customer.first_name, customer.last_name)}</div>
        <div className="customer-title">
          <div>
            <span className={`status ${customer.status === "OK" ? "ok" : customer.status === "NR" ? "pending" : "ko"}`}>
              <i /> {statusLabels[customer.status]}
            </span>
          </div>
          <h2>
            {customer.first_name} {customer.last_name}
          </h2>
          <p>
            Cliente dal {formatDate(customer.created_at)} · Agente responsabile:{" "}
            <strong>{customer.agent_name ?? "—"}</strong>
          </p>
        </div>
        <div className="customer-actions">
          {data.can_edit && (
            <Button className="secondary-button" onClick={() => setEditing(true)}>
              Modifica cliente
            </Button>
          )}
          {user.permissions.includes("customers.delete") && (
            <Button className="secondary-button danger-outline" onClick={() => setDeleting(true)}>
              Elimina cliente
            </Button>
          )}
        </div>
      </article>
      {error && <p className="form-error">{error}</p>}

      {data.can_edit && (
        <div className="status-switch" role="group" aria-label="Stato cliente">
          <span>Stato:</span>
          {(["OK", "NR", "KO"] as const).map((status) => (
            <Button
              key={status}
              className={`chip state-${status.toLowerCase()} ${customer.status === status ? "on" : ""}`}
              onClick={() => changeStatus(status)}
            >
              {status}
            </Button>
          ))}
        </div>
      )}

      <div className="detail-grid">
        <article className="panel info-card">
          <p className="panel-kicker neutral">Contatti</p>
          <dl>
            <div>
              <dt>Altri agenti</dt>
              <dd>
                {data.shared_agents.map((a) => a.first_name).join(", ") || "—"}
                {data.can_add_agents && (
                  <>
                    {" "}
                    <button type="button" className="link-button" onClick={() => setAddingAgents(true)}>
                      + Aggiungi agente
                    </button>
                  </>
                )}
              </dd>
            </div>
            <div>
              <dt>Codice fiscale</dt>
              <dd>{customer.fiscal_code ?? "—"}</dd>
            </div>
            <div>
              <dt>Telefono</dt>
              <dd>{customer.phone ?? "—"}</dd>
            </div>
            <div>
              <dt>Email</dt>
              <dd>{customer.email ?? "—"}</dd>
            </div>
            <div>
              <dt>Indirizzo</dt>
              <dd>{place || "—"}</dd>
            </div>
          </dl>
        </article>
        <article className="panel info-card">
          <p className="panel-kicker neutral">Prodotti / interessi</p>
          {customer.interests.length > 0 ? (
            <div className="chip-row">
              {customer.interests.map((name) => (
                <span className="chip on static" key={name}>
                  {name}
                </span>
              ))}
            </div>
          ) : (
            <p className="muted">Nessun interesse indicato.</p>
          )}
        </article>
      </div>

      <article className="panel">
        <div className="panel-heading">
          <div>
            <p className="panel-kicker neutral">Segreteria</p>
            <h2>Task del cliente</h2>
          </div>
          <Button className="secondary-button" onClick={onOpenTasks}>
            Apri Segreteria <Icon name="arrow" size={15} />
          </Button>
        </div>
        <div className="doc-list">
          {data.tasks.length === 0 && <p className="muted pad">Nessuna task per questo cliente.</p>}
          {data.tasks.map((t) => (
            <div className="doc-row clickable" key={t.id} onClick={onOpenTasks}>
              <Icon name={t.kind === "ko" ? "warning" : "check"} size={18} />
              <div>
                <strong>{t.kind === "ko" ? "KO da recuperare" : "Task"} · {t.title}</strong>
                <small>
                  Agente: {t.agent_first_name} {t.agent_last_name}
                  {t.due_date ? ` · entro il ${formatDate(t.due_date)}` : ""}
                </small>
              </div>
              <TaskStatusBadge status={t.status} kind={t.kind} />
            </div>
          ))}
        </div>
      </article>

      <PrivacyPanel data={data} onReload={load} />

      <article className="panel">
        <div className="panel-heading">
          <div>
            <p className="panel-kicker neutral">Note</p>
            <h2>Note sul cliente</h2>
          </div>
        </div>
        <form
          className="note-form"
          onSubmit={(event) => {
            event.preventDefault()
            submitNote()
          }}
        >
          <textarea
            rows={2}
            maxLength={2000}
            placeholder="Scrivi una nota (es. cliente richiamato, interessato a luce e gas)…"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
          <Button className="primary-button" type="submit">
            Aggiungi nota
          </Button>
        </form>
        {noteError && <p className="form-error modal-error">{noteError}</p>}
        <div className="note-list">
          {data.notes.length === 0 && <p className="muted pad">Ancora nessuna nota.</p>}
          {data.notes.map((item) => (
            <div className="note-item" key={item.id}>
              <small>
                {formatDateTime(item.created_at)} — {item.author_name ?? "Utente"}
              </small>
              <p>{item.body}</p>
            </div>
          ))}
        </div>
      </article>

      <article className="panel">
        <div className="panel-heading">
          <div>
            <p className="panel-kicker neutral">Storico</p>
            <h2>Cronologia del cliente</h2>
          </div>
        </div>
        <ol className="timeline">
          {data.history.map((item) => (
            <li key={item.id}>
              <small>{formatDateTime(item.created_at)}</small>
              <span>
                {item.description}
                {item.actor_name ? ` · ${item.actor_name}` : ""}
              </span>
            </li>
          ))}
        </ol>
      </article>

      {deleting && (
        <ConfirmNameModal
          title="Eliminare la scheda cliente?"
          warning="Sei sicuro di voler cancellare la scheda cliente? Tutte le task, le note e i dati verranno cancellati."
          name={`${customer.first_name} ${customer.last_name}`}
          onClose={() => setDeleting(false)}
          onConfirm={async (typed) => {
            await deleteCustomer(customer.id, typed)
            setDeleting(false)
            onChanged()
            onBack()
          }}
        />
      )}
      {addingAgents && (
        <AddAgentsModal
          customerId={customer.id}
          responsibleId={customer.agent_id}
          currentIds={data.shared_agents.map((a) => a.id)}
          onClose={() => setAddingAgents(false)}
          onSaved={() => {
            setAddingAgents(false)
            load()
            onChanged()
          }}
        />
      )}
      {editing && (
        <CustomerFormModal
          customer={customer}
          sharedIds={data.shared_agents.map((a) => a.id)}
          user={user}
          onClose={() => setEditing(false)}
          onSaved={() => {
            setEditing(false)
            load()
            onChanged()
          }}
        />
      )}
    </div>
  )
}

function CustomersPage({
  user,
  search,
  version,
  focusId,
  onChanged,
  onOpenTasks,
}: {
  user: SessionUser
  search: string
  version: number
  focusId: string | null
  onChanged: () => void
  onOpenTasks: () => void
}) {
  const [rows, setRows] = useState<CustomerRow[] | null>(null)
  const [error, setError] = useState("")
  const [query, setQuery] = useState("")
  const [filter, setFilter] = useState<"Tutti" | "OK" | "NR" | "KO">("Tutti")
  const [selectedId, setSelectedId] = useState<string | null>(focusId)

  useEffect(() => {
    fetchCustomers()
      .then((result) => {
        setRows(result)
        setError("")
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Errore imprevisto"))
  }, [version])

  useEffect(() => {
    if (focusId) setSelectedId(focusId)
  }, [focusId])

  if (error && !rows) return <p className="form-error">{error}</p>
  if (!rows) return <p className="muted">Caricamento clienti…</p>

  const needle = (query || search).toLowerCase().trim()
  const visible = rows.filter(
    (row) =>
      (filter === "Tutti" || row.status === filter) &&
      (!needle ||
        `${row.first_name} ${row.last_name} ${row.phone ?? ""} ${row.email ?? ""} ${row.city ?? ""}`
          .toLowerCase()
          .includes(needle)),
  )

  return (
    <section className={`customer-layout ${selectedId ? "has-selection" : ""}`}>
      <aside className="panel customer-list">
        <div className="list-search">
          <Icon name="search" size={17} />
          <input
            placeholder="Cerca nome, telefono, comune…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <div className="filter-row">
          {(["Tutti", "OK", "NR", "KO"] as const).map((item) => (
            <Button
              key={item}
              className={`chip ${filter === item ? "on" : ""}`}
              onClick={() => setFilter(item)}
            >
              {item}
            </Button>
          ))}
        </div>
        {visible.length === 0 && (
          <p className="muted pad">
            {rows.length === 0 ? "Nessun cliente ancora. Creane uno con “Nuovo cliente”." : "Nessun risultato."}
          </p>
        )}
        {visible.map((row) => (
          <Button
            key={row.id}
            className={`customer-list-item ${row.id === selectedId ? "selected" : ""}`}
            onClick={() => setSelectedId(row.id)}
          >
            <span className="mini-avatar">{initialsOf(row.first_name, row.last_name)}</span>
            <span>
              <strong>
                {row.first_name} {row.last_name}
              </strong>
              <small>{row.city ?? row.phone ?? "—"}</small>
            </span>
            <span className={`customer-state ${row.status.toLowerCase()}`}>{row.status}</span>
          </Button>
        ))}
      </aside>
      {selectedId ? (
        <CustomerDetail
          key={selectedId}
          id={selectedId}
          user={user}
          version={version}
          onBack={() => setSelectedId(null)}
          onChanged={onChanged}
          onOpenTasks={onOpenTasks}
        />
      ) : (
        <div className="customer-detail empty-detail">
          <p className="muted">Seleziona un cliente dall'elenco per vedere la scheda.</p>
        </div>
      )}
    </section>
  )
}

function ChangePasswordPage({
  onDone,
  onLogout,
}: {
  onDone: () => void
  onLogout: () => void
}) {
  const [current, setCurrent] = useState("")
  const [next, setNext] = useState("")
  const [repeat, setRepeat] = useState("")
  const [error, setError] = useState("")
  const [busy, setBusy] = useState(false)

  const submit = async () => {
    setError("")
    if (next !== repeat) {
      setError("Le due nuove password non coincidono")
      return
    }
    setBusy(true)
    try {
      await changePassword(current, next)
      onDone()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Errore imprevisto")
      setBusy(false)
    }
  }

  return (
    <main className="boot-screen">
      <div className="modal">
        <div className="modal-head">
          <div>
            <p className="panel-kicker neutral">Primo accesso</p>
            <h2>Scegli la tua password</h2>
          </div>
        </div>
        <form
          onSubmit={(event) => {
            event.preventDefault()
            submit()
          }}
        >
          <div className="form-grid">
            <label className="full">
              <span>Password temporanea ricevuta</span>
              <input
                required
                type="password"
                autoComplete="current-password"
                value={current}
                onChange={(e) => setCurrent(e.target.value)}
              />
            </label>
            <label className="full">
              <span>Nuova password (minimo 10 caratteri)</span>
              <input
                required
                minLength={10}
                type="password"
                autoComplete="new-password"
                value={next}
                onChange={(e) => setNext(e.target.value)}
              />
            </label>
            <label className="full">
              <span>Ripeti la nuova password</span>
              <input
                required
                minLength={10}
                type="password"
                autoComplete="new-password"
                value={repeat}
                onChange={(e) => setRepeat(e.target.value)}
              />
            </label>
            {error && (
              <p className="form-error full-row" role="alert">
                {error}
              </p>
            )}
          </div>
          <div className="modal-actions">
            <Button className="secondary-button" onClick={onLogout}>
              Esci
            </Button>
            <Button className="primary-button" type="submit">
              {busy ? "Attendi…" : "Salva password"}
            </Button>
          </div>
        </form>
      </div>
    </main>
  )
}

function AgentModal({
  data,
  agent,
  currentUserId,
  canDelete,
  onClose,
  onChanged,
}: {
  data: AgentsData
  agent: Agent | null
  currentUserId: string
  canDelete: boolean
  onClose: () => void
  onChanged: () => void
}) {
  const isNew = agent === null
  const isSelf = agent?.id === currentUserId
  const [form, setForm] = useState<AgentInput>({
    first_name: agent?.first_name ?? "",
    last_name: agent?.last_name ?? "",
    email: agent?.email ?? "",
    phone: agent?.phone ?? "",
    office_id: agent?.office_id ?? data.offices[0]?.id ?? "",
    role: agent?.role ?? "agente",
    status: agent?.status ?? "attivo",
    hire_date: agent?.hire_date ?? "",
  })
  const [overrides, setOverrides] = useState<Record<string, boolean | null>>(() => {
    const initial: Record<string, boolean | null> = {}
    for (const item of data.overrides) {
      if (item.user_id === agent?.id) initial[item.permission_key] = item.granted
    }
    return initial
  })
  const [error, setError] = useState("")
  const [notice, setNotice] = useState("")
  const [tempPassword, setTempPassword] = useState("")
  const [busy, setBusy] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const update = (key: keyof AgentInput, value: string) =>
    setForm((current) => ({ ...current, [key]: value }))

  const run = async (task: () => Promise<void>) => {
    setError("")
    setNotice("")
    setBusy(true)
    try {
      await task()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Errore imprevisto")
    } finally {
      setBusy(false)
    }
  }

  const saveData = () =>
    run(async () => {
      if (isNew) {
        const result = await createAgent(form)
        setTempPassword(result.tempPassword)
        setNotice("Agente creato. Comunica la password temporanea qui sotto.")
      } else {
        await updateAgent(agent!.id, form)
        setNotice("Dati salvati.")
      }
      onChanged()
    })

  const resetPassword = () =>
    run(async () => {
      const result = await resetAgentPassword(agent!.id)
      setTempPassword(result.tempPassword)
      setNotice("Nuova password temporanea generata. Al prossimo accesso dovrà cambiarla.")
      onChanged()
    })

  const savePermissions = () =>
    run(async () => {
      await setAgentPermissions(agent!.id, overrides)
      setNotice("Permessi salvati.")
      onChanged()
    })

  const roleDefault = (key: string) =>
    data.rolePermissions.some((r) => r.role === form.role && r.permission_key === key)

  return (
    <div className="modal-layer" role="presentation" onMouseDown={onClose}>
      <div
        className="modal wide"
        role="dialog"
        aria-modal="true"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="modal-head">
          <div>
            <p className="panel-kicker neutral">Agenti & permessi</p>
            <h2>{isNew ? "Nuovo agente" : `${agent!.first_name} ${agent!.last_name}`}</h2>
          </div>
          <Button className="icon-button" onClick={onClose} title="Chiudi">
            <Icon name="close" />
          </Button>
        </div>

        <form
          onSubmit={(event) => {
            event.preventDefault()
            saveData()
          }}
        >
          <div className="form-grid">
            <label>
              <span>Nome</span>
              <input required value={form.first_name} onChange={(e) => update("first_name", e.target.value)} />
            </label>
            <label>
              <span>Cognome</span>
              <input required value={form.last_name} onChange={(e) => update("last_name", e.target.value)} />
            </label>
            <label>
              <span>Email</span>
              <input required type="email" value={form.email} onChange={(e) => update("email", e.target.value)} />
            </label>
            <label>
              <span>Telefono</span>
              <input type="tel" value={form.phone} onChange={(e) => update("phone", e.target.value)} />
            </label>
            <label>
              <span>Ufficio</span>
              <select value={form.office_id} onChange={(e) => update("office_id", e.target.value)}>
                <option value="">— Nessuno —</option>
                {data.offices.map((office) => (
                  <option key={office.id} value={office.id}>
                    {office.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>Data di ingresso</span>
              <input type="date" value={form.hire_date} onChange={(e) => update("hire_date", e.target.value)} />
            </label>
            <label>
              <span>Ruolo</span>
              <select
                value={form.role}
                disabled={isSelf}
                onChange={(e) => update("role", e.target.value)}
              >
                {data.roles.map((r) => (
                  <option key={r.key} value={r.key}>
                    {r.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>Stato</span>
              <select
                value={form.status}
                disabled={isSelf}
                onChange={(e) => update("status", e.target.value)}
              >
                <option value="attivo">Attivo</option>
                <option value="sospeso">Sospeso</option>
              </select>
            </label>
          </div>

          {isNew && (
            <p className="modal-hint">
              Il sistema genera una password temporanea, che mostra una sola volta dopo il
              salvataggio. Al primo accesso l'agente dovrà sceglierne una sua.
            </p>
          )}
          {isSelf && (
            <p className="modal-hint">
              Il tuo account: ruolo e stato non si possono modificare, per non restare chiusi fuori.
            </p>
          )}

          {tempPassword && (
            <div className="secret-box">
              <span>Password temporanea (visibile solo ora)</span>
              <strong>{tempPassword}</strong>
              <Button
                className="secondary-button"
                onClick={() => navigator.clipboard?.writeText(tempPassword)}
              >
                Copia
              </Button>
            </div>
          )}
          {notice && <p className="form-ok">{notice}</p>}
          {error && (
            <p className="form-error modal-error" role="alert">
              {error}
            </p>
          )}

          {!isNew && (
            <section className="perm-section">
              <div className="perm-head">
                <div>
                  <strong>Permessi personalizzati</strong>
                  <span>
                    Di base valgono quelli del ruolo. Qui puoi concedere o togliere un singolo
                    permesso a questa persona.
                  </span>
                </div>
                {!isSelf && (
                  <Button className="secondary-button" onClick={savePermissions}>
                    Salva permessi
                  </Button>
                )}
              </div>
              <div className="perm-list">
                {data.permissions.map((permission) => {
                  const value = overrides[permission.key]
                  return (
                    <label className="perm-row" key={permission.key}>
                      <span>{permission.description}</span>
                      <select
                        disabled={isSelf}
                        value={value === true ? "grant" : value === false ? "deny" : "default"}
                        onChange={(e) =>
                          setOverrides((current) => ({
                            ...current,
                            [permission.key]:
                              e.target.value === "grant" ? true : e.target.value === "deny" ? false : null,
                          }))
                        }
                      >
                        <option value="default">
                          Come il ruolo ({roleDefault(permission.key) ? "Sì" : "No"})
                        </option>
                        <option value="grant">Concedi</option>
                        <option value="deny">Togli</option>
                      </select>
                    </label>
                  )
                })}
              </div>
              {form.role !== agent!.role && (
                <p className="modal-hint">
                  Hai cambiato il ruolo ma non l'hai ancora salvato: i permessi "Come il ruolo"
                  si aggiornano dopo il salvataggio dei dati.
                </p>
              )}
            </section>
          )}

          <div className="modal-actions spread">
            {!isNew && !isSelf ? (
              <div className="modal-actions-right">
                <Button className="secondary-button" onClick={resetPassword}>
                  Nuova password temporanea
                </Button>
                {canDelete && (
                  <Button className="secondary-button danger-outline" onClick={() => setDeleting(true)}>
                    Elimina profilo
                  </Button>
                )}
              </div>
            ) : (
              <span />
            )}
            <div className="modal-actions-right">
              <Button className="secondary-button" onClick={onClose}>
                Chiudi
              </Button>
              <Button className="primary-button" type="submit">
                {busy ? "Attendi…" : isNew ? "Crea agente" : "Salva dati"}
              </Button>
            </div>
          </div>
        </form>
      </div>
      {deleting && agent && (
        <ConfirmNameModal
          title="Eliminare il profilo?"
          warning="Il profilo verrà cancellato per sempre, con le sue statistiche e il calendario personale. Se ha clienti o task della segreteria collegati non si può eliminare: va disattivato."
          name={`${agent.first_name} ${agent.last_name}`}
          onClose={() => setDeleting(false)}
          onConfirm={async (typed) => {
            await deleteAgent(agent.id, typed)
            setDeleting(false)
            onChanged()
            onClose()
          }}
        />
      )}
    </div>
  )
}

function AgentsPage({ currentUserId, canRoles, canDelete }: { currentUserId: string; canRoles: boolean; canDelete: boolean }) {
  const [data, setData] = useState<AgentsData | null>(null)
  const [view, setView] = useState<"people" | "roles">("people")
  const [error, setError] = useState("")
  const [editing, setEditing] = useState<Agent | "new" | null>(null)

  const load = () =>
    fetchAgents()
      .then((result) => {
        setData(result)
        setError("")
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Errore imprevisto"))

  useEffect(() => {
    load()
  }, [])

  if (error && !data) return <p className="form-error">{error}</p>
  if (!data) return <p className="muted">Caricamento agenti…</p>

  const customCount = (id: string) => data.overrides.filter((o) => o.user_id === id).length
  const editingAgent = editing && editing !== "new" ? editing : null

  return (
    <>
      {canRoles && (
        <div className="filter-row roles-tabs">
          <button type="button" className={`chip ${view === "people" ? "on" : ""}`} onClick={() => setView("people")}>
            Persone
          </button>
          <button type="button" className={`chip ${view === "roles" ? "on" : ""}`} onClick={() => setView("roles")}>
            Ruoli e permessi
          </button>
        </div>
      )}
      {view === "roles" && canRoles ? (
        <RolesPanel data={data} onChanged={load} />
      ) : (
        <>
      <div className="agents-toolbar">
        <p className="muted">
          {data.agents.length} persone · {data.agents.filter((a) => a.status === "attivo").length} attive
        </p>
        <Button className="primary-button" onClick={() => setEditing("new")}>
          <Icon name="plus" size={18} /> Nuovo agente
        </Button>
      </div>
      <section className="people-grid">
        {data.agents.map((person, index) => {
          const custom = customCount(person.id)
          return (
            <article
              className={`panel person-card clickable ${person.status === "sospeso" ? "is-suspended" : ""}`}
              key={person.id}
              onClick={() => setEditing(person)}
            >
              <div className={`person-avatar tone-${index % 5}`}>
                {`${person.first_name[0] ?? ""}${person.last_name[0] ?? ""}`.toUpperCase()}
              </div>
              <h2>
                {person.first_name} {person.last_name}
              </h2>
              <p>
                {roleLabels[person.role] ?? person.role}
                {person.office_name ? ` · ${person.office_name}` : ""}
              </p>
              <span className={`status ${person.status === "attivo" ? "ok" : "ko"}`}>
                <i /> {person.status === "attivo" ? "Attivo" : "Sospeso"}
              </span>
              <div className="person-actions">
                <span>
                  {custom > 0
                    ? `${custom} permess${custom === 1 ? "o" : "i"} personalizzat${custom === 1 ? "o" : "i"}`
                    : "Permessi del ruolo"}
                </span>
                <Button className="row-button" title="Apri scheda">
                  <Icon name="chevron" size={17} />
                </Button>
              </div>
            </article>
          )
        })}
      </section>
      {editing && (
        <AgentModal
          key={editingAgent?.id ?? "new"}
          data={data}
          agent={editingAgent}
          currentUserId={currentUserId}
          canDelete={canDelete}
          onClose={() => setEditing(null)}
          onChanged={load}
        />
      )}
        </>
      )}
    </>
  )
}

const localIso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`

const percent = (part: number, total: number) =>
  total > 0 ? `${((part / total) * 100).toFixed(1).replace(".", ",")}%` : "—"

function StatsModal({
  agents,
  canViewAll,
  user,
  onClose,
  onSaved,
}: {
  agents: StatsData["agents"]
  canViewAll: boolean
  user: SessionUser
  onClose: () => void
  onSaved: () => void
}) {
  const yesterday = (() => {
    const d = new Date()
    d.setDate(d.getDate() - 1)
    return localIso(d)
  })()
  const [date, setDate] = useState(yesterday)
  const [agentId, setAgentId] = useState(user.id)
  const [values, setValues] = useState({ contatti: "0", fissati: "0", chiusi: "0", con_trattativa: "0", senza_trattativa: "0", pacchi: "0" })
  const [auto, setAuto] = useState<Record<string, number> | null>(null)
  const [error, setError] = useState("")
  const [busy, setBusy] = useState(false)

  // Se per quel giorno ci sono gia' numeri inseriti a mano li mostra per correggerli;
  // sotto vengono mostrati quelli raccolti in automatico da LeadHub (non modificabili)
  useEffect(() => {
    fetchStats({ from: date, to: date, agent_id: canViewAll ? agentId : undefined, for_entry: canViewAll && agentId !== user.id })
      .then((result) => {
        const m = result.day_detail?.manual ?? {}
        setValues({
          contatti: String(m.contatti ?? 0),
          fissati: String(m.fissati ?? 0),
          chiusi: String(m.chiusi ?? 0),
          con_trattativa: String(m.con_trattativa ?? 0),
          senza_trattativa: String(m.senza_trattativa ?? 0),
          pacchi: String(m.pacchi ?? 0),
        })
        setAuto(result.day_detail?.auto ?? null)
      })
      .catch(() => {})
  }, [date, agentId])

  const labels: [keyof typeof values, string][] = [
    ["contatti", "Contatti"],
    ["fissati", "Appuntamenti fissati"],
    ["con_trattativa", "Incontrati con trattativa"],
    ["senza_trattativa", "Incontrati senza trattativa"],
    ["chiusi", "Contratti conclusi"],
    ["pacchi", "Pacchi"],
  ]

  const submit = async () => {
    setError("")
    setBusy(true)
    try {
      await saveStats({
        date,
        agent_id: canViewAll ? agentId : undefined,
        contatti: Number(values.contatti),
        fissati: Number(values.fissati),
        chiusi: Number(values.chiusi),
        con_trattativa: Number(values.con_trattativa),
        senza_trattativa: Number(values.senza_trattativa),
        pacchi: Number(values.pacchi),
      })
      onSaved()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Errore imprevisto")
      setBusy(false)
    }
  }

  return (
    <div className="modal-layer" role="presentation" onMouseDown={onClose}>
      <div className="modal stats-modal" role="dialog" aria-modal="true" onMouseDown={(event) => event.stopPropagation()}>
        <div className="modal-head">
          <div>
            <p className="panel-kicker neutral">Performance</p>
            <h2>Aggiungi numeri</h2>
          </div>
          <Button className="icon-button" onClick={onClose} title="Chiudi">
            <Icon name="close" />
          </Button>
        </div>
        <form
          onSubmit={(event) => {
            event.preventDefault()
            submit()
          }}
        >
          <div className="form-grid">
            <label>
              <span>Giorno</span>
              <input type="date" required max={localIso(new Date())} value={date} onChange={(e) => setDate(e.target.value)} />
            </label>
            <label>
              <span>Agente</span>
              <select disabled={!canViewAll} value={agentId} onChange={(e) => setAgentId(e.target.value)}>
                {canViewAll ? (
                  agents.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.first_name} {a.last_name}
                    </option>
                  ))
                ) : (
                  <option value={user.id}>
                    {user.first_name} {user.last_name}
                  </option>
                )}
              </select>
            </label>
            <div className="stats-zone full">
              <strong>Zona/Network</strong>
              <small>Numeri raccolti fuori da LeadHub. Si sommano ai dati che arrivano da soli dalla Call Mode e dall'Agenda lead.</small>
            </div>
            {labels.map(([key, label]) => (
              <label key={key}>
                <span>{label}</span>
                <input
                  type="number"
                  min={0}
                  max={9999}
                  step={1}
                  inputMode="numeric"
                  required
                  value={values[key]}
                  onChange={(e) => setValues({ ...values, [key]: e.target.value })}
                />
              </label>
            ))}
            {auto && (
              <div className="stats-auto full">
                <strong>Già raccolti in automatico</strong>
                <span>
                  {auto.chiamate ?? 0} chiamate · {auto.contatti ?? 0} contatti · {auto.fissati ?? 0} fissati · {auto.con_trattativa ?? 0} con trattativa ·{" "}
                  {auto.senza_trattativa ?? 0} senza trattativa · {auto.chiusi ?? 0} contratti conclusi · {auto.pacchi ?? 0} pacchi
                </span>
              </div>
            )}
          </div>
          {error && (
            <p className="form-error modal-error" role="alert">
              {error}
            </p>
          )}
          <div className="modal-actions">
            <Button className="secondary-button" onClick={onClose}>
              Annulla
            </Button>
            <Button className="primary-button" type="submit">
              {busy ? "Attendi…" : "Salva numeri"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}

const lightLabel: Record<Light, string> = { green: "In linea", yellow: "Sotto la media", red: "Molto sotto" }

function CoachingPanel() {
  const [data, setData] = useState<CoachingData | null>(null)
  const [error, setError] = useState("")

  useEffect(() => {
    fetchCoaching()
      .then(setData)
      .catch((err) => setError(err instanceof Error ? err.message : "Errore imprevisto"))
  }, [])

  if (error) return <p className="form-error">{error}</p>
  if (!data) return <p className="muted">Caricamento coaching…</p>

  return (
    <section className="panel standalone-panel">
      <div className="panel-heading">
        <div>
          <p className="panel-kicker neutral">Coaching agenti · ultime 4 settimane</p>
          <h2>Chi formare e su cosa</h2>
        </div>
        <span className="task-count">
          Conversione team: {data.team_conversion === null ? "—" : `${data.team_conversion}%`}
        </span>
      </div>
      {data.agents.length === 0 && <p className="muted pad">Nessun dato inserito nelle ultime 4 settimane.</p>}
      <div className="coach-grid">
        {data.agents.map((agent) => {
          const maxContacts = Math.max(...agent.weeks.map((w) => w.contatti), 1)
          return (
            <article className="coach-card" key={agent.agent_id}>
              <div className="coach-head">
                <strong>{agent.name}</strong>
                <span>
                  {agent.conversion === null ? "—" : `${agent.conversion}%`}
                  <small> / team {data.team_conversion === null ? "—" : `${data.team_conversion}%`}</small>
                </span>
              </div>
              <div className="light-row">
                {(["contatti", "fissati", "visti", "chiusi"] as const).map((kpi) => (
                  <span className="light-item" key={kpi} title={`${kpi}: ${lightLabel[agent.lights[kpi] as Light]}`}>
                    <i className={`light ${agent.lights[kpi]}`} />
                    {kpi[0].toUpperCase() + kpi.slice(1)} <b>{agent.totals[kpi]}</b>
                  </span>
                ))}
              </div>
              <div className="mini-trend" aria-label="Contatti delle ultime 4 settimane">
                {agent.weeks.map((week, index) => (
                  <div key={index} title={`Contatti ${week.contatti} · chiusi ${week.chiusi}`}>
                    <span style={{ height: `${Math.max((week.contatti / maxContacts) * 100, 6)}%` }} />
                    <small>{week.conversion === null ? "—" : `${week.conversion}%`}</small>
                  </div>
                ))}
              </div>
              {agent.weak_area ? (
                <p className="weak-area">
                  Area da migliorare: <strong>{agent.weak_area}</strong>
                </p>
              ) : (
                <p className="weak-area ok">Nessuna area critica rispetto al team.</p>
              )}
            </article>
          )
        })}
      </div>
    </section>
  )
}

// Classifica giornaliera e settimanale per trainer, manager e amministratore
function LeaderboardPanel() {
  const [period, setPeriod] = useState<"day" | "week">("day")
  const [data, setData] = useState<LeaderboardData | null>(null)
  const [error, setError] = useState("")

  useEffect(() => {
    setData(null)
    setError("")
    fetchLeaderboard(period)
      .then(setData)
      .catch((e) => setError(e instanceof Error ? e.message : "Errore imprevisto"))
  }, [period])

  const medal = (i: number) => ["🥇", "🥈", "🥉"][i] ?? `${i + 1}°`
  const list = (rows: LeaderboardData["by_contracts"], value: (r: LeaderboardData["by_contracts"][number]) => string, sub: (r: LeaderboardData["by_contracts"][number]) => string) =>
    rows.length === 0 ? (
      <p className="muted pad">Ancora nessun dato.</p>
    ) : (
      rows.map((r, i) => (
        <div className={`leader-row ${i < 3 ? "top" : ""}`} key={r.agent_id}>
          <span className="leader-pos">{medal(i)}</span>
          <span className="leader-name">
            <strong>{r.name}</strong>
            <small>{sub(r)}</small>
          </span>
          <b>{value(r)}</b>
        </div>
      ))
    )

  return (
    <section className="panel standalone-panel leaderboard-panel">
      <div className="panel-heading">
        <div>
          <p className="panel-kicker neutral">{period === "day" ? "Oggi" : "Da lunedì a oggi"}</p>
          <h2>Classifica obiettivi</h2>
        </div>
        <div className="filter-row">
          <Button className={`chip ${period === "day" ? "on" : ""}`} onClick={() => setPeriod("day")}>
            Giornaliera
          </Button>
          <Button className={`chip ${period === "week" ? "on" : ""}`} onClick={() => setPeriod("week")}>
            Settimanale
          </Button>
        </div>
      </div>
      {error && <p className="form-error pad">{error}</p>}
      {!data && !error && <p className="muted pad">Caricamento…</p>}
      {data && (
        <div className="leader-grid">
          <div>
            <h3>Più contratti</h3>
            {list(
              data.by_contracts,
              (r) => String(r.chiusi),
              (r) => `${r.visti} incontri`,
            )}
          </div>
          <div>
            <h3>Percentuale di chiusura più alta</h3>
            {list(
              data.by_rate,
              (r) => `${String(r.rate).replace(".", ",")}%`,
              (r) => `${r.chiusi} contratti su ${r.visti} incontri`,
            )}
          </div>
        </div>
      )}
    </section>
  )
}

function PerformancePage({ user }: { user: SessionUser }) {
  const [kind, setKind] = useState<"ieri" | "settimana" | "mese" | "custom">("mese")
  const [customFrom, setCustomFrom] = useState(localIso(new Date()))
  const [customTo, setCustomTo] = useState(localIso(new Date()))
  const [agentId, setAgentId] = useState("")
  const [officeId, setOfficeId] = useState("")
  const [metric, setMetric] = useState<"chiamate" | "contatti" | "fissati" | "visti" | "chiusi" | "con_trattativa" | "senza_trattativa" | "pacchi">("contatti")
  const [data, setData] = useState<StatsData | null>(null)
  const [error, setError] = useState("")
  const [showEntry, setShowEntry] = useState(false)
  const [reload, setReload] = useState(0)

  const { from, to } = (() => {
    const now = new Date()
    if (kind === "ieri") {
      const d = new Date(now)
      d.setDate(d.getDate() - 1)
      return { from: localIso(d), to: localIso(d) }
    }
    if (kind === "settimana") {
      const d = new Date(now)
      d.setDate(d.getDate() - ((d.getDay() + 6) % 7))
      return { from: localIso(d), to: localIso(now) }
    }
    if (kind === "mese") return { from: localIso(new Date(now.getFullYear(), now.getMonth(), 1)), to: localIso(now) }
    return { from: customFrom, to: customTo }
  })()

  useEffect(() => {
    if (from > to) return
    fetchStats({ from, to, agent_id: agentId || undefined, office_id: officeId || undefined })
      .then((result) => {
        setData(result)
        setError("")
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Errore imprevisto"))
  }, [from, to, agentId, officeId, reload])

  const canEnter = user.permissions.includes("stats.enter_own") || user.permissions.includes("stats.view_all") || user.permissions.includes("stats.enter_others")
  const t = data?.totals
  const days = (data?.byDay ?? []).slice(-31)
  const maxValue = Math.max(...days.map((d) => d[metric]), 1)

  return (
    <>
      <section className="panel perf-toolbar">
        <div className="filter-row nomargin">
          {(
            [
              ["ieri", "Ieri"],
              ["settimana", "Questa settimana"],
              ["mese", "Questo mese"],
              ["custom", "Personalizzato"],
            ] as const
          ).map(([value, label]) => (
            <Button key={value} className={`chip ${kind === value ? "on" : ""}`} onClick={() => setKind(value)}>
              {label}
            </Button>
          ))}
        </div>
        {kind === "custom" && (
          <div className="range-inputs">
            <input type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} />
            <span>→</span>
            <input type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)} />
          </div>
        )}
        {data?.can_view_all && (
          <div className="range-inputs">
            <select value={agentId} onChange={(e) => setAgentId(e.target.value)} aria-label="Agente">
              <option value="">Tutti gli agenti</option>
              {data.agents.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.first_name} {a.last_name}
                </option>
              ))}
            </select>
            <select value={officeId} onChange={(e) => setOfficeId(e.target.value)} aria-label="Ufficio">
              <option value="">Tutti gli uffici</option>
              {data.offices.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </select>
          </div>
        )}
        {canEnter && (
          <Button className="primary-button" onClick={() => setShowEntry(true)}>
            <Icon name="plus" size={17} /> Aggiungi numeri
          </Button>
        )}
      </section>
      {from > to && <p className="form-error">La data di inizio deve essere prima della data di fine.</p>}
      {error && <p className="form-error">{error}</p>}
      {!data && !error && <p className="muted">Caricamento performance…</p>}
      {data && t && (
        <>
          {user.permissions.includes("stats.leaderboard") && <LeaderboardPanel />}
          <section className="metrics-grid">
            <MetricCard label="Chiamate" value={String(t.chiamate)} detail="Esiti registrati in Call Mode" icon="phone" tone="blue" />
            <MetricCard label="Contatti" value={String(t.contatti)} detail={`${percent(t.contatti, t.chiamate)} delle chiamate`} icon="users" tone="orange" />
            <MetricCard label="Appuntamenti fissati" value={String(t.fissati)} detail={`${percent(t.fissati, t.contatti)} dei contatti`} icon="calendar" tone="violet" />
            <MetricCard label="Incontri (visti)" value={String(t.visti)} detail={`${percent(t.visti, t.fissati)} dei fissati`} icon="check" tone="green" />
          </section>
          <section className="metrics-grid second">
            <MetricCard label="Contratti conclusi" value={String(t.chiusi)} detail={`${percent(t.chiusi, t.visti)} degli incontri`} icon="trend" tone="green" />
            <MetricCard label="Con trattativa" value={String(t.con_trattativa)} detail="Incontrati, non chiusi" icon="clock" tone="orange" />
            <MetricCard label="Senza trattativa" value={String(t.senza_trattativa)} detail="Incontrati, nessuna offerta" icon="warning" tone="blue" />
            <MetricCard label="Pacchi" value={String(t.pacchi)} detail="Annullati o non visti" icon="bag" tone="violet" />
          </section>
          {data.insights.length > 0 && (
            <section className="panel standalone-panel insights-panel">
              <div className="panel-heading">
                <div>
                  <p className="panel-kicker neutral">Confronto con la media degli altri agenti · serve per la formazione</p>
                  <h2>{data.can_view_all ? "Criticità e formazione" : "Le tue criticità"}</h2>
                </div>
              </div>
              <div className="insights-list">
                {data.insights.map((agent) => (
                  <div className="insight-agent" key={agent.agent_id}>
                    {data.can_view_all && <h3>{agent.name}</h3>}
                    {agent.items.map((item, i) => (
                      <div className={`insight ${item.level}`} key={i}>
                        <i />
                        <div>
                          <strong>{item.title}</strong>
                          <p>{item.text}</p>
                          <small>{item.area}</small>
                        </div>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </section>
          )}
          <section className="panel standalone-panel performance-chart">
            <div className="panel-heading">
              <div>
                <p className="panel-kicker neutral">Giorno per giorno</p>
                <h2>Andamento commerciale</h2>
              </div>
              <div className="filter-row nomargin">
                {(
                  [
                    ["chiamate", "Chiamate"],
                    ["contatti", "Contatti"],
                    ["fissati", "Fissati"],
                    ["visti", "Visti"],
                    ["con_trattativa", "Con trattativa"],
                    ["senza_trattativa", "Senza trattativa"],
                    ["chiusi", "Conclusi"],
                    ["pacchi", "Pacchi"],
                  ] as const
                ).map(([key, label]) => (
                  <Button key={key} className={`chip ${metric === key ? "on" : ""}`} onClick={() => setMetric(key)}>
                    {label}
                  </Button>
                ))}
              </div>
            </div>
            {days.length === 0 ? (
              <p className="muted pad">Nessun dato inserito in questo periodo.</p>
            ) : (
              <div className="bar-chart">
                {days.map((day) => (
                  <div key={day.date} title={`${day.date}: ${day[metric]}`}>
                    <b className="bar-value">{day[metric]}</b>
                    <span style={{ height: `${(day[metric] / maxValue) * 100}%` }} />
                    <small>{day.date.slice(8, 10)}/{day.date.slice(5, 7)}</small>
                  </div>
                ))}
              </div>
            )}
          </section>
          <section className="panel standalone-panel">
            <div className="panel-heading">
              <div>
                <p className="panel-kicker neutral">Dettaglio</p>
                <h2>{data.can_view_all ? "Per agente" : "I tuoi numeri"}</h2>
              </div>
            </div>
            <div className="stats-scroll">
              <div className="stats-table">
                <div className="stats-row head">
                  <span>Agente</span>
                  <span>Chiamate</span>
                  <span>Contatti</span>
                  <span>Fissati</span>
                  <span>Visti</span>
                  <span>Con tratt.</span>
                  <span>Senza tratt.</span>
                  <span>Conclusi</span>
                  <span>Pacchi</span>
                  <span>Chiusi/visti</span>
                </div>
                {data.byAgent.map((row) => (
                  <div className="stats-row" key={row.agent_id}>
                    <strong>
                      {row.first_name} {row.last_name}
                    </strong>
                    <span>{row.chiamate}</span>
                    <span>{row.contatti}</span>
                    <span>{row.fissati}</span>
                    <span>{row.visti}</span>
                    <span>{row.con_trattativa}</span>
                    <span>{row.senza_trattativa}</span>
                    <span>{row.chiusi}</span>
                    <span>{row.pacchi}</span>
                    <span>{percent(row.chiusi, row.visti)}</span>
                  </div>
                ))}
                {data.byAgent.length === 0 && <p className="muted pad">Nessun dato in questo periodo.</p>}
              </div>
            </div>
          </section>
        </>
      )}
      {user.permissions.includes("stats.coaching") && <CoachingPanel />}
      {showEntry && (
        <StatsModal
          agents={data?.can_view_all ? (data?.agents ?? []) : (data?.entry_agents ?? [])}
          canViewAll={Boolean(data?.can_view_all || data?.can_enter_others)}
          user={user}
          onClose={() => setShowEntry(false)}
          onSaved={() => {
            setShowEntry(false)
            setReload((v) => v + 1)
          }}
        />
      )}
    </>
  )
}

function CtePanel({ ctes }: { ctes: DashboardCte[] }) {
  const groups = ctes.reduce<Record<string, DashboardCte[]>>((acc, cte) => {
    ;(acc[cte.product_name] ??= []).push(cte)
    return acc
  }, {})

  return (
    <section className="panel cte-panel">
      <div className="panel-heading">
        <div>
          <p className="panel-kicker neutral">Prodotti</p>
          <h2>CTE · condizioni tecnico-economiche</h2>
        </div>
      </div>
      <div className="cte-groups">
        {Object.entries(groups).map(([product, items]) => (
          <div className="cte-group" key={product}>
            <h3>{product}</h3>
            <div className="cte-cards">
              {items.map((cte) => (
                <article className="cte-card" key={cte.id}>
                  <strong>{cte.title}</strong>
                  <dl>
                    {cteCosts(cte).map((c) => (
                      <div key={c.label}>
                        <dt>{c.label}</dt>
                        <dd>{c.value}</dd>
                      </div>
                    ))}
                  </dl>
                  {cte.notes && <p>{cte.notes}</p>}
                </article>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}

function DashboardPage({
  range,
  user,
  onNavigate,
}: {
  range: string
  user: SessionUser
  onNavigate: (label: string) => void
}) {
  const [data, setData] = useState<DashboardData | null>(null)
  const [error, setError] = useState("")
  const key = range === "Questa settimana" ? "week" : range === "Questo trimestre" ? "quarter" : "month"

  useEffect(() => {
    fetchDashboard(key)
      .then((result) => {
        setData(result)
        setError("")
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Errore imprevisto"))
  }, [key])

  if (error && !data) return <p className="form-error">{error}</p>
  if (!data) return <p className="muted">Caricamento dashboard…</p>

  const canTasks = user.permissions.some((p) => p.startsWith("tasks."))
  const team = data.coaching

  return (
    <>
      <section className="metrics-grid" aria-label="Riepilogo">
        <MetricCard
          label="Clienti"
          value={String(data.customers.total)}
          detail={`+${data.customers.recent} nel periodo`}
          icon="users"
          tone="orange"
        />
        {canTasks && (
          <MetricCard
            label="KO da recuperare"
            value={String(data.tasks.ko_open)}
            detail={`${data.tasks.ko_recovered} recuperati nel periodo`}
            icon="warning"
            tone="blue"
          />
        )}
        <MetricCard
          label="Tasso di chiusura"
          value={data.closing_rate === null ? "—" : `${data.closing_rate}%`}
          detail={`${data.stats.chiusi} chiusi su ${data.stats.visti} visti`}
          icon="trend"
          tone="green"
        />
        {canTasks && (
          <MetricCard
            label="Task della segreteria"
            value={String(data.tasks.manual_open)}
            detail={`${data.tasks.overdue} scadute`}
            icon="clock"
            tone="violet"
          />
        )}
      </section>

      {data.avg_appointments && (
        <section className="metrics-grid single">
          <MetricCard
            label="Media appuntamenti oggi"
            value={String(data.avg_appointments.avg).replace(".", ",")}
            detail={`${data.avg_appointments.total} fissati da ${data.avg_appointments.agents} agenti che hanno chiamato`}
            icon="calendar"
            tone="orange"
          />
        </section>
      )}

      <section className="dashboard-grid">
        <article className="panel attention-panel">
          <div className="panel-heading">
            <div>
              <p className="panel-kicker">
                <Icon name="warning" size={15} /> Richiede attenzione
              </p>
              <h2>Da controllare oggi</h2>
            </div>
            <span className="task-count">{data.attention.length} attività</span>
          </div>
          <div className="attention-list">
            {data.attention.map((item) => (
              <div className="attention-item" key={item.key}>
                <div className={`attention-icon ${item.tone}`}>
                  <Icon name={(item.icon as IconName) in iconPaths ? (item.icon as IconName) : "warning"} />
                </div>
                <div className="attention-copy">
                  <strong>{item.title}</strong>
                  <span>{item.detail}</span>
                </div>
                <Button className="text-button" onClick={() => onNavigate(item.target)}>
                  Apri <Icon name="arrow" size={15} />
                </Button>
              </div>
            ))}
            {data.attention.length === 0 && (
              <div className="empty-state">
                <span>
                  <Icon name="check" />
                </span>
                <strong>Tutto sotto controllo</strong>
                <p>Non ci sono attività urgenti.</p>
              </div>
            )}
          </div>
        </article>

        {team && (
          <article className="panel coaching-panel">
            <div className="panel-heading">
              <div>
                <p className="panel-kicker neutral">Coaching agenti · 4 settimane</p>
                <h2>Conversione del team</h2>
              </div>
              <Button className="more-button" onClick={() => onNavigate("Performance")}>
                Vedi report <Icon name="arrow" size={15} />
              </Button>
            </div>
            <div className="agents">
              {team.agents.length === 0 && <p className="muted pad">Ancora nessun dato di performance.</p>}
              {team.agents.map((agent, index) => {
                const target = team.team_conversion ?? 0
                const value = agent.conversion ?? 0
                const colors = ["orange", "purple", "green", "blue"]
                return (
                  <div className="agent-row" key={agent.agent_id}>
                    <div className={`avatar avatar-${colors[index % colors.length]}`}>
                      {agent.name.slice(0, 2).toUpperCase()}
                    </div>
                    <div className="agent-info">
                      <div className="agent-top">
                        <strong>{agent.name}</strong>
                        <span>
                          {agent.conversion === null ? "—" : `${value}%`} <small>/ {target}%</small>
                        </span>
                      </div>
                      <div className="progress">
                        <span
                          className={colors[index % colors.length]}
                          style={{ width: `${target > 0 ? Math.min((value / target) * 100, 100) : 0}%` }}
                        />
                      </div>
                      <div className="agent-bottom">
                        <span>{agent.weak_area ? `Da migliorare: ${agent.weak_area}` : "In linea con il team"}</span>
                        <span>Media team {target}%</span>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </article>
        )}
      </section>

      {data.ctes.length > 0 && <CtePanel ctes={data.ctes} />}

      {canTasks && (
        <section className="panel contracts-panel">
          <div className="panel-heading">
            <div>
              <p className="panel-kicker neutral">Attività recente</p>
              <h2>Ultime task della segreteria</h2>
            </div>
            <Button className="more-button" onClick={() => onNavigate("Segreteria")}>
              Vedi tutte <Icon name="arrow" size={15} />
            </Button>
          </div>
          <div className="table">
            <div className="table-head">
              <span>Cliente</span>
              <span>Task</span>
              <span>Agente</span>
              <span>Stato</span>
              <span>Aggiornata</span>
              <span />
            </div>
            {data.recent.length === 0 && <p className="muted pad">Nessuna task ancora.</p>}
            {data.recent.map((row) => (
              <div className="table-row clickable" key={row.id} onClick={() => onNavigate("Segreteria")}>
                <div className="client-cell">
                  <span className="mini-avatar">{initialsOf(row.customer_first_name, row.customer_last_name)}</span>
                  <strong>
                    {row.customer_first_name} {row.customer_last_name}
                  </strong>
                </div>
                <span>{row.kind === "ko" ? "KO da recuperare" : row.title}</span>
                <span>
                  {row.agent_first_name} {row.agent_last_name}
                </span>
                <span>
                  <TaskStatusBadge status={row.status} kind={row.kind} />
                </span>
                <span className="muted">{formatDate(row.updated_at)}</span>
                <Button className="row-button" title="Apri Segreteria">
                  <Icon name="chevron" size={17} />
                </Button>
              </div>
            ))}
          </div>
        </section>
      )}
    </>
  )
}

const WEEKDAYS = ["Lun", "Mar", "Mer", "Gio", "Ven", "Sab", "Dom"]

const timeOf = (iso: string) =>
  new Date(iso).toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" })

function EventModal({
  event,
  date,
  data,
  user,
  onClose,
  onSaved,
}: {
  event: CalendarEvent | null
  date: string
  data: CalendarData
  user: SessionUser
  onClose: () => void
  onSaved: () => void
}) {
  const isNew = event === null
  const [customers, setCustomers] = useState<CustomerRow[]>([])
  const [form, setForm] = useState({
    title: event?.title ?? "",
    date: event ? localIso(new Date(event.starts_at)) : date,
    start: event ? timeOf(event.starts_at) : "09:00",
    end: event?.ends_at ? timeOf(event.ends_at) : "",
    customer_id: event?.customer_id ?? "",
    agent_id: event?.agent_id ?? user.id,
    manager_id: event?.manager_id ?? "",
    notes: event?.notes ?? "",
  })
  const [error, setError] = useState("")
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    fetchCustomers()
      .then(setCustomers)
      .catch(() => {})
  }, [])

  const submit = async () => {
    setError("")
    setBusy(true)
    const input = {
      title: form.title,
      starts_at: new Date(`${form.date}T${form.start}`).toISOString(),
      ends_at: form.end ? new Date(`${form.date}T${form.end}`).toISOString() : "",
      notes: form.notes,
      customer_id: form.customer_id,
      agent_id: form.agent_id,
      manager_id: form.manager_id,
    }
    try {
      if (isNew) await createCalendarEvent(input)
      else await updateCalendarEvent(event!.id, input)
      onSaved()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Errore imprevisto")
      setBusy(false)
    }
  }

  return (
    <div className="modal-layer" role="presentation" onMouseDown={onClose}>
      <div className="modal wide" role="dialog" aria-modal="true" onMouseDown={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div>
            <p className="panel-kicker neutral">Calendario</p>
            <h2>{isNew ? "Nuovo appuntamento" : "Modifica appuntamento"}</h2>
          </div>
          <Button className="icon-button" onClick={onClose} title="Chiudi">
            <Icon name="close" />
          </Button>
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            submit()
          }}
        >
          <div className="form-grid">
            <label className="full">
              <span>Titolo</span>
              <input
                required
                maxLength={120}
                placeholder="Es. Appuntamento luce/gas"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
              />
            </label>
            <label>
              <span>Data</span>
              <input required type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
            </label>
            <label>
              <span>Ora inizio</span>
              <input required type="time" value={form.start} onChange={(e) => setForm({ ...form, start: e.target.value })} />
            </label>
            <label>
              <span>Ora fine (facoltativa)</span>
              <input type="time" value={form.end} onChange={(e) => setForm({ ...form, end: e.target.value })} />
            </label>
            <label>
              <span>Cliente</span>
              <select value={form.customer_id} onChange={(e) => setForm({ ...form, customer_id: e.target.value })}>
                <option value="">— Nessun cliente —</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.first_name} {c.last_name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>Agente</span>
              <select
                disabled={!data.can_view_all}
                value={form.agent_id}
                onChange={(e) => setForm({ ...form, agent_id: e.target.value })}
              >
                {(data.can_view_all
                  ? data.people
                  : [{ id: user.id, first_name: user.first_name, last_name: user.last_name }]
                ).map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.first_name} {p.last_name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>Responsabile</span>
              <select value={form.manager_id} onChange={(e) => setForm({ ...form, manager_id: e.target.value })}>
                <option value="">— Nessuno —</option>
                {data.people.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.first_name} {p.last_name}
                  </option>
                ))}
              </select>
            </label>
            <label className="full">
              <span>Note</span>
              <textarea rows={2} maxLength={1000} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </label>
          </div>
          {error && (
            <p className="form-error modal-error" role="alert">
              {error}
            </p>
          )}
          <div className="modal-actions">
            <Button className="secondary-button" onClick={onClose}>
              Annulla
            </Button>
            <Button className="primary-button" type="submit">
              {busy ? "Attendi…" : isNew ? "Crea appuntamento" : "Salva modifiche"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}

function CalendarPage({
  user,
  onOpenCustomer,
}: {
  user: SessionUser
  onOpenCustomer: (id: string) => void
}) {
  const today = localIso(new Date())
  const [month, setMonth] = useState(() => {
    const d = new Date()
    return new Date(d.getFullYear(), d.getMonth(), 1)
  })
  const [selected, setSelected] = useState(today)
  const [agentId, setAgentId] = useState("")
  const [data, setData] = useState<CalendarData | null>(null)
  const [error, setError] = useState("")
  const [modal, setModal] = useState<CalendarEvent | "new" | null>(null)
  const [reload, setReload] = useState(0)

  // 6 settimane complete, a partire dal lunedi' che precede il primo del mese
  const gridStart = new Date(month)
  gridStart.setDate(1 - ((month.getDay() + 6) % 7))
  const cells = Array.from({ length: 42 }, (_, i) => {
    const d = new Date(gridStart)
    d.setDate(gridStart.getDate() + i)
    return d
  })
  const gridEnd = new Date(gridStart)
  gridEnd.setDate(gridStart.getDate() + 42)

  useEffect(() => {
    fetchCalendar(gridStart.toISOString(), gridEnd.toISOString(), agentId || undefined)
      .then((result) => {
        setData(result)
        setError("")
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Errore imprevisto"))
  }, [month, agentId, reload])

  const byDay = new Map<string, CalendarEvent[]>()
  for (const event of data?.events ?? []) {
    const key = localIso(new Date(event.starts_at))
    byDay.set(key, [...(byDay.get(key) ?? []), event])
  }
  const dayEvents = byDay.get(selected) ?? []
  const monthLabel = month.toLocaleDateString("it-IT", { month: "long", year: "numeric" })
  const selectedLabel = new Date(`${selected}T12:00:00`).toLocaleDateString("it-IT", {
    weekday: "long",
    day: "numeric",
    month: "long",
  })

  const remove = async (event: CalendarEvent) => {
    if (!window.confirm(`Eliminare l'appuntamento "${event.title}"?`)) return
    try {
      await deleteCalendarEvent(event.id)
      setReload((v) => v + 1)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Errore imprevisto")
    }
  }

  return (
    <>
      {error && <p className="form-error">{error}</p>}
      {data?.can_view_all && (
        <div className="agents-toolbar">
          <select className="inline-select" value={agentId} onChange={(e) => setAgentId(e.target.value)} aria-label="Agente">
            <option value="">Tutti i calendari</option>
            {data.people.map((p) => (
              <option key={p.id} value={p.id}>
                {p.first_name} {p.last_name}
              </option>
            ))}
          </select>
        </div>
      )}
      <section className="calendar-layout">
        <article className="panel calendar-month">
          <div className="calendar-title">
            <Button className="icon-button" title="Mese precedente" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}>
              <Icon name="chevron" />
            </Button>
            <h2>{monthLabel}</h2>
            <Button className="icon-button next" title="Mese successivo" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}>
              <Icon name="chevron" />
            </Button>
          </div>
          <div className="calendar-grid">
            {WEEKDAYS.map((day) => (
              <strong key={day}>{day}</strong>
            ))}
            {cells.map((d) => {
              const key = localIso(d)
              const count = byDay.get(key)?.length ?? 0
              const outside = d.getMonth() !== month.getMonth()
              return (
                <span
                  key={key}
                  role="button"
                  tabIndex={0}
                  className={`cal-day ${outside ? "outside" : ""} ${key === today ? "today" : ""} ${key === selected ? "selected-day" : ""}`}
                  onClick={() => setSelected(key)}
                  onKeyDown={(e) => e.key === "Enter" && setSelected(key)}
                >
                  {d.getDate()}
                  {count > 0 && (
                    <em className="cal-dots">
                      {Array.from({ length: Math.min(count, 3) }, (_, i) => (
                        <i key={i} />
                      ))}
                    </em>
                  )}
                </span>
              )
            })}
          </div>
        </article>
        <article className="panel agenda">
          <div className="panel-heading">
            <div>
              <p className="panel-kicker neutral">{selectedLabel}</p>
              <h2>Agenda del giorno</h2>
            </div>
            <Button className="primary-button" onClick={() => setModal("new")}>
              <Icon name="plus" size={16} /> Nuovo
            </Button>
          </div>
          {!data && !error && <p className="muted pad">Caricamento…</p>}
          {data && dayEvents.length === 0 && <p className="muted pad">Nessun appuntamento in questo giorno.</p>}
          {dayEvents.map((event, index) => {
            const canEdit = Boolean(data?.can_view_all) || event.agent_id === user.id
            return (
              <div className="agenda-item" key={event.id}>
                <span className={`agenda-dot tone-${index % 3}`} />
                <div>
                  <strong>
                    {timeOf(event.starts_at)}
                    {event.ends_at ? `–${timeOf(event.ends_at)}` : ""} · {event.title}
                  </strong>
                  <small>
                    {event.customer_id && (
                      <button className="link-button" onClick={() => onOpenCustomer(event.customer_id!)}>
                        {event.customer_first_name} {event.customer_last_name}
                      </button>
                    )}
                    {event.customer_id ? " · " : ""}
                    {data?.can_view_all ? `Agente: ${event.agent_name}` : ""}
                    {event.manager_name ? ` · Resp.: ${event.manager_name}` : ""}
                  </small>
                  {event.notes && <small>{event.notes}</small>}
                  {canEdit && (
                    <span className="agenda-actions">
                      <button className="link-button" onClick={() => setModal(event)}>
                        Modifica
                      </button>
                      <button className="link-button danger" onClick={() => remove(event)}>
                        Elimina
                      </button>
                    </span>
                  )}
                </div>
              </div>
            )
          })}
        </article>
      </section>
      {modal && data && (
        <EventModal
          key={modal === "new" ? "new" : modal.id}
          event={modal === "new" ? null : modal}
          date={selected}
          data={data}
          user={user}
          onClose={() => setModal(null)}
          onSaved={() => {
            setModal(null)
            setReload((v) => v + 1)
          }}
        />
      )}
    </>
  )
}

/* ---------- Mappa (Leaflet + raggruppamento automatico dei pin) ---------- */

const LEAFLET_JS = "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js"
const LEAFLET_CSS = "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css"
const CLUSTER_JS = "https://cdnjs.cloudflare.com/ajax/libs/leaflet.markercluster/1.5.3/leaflet.markercluster.js"
const CLUSTER_CSS = "https://cdnjs.cloudflare.com/ajax/libs/leaflet.markercluster/1.5.3/MarkerCluster.css"

let leafletPromise: Promise<any> | null = null

function loadLeaflet(): Promise<any> {
  if (leafletPromise) return leafletPromise
  const addCss = (href: string) => {
    const link = document.createElement("link")
    link.rel = "stylesheet"
    link.href = href
    document.head.appendChild(link)
  }
  const addScript = (src: string) =>
    new Promise<void>((resolve, reject) => {
      const script = document.createElement("script")
      script.src = src
      script.onload = () => resolve()
      script.onerror = () => reject(new Error("Impossibile caricare la mappa"))
      document.head.appendChild(script)
    })
  addCss(LEAFLET_CSS)
  addCss(CLUSTER_CSS)
  leafletPromise = addScript(LEAFLET_JS)
    .then(() => addScript(CLUSTER_JS))
    .then(() => (window as any).L)
    .catch((error) => {
      leafletPromise = null
      throw error
    })
  return leafletPromise
}

function MapPage({
  user,
  onOpenCustomer,
}: {
  user: SessionUser
  onOpenCustomer: (id: string) => void
}) {
  const [filters, setFilters] = useState({ agent_id: "", office_id: "", product: "", status: "" })
  const [data, setData] = useState<MapData | null>(null)
  const [error, setError] = useState("")
  const [mapError, setMapError] = useState("")
  const [placing, setPlacing] = useState("")
  const [reload, setReload] = useState(0)
  const [mapReady, setMapReady] = useState(false)
  const container = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<any>(null)
  const layerRef = useRef<any>(null)
  const openRef = useRef(onOpenCustomer)
  openRef.current = onOpenCustomer

  useEffect(() => {
    fetchMap(filters)
      .then((result) => {
        setData(result)
        setError("")
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Errore imprevisto"))
  }, [filters, reload])

  // Crea la mappa una volta sola
  useEffect(() => {
    let cancelled = false
    loadLeaflet()
      .then((L) => {
        if (cancelled || !container.current || mapRef.current) return
        const map = L.map(container.current, { zoomControl: true }).setView([45.19, 9.16], 10)
        L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
          maxZoom: 19,
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        }).addTo(map)
        mapRef.current = map
        setMapReady(true)
      })
      .catch((err) => setMapError(err instanceof Error ? err.message : "Errore mappa"))
    return () => {
      cancelled = true
      if (mapRef.current) {
        mapRef.current.remove()
        mapRef.current = null
      }
    }
  }, [])

  // Disegna / aggiorna i pin quando cambiano i dati
  useEffect(() => {
    const L = (window as any).L
    const map = mapRef.current
    if (!L || !map || !data) return
    if (layerRef.current) map.removeLayer(layerRef.current)

    const group = L.markerClusterGroup({
      maxClusterRadius: 60,
      showCoverageOnHover: false,
      iconCreateFunction: (cluster: any) =>
        L.divIcon({
          html: `<div class="lo-cluster"><b>${cluster.getChildCount()}</b><small>clienti</small></div>`,
          className: "lo-cluster-wrap",
          iconSize: [58, 58],
        }),
    })

    const bounds: [number, number][] = []
    for (const c of data.customers) {
      const initials = `${c.first_name[0] ?? ""}${c.last_name[0] ?? ""}`.toUpperCase()
      const marker = L.marker([c.latitude, c.longitude], {
        title: `${c.first_name} ${c.last_name}`,
        icon: L.divIcon({
          html: `<div class="lo-pin ${c.status.toLowerCase()}">${initials}</div>`,
          className: "lo-pin-wrap",
          iconSize: [36, 36],
        }),
      })

      // Popup costruito con textContent: nessun testo del cliente viene interpretato come HTML
      const box = document.createElement("div")
      box.className = "lo-popup"
      const add = (tag: string, text: string, className?: string) => {
        const el = document.createElement(tag)
        el.textContent = text
        if (className) el.className = className
        box.appendChild(el)
        return el
      }
      add("span", statusLabels[c.status], `lo-state ${c.status.toLowerCase()}`)
      add("h3", `${c.first_name} ${c.last_name}`)
      const place = [c.address, [c.city, c.province && `(${c.province})`].filter(Boolean).join(" ")].filter(Boolean).join(", ")
      if (place) add("p", `📍 ${place}`)
      if (c.phone) add("p", `📞 ${c.phone}`)
      if (c.interests.length) add("p", c.interests.join(" · "), "lo-products")
      if (c.agent_name) add("p", `👤 ${c.agent_name}`)
      const open = add("button", "Apri cliente", "lo-open")
      open.addEventListener("click", () => openRef.current(c.id))
      marker.bindPopup(box)

      group.addLayer(marker)
      bounds.push([c.latitude, c.longitude])
    }
    map.addLayer(group)
    layerRef.current = group
    if (bounds.length > 0) map.fitBounds(bounds, { padding: [40, 40], maxZoom: 15 })
  }, [data, mapReady])

  const placeMissing = async () => {
    setError("")
    try {
      let remaining = data?.pending ?? 0
      let done = 0
      while (remaining > 0) {
        setPlacing(`Posizionamento in corso… (${done} fatti, ${remaining} da fare)`)
        const result = await geocodePending()
        done += result.found + result.failed
        if (result.found + result.failed === 0) break
        remaining = result.remaining
      }
      setPlacing("")
      setReload((v) => v + 1)
    } catch (err) {
      setPlacing("")
      setError(err instanceof Error ? err.message : "Errore imprevisto")
    }
  }

  const set = (key: keyof typeof filters, value: string) => setFilters((current) => ({ ...current, [key]: value }))

  return (
    <section className="panel map-panel">
      <div className="map-filters real">
        <strong>{data ? `${data.customers.length} clienti sulla mappa` : "Caricamento…"}</strong>
        <div className="map-filter-controls">
          {data?.can_view_all && (
            <>
              <select value={filters.agent_id} onChange={(e) => set("agent_id", e.target.value)} aria-label="Agente">
                <option value="">Tutti gli agenti</option>
                {data.agents.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.first_name} {a.last_name}
                  </option>
                ))}
              </select>
              <select value={filters.office_id} onChange={(e) => set("office_id", e.target.value)} aria-label="Ufficio">
                <option value="">Tutti gli uffici</option>
                {data.offices.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name}
                  </option>
                ))}
              </select>
            </>
          )}
          <select value={filters.product} onChange={(e) => set("product", e.target.value)} aria-label="Prodotto">
            <option value="">Tutti i prodotti</option>
            {(data?.products ?? []).map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
          <select value={filters.status} onChange={(e) => set("status", e.target.value)} aria-label="Stato">
            <option value="">Stato: tutti</option>
            <option value="OK">OK</option>
            <option value="NR">NR</option>
            <option value="KO">KO</option>
          </select>
        </div>
      </div>
      {error && <p className="form-error modal-error">{error}</p>}
      {mapError && <p className="form-error modal-error">{mapError}. Controlla la connessione e ricarica la pagina.</p>}
      {data && (data.pending > 0 || data.unplaced > 0) && (
        <div className="map-notice">
          {data.pending > 0 && (
            <span>
              {data.pending} clienti con indirizzo non ancora posizionati.{" "}
              {data.can_view_all && (
                <button className="link-button" onClick={placeMissing}>
                  Posizionali ora
                </button>
              )}
            </span>
          )}
          {data.unplaced > 0 && (
            <span>{data.unplaced} clienti senza indirizzo valido (non compaiono sulla mappa).</span>
          )}
          {placing && <strong>{placing}</strong>}
        </div>
      )}
      <div className="real-map" ref={container} aria-label="Mappa clienti" />
      {data && data.customers.length === 0 && !error && (
        <p className="muted pad">Nessun cliente con una posizione per questi filtri.</p>
      )}
    </section>
  )
}

function ProfileModal({ user, onClose }: { user: SessionUser; onClose: () => void }) {
  const [current, setCurrent] = useState("")
  const [next, setNext] = useState("")
  const [repeat, setRepeat] = useState("")
  const [error, setError] = useState("")
  const [done, setDone] = useState(false)
  const [busy, setBusy] = useState(false)

  const submit = async () => {
    setError("")
    setDone(false)
    if (next !== repeat) {
      setError("Le due nuove password non coincidono")
      return
    }
    setBusy(true)
    try {
      await changePassword(current, next)
      setCurrent("")
      setNext("")
      setRepeat("")
      setDone(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Errore imprevisto")
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="modal-layer" role="presentation" onMouseDown={onClose}>
      <div className="modal" role="dialog" aria-modal="true" onMouseDown={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div>
            <p className="panel-kicker neutral">Il mio profilo</p>
            <h2>
              {user.first_name} {user.last_name}
            </h2>
          </div>
          <Button className="icon-button" onClick={onClose} title="Chiudi">
            <Icon name="close" />
          </Button>
        </div>
        <dl className="profile-dl">
          <div>
            <dt>Email</dt>
            <dd>{user.email}</dd>
          </div>
          <div>
            <dt>Ruolo</dt>
            <dd>{roleLabels[user.role] ?? user.role}</dd>
          </div>
        </dl>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            submit()
          }}
        >
          <p className="profile-section">Cambia password</p>
          <div className="form-grid">
            <label className="full">
              <span>Password attuale</span>
              <input required type="password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} />
            </label>
            <label>
              <span>Nuova password (min. 10 caratteri)</span>
              <input required minLength={10} type="password" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} />
            </label>
            <label>
              <span>Ripeti la nuova password</span>
              <input required minLength={10} type="password" autoComplete="new-password" value={repeat} onChange={(e) => setRepeat(e.target.value)} />
            </label>
          </div>
          {done && <p className="form-ok">Password cambiata. Le sessioni aperte sugli altri dispositivi sono state chiuse.</p>}
          {error && (
            <p className="form-error modal-error" role="alert">
              {error}
            </p>
          )}
          <div className="modal-actions">
            <Button className="secondary-button" onClick={onClose}>
              Chiudi
            </Button>
            <Button className="primary-button" type="submit">
              {busy ? "Attendi…" : "Cambia password"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}

const euro = (value: number, decimals: number) =>
  value.toLocaleString("it-IT", { minimumFractionDigits: decimals, maximumFractionDigits: decimals })

// Elenco dei costi valorizzati di una CTE, nell'ordine: costo, fisso, kWh, Smc
function cteCosts(cte: { cost: number | null; fixed_cost: number | null; kwh_cost: number | null; smc_cost: number | null }) {
  const items: { label: string; value: string }[] = []
  if (cte.cost !== null) items.push({ label: "Costo", value: `${euro(cte.cost, 2)} €` })
  if (cte.fixed_cost !== null) items.push({ label: "Costo fisso", value: `${euro(cte.fixed_cost, 2)} €` })
  if (cte.kwh_cost !== null) items.push({ label: "Costo al kWh", value: `${euro(cte.kwh_cost, 6)} €/kWh` })
  if (cte.smc_cost !== null) items.push({ label: "Costo allo Smc", value: `${euro(cte.smc_cost, 6)} €/Smc` })
  return items
}

const emptyCteForm = (cte?: CteRow) => ({
  title: cte?.title ?? "",
  cost: cte?.cost?.toString().replace(".", ",") ?? "",
  fixed_cost: cte?.fixed_cost?.toString().replace(".", ",") ?? "",
  kwh_cost: cte?.kwh_cost?.toString().replace(".", ",") ?? "",
  smc_cost: cte?.smc_cost?.toString().replace(".", ",") ?? "",
  notes: cte?.notes ?? "",
  sort_order: String(cte?.sort_order ?? 0),
  is_active: cte?.is_active ?? true,
})

function CteModal({ product, onClose, onChanged }: { product: ProductRow; onClose: () => void; onChanged: () => void }) {
  const [editing, setEditing] = useState<CteRow | "new" | null>(null)
  const [form, setForm] = useState(emptyCteForm())
  const [error, setError] = useState("")
  const [busy, setBusy] = useState(false)

  const open = (target: CteRow | "new") => {
    setEditing(target)
    setForm(emptyCteForm(target === "new" ? undefined : target))
    setError("")
  }

  const submit = async () => {
    if (!editing) return
    setError("")
    setBusy(true)
    try {
      const input = { ...form, sort_order: Number(form.sort_order) || 0 }
      await saveCte(input, editing === "new" ? { productId: product.id } : { id: editing.id })
      setEditing(null)
      onChanged()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Errore imprevisto")
    } finally {
      setBusy(false)
    }
  }

  const remove = async (cte: CteRow) => {
    if (!window.confirm(`Eliminare la CTE «${cte.title}»?`)) return
    setError("")
    try {
      await deleteCte(cte.id)
      onChanged()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Errore imprevisto")
    }
  }

  const set = (key: keyof typeof form, value: string) => setForm((current) => ({ ...current, [key]: value }))

  return (
    <div className="modal-layer" role="presentation" onMouseDown={onClose}>
      <div className="modal wide" role="dialog" aria-modal="true" onMouseDown={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div>
            <p className="panel-kicker neutral">CTE · {product.name}</p>
            <h2>Condizioni tecnico-economiche</h2>
          </div>
          <Button className="icon-button" onClick={onClose} title="Chiudi">
            <Icon name="close" />
          </Button>
        </div>

        {editing ? (
          <form
            onSubmit={(e) => {
              e.preventDefault()
              submit()
            }}
          >
            <div className="form-grid">
              <label className="full">
                <span>Titolo</span>
                <input required maxLength={80} placeholder="Es. Offerta Luce Fissa 12 mesi" value={form.title} onChange={(e) => set("title", e.target.value)} />
              </label>
              <label>
                <span>Costo (€)</span>
                <input inputMode="decimal" placeholder="0,00" value={form.cost} onChange={(e) => set("cost", e.target.value)} />
              </label>
              <label>
                <span>Costo fisso (€)</span>
                <input inputMode="decimal" placeholder="0,00" value={form.fixed_cost} onChange={(e) => set("fixed_cost", e.target.value)} />
              </label>
              <label>
                <span>Costo al kWh (€/kWh)</span>
                <input inputMode="decimal" placeholder="0,123456" value={form.kwh_cost} onChange={(e) => set("kwh_cost", e.target.value)} />
              </label>
              <label>
                <span>Costo allo Smc (€/Smc)</span>
                <input inputMode="decimal" placeholder="0,123456" value={form.smc_cost} onChange={(e) => set("smc_cost", e.target.value)} />
              </label>
              <label className="full">
                <span>Note</span>
                <textarea rows={3} maxLength={1000} value={form.notes} onChange={(e) => set("notes", e.target.value)} />
              </label>
              <label>
                <span>Ordine nell'elenco</span>
                <input type="number" min={0} max={999} value={form.sort_order} onChange={(e) => set("sort_order", e.target.value)} />
              </label>
              <label className="check-field">
                <input type="checkbox" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} />
                <span>Visibile in dashboard</span>
              </label>
            </div>
            {error && (
              <p className="form-error modal-error" role="alert">
                {error}
              </p>
            )}
            <div className="modal-actions">
              <Button className="secondary-button" onClick={() => setEditing(null)}>
                Indietro
              </Button>
              <Button className="primary-button" type="submit">
                {busy ? "Attendi…" : "Salva CTE"}
              </Button>
            </div>
          </form>
        ) : (
          <>
            <div className="cte-list">
              {product.ctes.length === 0 && <p className="muted pad">Nessuna CTE per questo prodotto.</p>}
              {product.ctes.map((cte) => (
                <div className="cte-item" key={cte.id}>
                  <div className="cte-item-main">
                    <strong>
                      {cte.title}
                      {!cte.is_active && <span className="status ko"><i /> Nascosta</span>}
                    </strong>
                    <small>
                      {cteCosts(cte).map((c) => `${c.label}: ${c.value}`).join(" · ") || "Nessun costo indicato"}
                    </small>
                    {cte.notes && <small>{cte.notes}</small>}
                  </div>
                  <div className="cte-item-actions">
                    <Button className="secondary-button" onClick={() => open(cte)}>
                      Modifica
                    </Button>
                    <Button className="secondary-button danger-outline" onClick={() => remove(cte)}>
                      Elimina
                    </Button>
                  </div>
                </div>
              ))}
            </div>
            {error && (
              <p className="form-error modal-error" role="alert">
                {error}
              </p>
            )}
            <div className="modal-actions">
              <Button className="secondary-button" onClick={onClose}>
                Chiudi
              </Button>
              <Button className="primary-button" onClick={() => open("new")}>
                <Icon name="plus" size={18} /> Nuova CTE
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function ProductModal({
  product,
  onClose,
  onSaved,
}: {
  product: ProductRow | null
  onClose: () => void
  onSaved: () => void
}) {
  const [form, setForm] = useState({
    name: product?.name ?? "",
    category: product?.category ?? "",
    description: product?.description ?? "",
    sort_order: String(product?.sort_order ?? 0),
    is_active: product?.is_active ?? true,
  })
  const [error, setError] = useState("")
  const [busy, setBusy] = useState(false)

  const submit = async () => {
    setError("")
    setBusy(true)
    try {
      await saveProduct({ ...form, sort_order: Number(form.sort_order) || 0 }, product?.id)
      onSaved()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Errore imprevisto")
      setBusy(false)
    }
  }

  return (
    <div className="modal-layer" role="presentation" onMouseDown={onClose}>
      <div className="modal" role="dialog" aria-modal="true" onMouseDown={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div>
            <p className="panel-kicker neutral">Prodotti</p>
            <h2>{product ? "Modifica prodotto" : "Nuovo prodotto"}</h2>
          </div>
          <Button className="icon-button" onClick={onClose} title="Chiudi">
            <Icon name="close" />
          </Button>
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            submit()
          }}
        >
          <div className="form-grid">
            <label>
              <span>Nome</span>
              <input required maxLength={60} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </label>
            <label>
              <span>Categoria</span>
              <input maxLength={40} placeholder="Es. Energia" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} />
            </label>
            <label className="full">
              <span>Descrizione</span>
              <textarea rows={2} maxLength={300} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </label>
            <label>
              <span>Ordine nell'elenco</span>
              <input type="number" min={0} max={999} value={form.sort_order} onChange={(e) => setForm({ ...form, sort_order: e.target.value })} />
            </label>
            <label className="check-field">
              <input type="checkbox" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} />
              <span>Attivo (selezionabile nei clienti)</span>
            </label>
          </div>
          {error && (
            <p className="form-error modal-error" role="alert">
              {error}
            </p>
          )}
          <div className="modal-actions">
            <Button className="secondary-button" onClick={onClose}>
              Annulla
            </Button>
            <Button className="primary-button" type="submit">
              {busy ? "Attendi…" : "Salva"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}

function ProductsPage() {
  const [rows, setRows] = useState<ProductRow[] | null>(null)
  const [error, setError] = useState("")
  const [editing, setEditing] = useState<ProductRow | "new" | null>(null)
  const [cteFor, setCteFor] = useState<string | null>(null)

  const load = () =>
    fetchProducts()
      .then((result) => {
        setRows(result)
        setError("")
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Errore imprevisto"))

  useEffect(() => {
    load()
  }, [])

  if (error && !rows) return <p className="form-error">{error}</p>
  if (!rows) return <p className="muted">Caricamento prodotti…</p>

  return (
    <>
      <div className="agents-toolbar">
        <p className="muted">
          {rows.filter((r) => r.is_active).length} prodotti attivi su {rows.length}. I prodotti non si cancellano: si disattivano.
        </p>
        <Button className="primary-button" onClick={() => setEditing("new")}>
          <Icon name="plus" size={18} /> Nuovo prodotto
        </Button>
      </div>
      <section className="panel standalone-panel">
        <div className="stats-scroll">
          <div className="stats-table">
            <div className="stats-row head products-row">
              <span>Prodotto</span>
              <span>Categoria</span>
              <span>Clienti</span>
              <span>CTE</span>
              <span>Stato</span>
              <span />
            </div>
            {rows.map((row) => (
              <div className="stats-row products-row" key={row.id}>
                <span>
                  <strong>{row.name}</strong>
                  {row.description && <small className="cell-note">{row.description}</small>}
                </span>
                <span>{row.category ?? "—"}</span>
                <span>{row.customers}</span>
                <span>
                  <button type="button" className="link-button" onClick={() => setCteFor(row.id)}>
                    {row.ctes.length > 0 ? `${row.ctes.length} CTE · gestisci` : "+ Aggiungi CTE"}
                  </button>
                </span>
                <span className={`status ${row.is_active ? "ok" : "ko"}`}>
                  <i /> {row.is_active ? "Attivo" : "Disattivato"}
                </span>
                <Button className="secondary-button" onClick={() => setEditing(row)}>
                  Modifica
                </Button>
              </div>
            ))}
          </div>
        </div>
      </section>
      {cteFor && rows.find((r) => r.id === cteFor) && (
        <CteModal product={rows.find((r) => r.id === cteFor)!} onClose={() => setCteFor(null)} onChanged={load} />
      )}
      {editing && (
        <ProductModal
          key={editing === "new" ? "new" : editing.id}
          product={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null)
            load()
          }}
        />
      )}
    </>
  )
}

const auditLabels: Record<string, string> = {
  login: "Accesso",
  amministratore_creato: "Amministratore creato",
  agente_creato: "Agente creato",
  agente_modificato: "Agente modificato",
  agente_sospeso: "Agente sospeso",
  agente_riattivato: "Agente riattivato",
  ruolo_modificato: "Ruolo modificato",
  permessi_modificati: "Permessi modificati",
  password_reimpostata: "Password reimpostata",
  password_cambiata: "Password cambiata",
  password_recuperata: "Password recuperata (emergenza)",
  cliente_creato: "Cliente creato",
  cliente_modificato: "Cliente modificato",
  stato_cliente_cambiato: "Stato cliente cambiato",
  nota_aggiunta: "Nota aggiunta",
  task_creata: "Task creata",
  task_modificata: "Task modificata",
  task_completata: "Task completata",
  ko_non_recuperabile: "KO non recuperabile",
  task_riaperta: "Task riaperta",
  task_eliminata: "Task eliminata",
  performance_inserita: "Performance inserita",
  appuntamento_creato: "Appuntamento creato",
  appuntamento_modificato: "Appuntamento modificato",
  appuntamento_eliminato: "Appuntamento eliminato",
  clienti_geolocalizzati: "Clienti posizionati sulla mappa",
  prodotto_creato: "Prodotto creato",
  prodotto_modificato: "Prodotto modificato",
  cte_creata: "CTE creata",
  cte_modificata: "CTE modificata",
  cte_eliminata: "CTE eliminata",
  ufficio_creato: "Ufficio creato",
  ufficio_modificato: "Ufficio modificato",
}

const auditDetail = (row: AuditRow) => {
  const d = row.details ?? {}
  const text = d.code ?? d.name ?? d.email ?? d.title ?? ""
  return String(text)
}

function SettingsPage({ user }: { user: SessionUser }) {
  const canSettings = user.permissions.includes("settings.manage")
  const canAudit = user.permissions.includes("audit.view")
  const [offices, setOffices] = useState<OfficeRow[] | null>(null)
  const [drive, setDrive] = useState<DriveStatus | null>(null)
  const [audit, setAudit] = useState<AuditRow[] | null>(null)
  const [error, setError] = useState("")
  const [officeForm, setOfficeForm] = useState({ name: "", city: "" })
  const [filter, setFilter] = useState("")

  const loadOffices = () =>
    fetchOffices()
      .then(setOffices)
      .catch((err) => setError(err instanceof Error ? err.message : "Errore imprevisto"))
  const checkDrive = () => {
    setDrive(null)
    fetchDriveStatus()
      .then(setDrive)
      .catch((err) => setError(err instanceof Error ? err.message : "Errore imprevisto"))
  }

  useEffect(() => {
    if (canSettings) {
      loadOffices()
      checkDrive()
    }
    if (canAudit) {
      fetchAudit()
        .then(setAudit)
        .catch((err) => setError(err instanceof Error ? err.message : "Errore imprevisto"))
    }
  }, [])

  const addOffice = async () => {
    setError("")
    try {
      await saveOffice(officeForm)
      setOfficeForm({ name: "", city: "" })
      await loadOffices()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Errore imprevisto")
    }
  }

  const renameOffice = async (office: OfficeRow) => {
    const name = window.prompt("Nuovo nome dell'ufficio:", office.name)
    if (!name || name.trim() === office.name) return
    try {
      await saveOffice({ name, city: office.city ?? "" }, office.id)
      await loadOffices()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Errore imprevisto")
    }
  }

  const needle = filter.toLowerCase().trim()
  const auditRows = (audit ?? []).filter(
    (row) =>
      !needle ||
      `${auditLabels[row.action] ?? row.action} ${row.actor_name ?? ""} ${auditDetail(row)}`.toLowerCase().includes(needle),
  )

  return (
    <div className="settings-stack">
      {error && <p className="form-error">{error}</p>}

      {canSettings && (
        <section className="panel standalone-panel">
          <div className="panel-heading">
            <div>
              <p className="panel-kicker neutral">Profilo aziendale</p>
              <h2>Uffici</h2>
            </div>
          </div>
          <div className="doc-list">
            {(offices ?? []).map((office) => (
              <div className="doc-row" key={office.id}>
                <Icon name="settings" size={18} />
                <div>
                  <strong>{office.name}</strong>
                  <small>
                    {office.city ? `${office.city} · ` : ""}
                    {office.agents} persone · {office.customers} clienti
                  </small>
                </div>
                <Button className="secondary-button" onClick={() => renameOffice(office)}>
                  Rinomina
                </Button>
              </div>
            ))}
          </div>
          <form
            className="upload-form"
            onSubmit={(e) => {
              e.preventDefault()
              addOffice()
            }}
          >
            <input type="text" required maxLength={60} placeholder="Nome nuovo ufficio" value={officeForm.name} onChange={(e) => setOfficeForm({ ...officeForm, name: e.target.value })} />
            <input type="text" maxLength={60} placeholder="Città (facoltativa)" value={officeForm.city} onChange={(e) => setOfficeForm({ ...officeForm, city: e.target.value })} />
            <Button className="primary-button" type="submit">
              Aggiungi ufficio
            </Button>
          </form>
        </section>
      )}

      {canSettings && (
        <section className="panel standalone-panel">
          <div className="panel-heading">
            <div>
              <p className="panel-kicker neutral">Documenti</p>
              <h2>Google Drive</h2>
            </div>
            <Button className="secondary-button" onClick={checkDrive}>
              Verifica collegamento
            </Button>
          </div>
          <div className="drive-status">
            {!drive && <p className="muted">Controllo in corso…</p>}
            {drive && drive.ok && (
              <p className="form-ok flush">
                Collegato. Cartella aziendale: <strong>{drive.folder_name}</strong> ({drive.mode}).
              </p>
            )}
            {drive && !drive.ok && !drive.configured && (
              <p className="form-error flush">
                Non configurato. Su Netlify mancano le variabili: {drive.missing?.join(", ")}.
              </p>
            )}
            {drive && !drive.ok && drive.configured && <p className="form-error flush">{drive.message}</p>}
          </div>
        </section>
      )}

      {canAudit && (
        <section className="panel standalone-panel">
          <div className="panel-heading">
            <div>
              <p className="panel-kicker neutral">Sicurezza e accessi</p>
              <h2>Registro attività</h2>
            </div>
            <input
              className="inline-select audit-filter"
              placeholder="Filtra (persona, azione…)"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            />
          </div>
          <div className="stats-scroll">
            <div className="stats-table">
              <div className="stats-row head audit-row">
                <span>Quando</span>
                <span>Chi</span>
                <span>Cosa</span>
                <span>Dettaglio</span>
              </div>
              {!audit && <p className="muted pad">Caricamento…</p>}
              {auditRows.map((row) => (
                <div className="stats-row audit-row" key={row.id}>
                  <span>{formatDateTime(row.created_at)}</span>
                  <span>{row.actor_name ? `${row.actor_name} ${row.actor_last_name ?? ""}` : "Sistema"}</span>
                  <strong>{auditLabels[row.action] ?? row.action.replace(/_/g, " ")}</strong>
                  <span className="muted">{auditDetail(row)}</span>
                </div>
              ))}
              {audit && auditRows.length === 0 && <p className="muted pad">Nessuna attività trovata.</p>}
            </div>
          </div>
        </section>
      )}
    </div>
  )
}

/* ---------- Segreteria: KO da recuperare e task manuali per gli agenti ---------- */

function TaskStatusBadge({ status, kind }: { status: TaskStatus; kind: TaskKind }) {
  const meta =
    status === "aperta"
      ? { label: kind === "ko" ? "Da recuperare" : "Da fare", tone: "pending" }
      : status === "completata"
        ? { label: kind === "ko" ? "Recuperato" : "Fatta", tone: "ok" }
        : { label: "Non recuperabile", tone: "ko" }
  return (
    <span className={`status ${meta.tone}`}>
      <i />
      {meta.label}
    </span>
  )
}

const todayIso = () => localIso(new Date())

// Crea una nuova task (KO da recuperare o task manuale) oppure modifica una task aperta
function TaskFormModal({
  task,
  onClose,
  onSaved,
}: {
  task: TaskRow | null
  onClose: () => void
  onSaved: () => void
}) {
  const isNew = task === null
  const [meta, setMeta] = useState<TaskMeta | null>(null)
  const [kind, setKind] = useState<TaskKind>(task?.kind ?? "ko")
  const [customerId, setCustomerId] = useState(task?.customer_id ?? "")
  const [agentId, setAgentId] = useState(task?.agent_id ?? "")
  const [filter, setFilter] = useState("")
  const [title, setTitle] = useState(task?.title ?? "")
  const [details, setDetails] = useState(task?.details ?? "")
  const [due, setDue] = useState(task?.due_date ?? "")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    fetchTaskMeta()
      .then(setMeta)
      .catch((e) => setError(e instanceof Error ? e.message : "Errore imprevisto"))
  }, [])

  const customer = meta?.customers.find((c) => c.id === customerId) ?? null
  const agents = customer?.agents ?? []
  const q = filter.trim().toLowerCase()
  const options = (meta?.customers ?? [])
    .filter((c) => !q || `${c.first_name} ${c.last_name} ${c.city ?? ""}`.toLowerCase().includes(q))
    .slice(0, 100)

  const pickCustomer = (id: string) => {
    setCustomerId(id)
    const c = meta?.customers.find((x) => x.id === id)
    // se il cliente ha un solo agente lo scelgo io, altrimenti lo sceglie la segreteria
    setAgentId(c && c.agents.length === 1 ? c.agents[0].id : "")
  }

  const submit = async () => {
    if (busy) return
    setError("")
    if (isNew && !customerId) return setError("Scegli il cliente")
    if (!agentId) return setError("Scegli l'agente a cui assegnarla")
    setBusy(true)
    try {
      if (isNew) {
        await createTask({ kind, customer_id: customerId, agent_id: agentId, title, details, due_date: due })
      } else {
        await updateTask(task.id, { title, details, due_date: due, agent_id: agentId })
      }
      onSaved()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Errore imprevisto")
      setBusy(false)
    }
  }

  return (
    <div className="modal-layer" role="presentation" onMouseDown={onClose}>
      <div className="modal wide" role="dialog" aria-modal="true" onMouseDown={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div>
            <p className="panel-kicker neutral">Segreteria</p>
            <h2>{isNew ? "Nuova task" : "Modifica task"}</h2>
          </div>
          <Button className="icon-button" onClick={onClose} title="Chiudi">
            <Icon name="close" />
          </Button>
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            submit()
          }}
        >
          <div className="form-grid">
            {isNew && (
              <div className="full">
                <span className="field-caption">Tipo di task</span>
                <div className="chip-row">
                  <button type="button" className={`chip ${kind === "ko" ? "on" : ""}`} onClick={() => setKind("ko")}>
                    KO da recuperare
                  </button>
                  <button type="button" className={`chip ${kind === "manuale" ? "on" : ""}`} onClick={() => setKind("manuale")}>
                    Task manuale per l’agente
                  </button>
                </div>
              </div>
            )}

            {isNew ? (
              <>
                <label className="full">
                  <span>Cliente (già fatto)</span>
                  <input
                    placeholder="Scrivi nome, cognome o città per cercare…"
                    value={filter}
                    onChange={(e) => setFilter(e.target.value)}
                    autoComplete="off"
                  />
                </label>
                <label className="full">
                  <span>{meta ? `${options.length} clienti trovati` : "Caricamento clienti…"}</span>
                  <select value={customerId} onChange={(e) => pickCustomer(e.target.value)}>
                    <option value="">— Scegli il cliente —</option>
                    {options.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.first_name} {c.last_name}
                        {c.city ? ` · ${c.city}` : ""}
                      </option>
                    ))}
                  </select>
                </label>
              </>
            ) : (
              <div className="full">
                <span className="field-caption">Cliente</span>
                <strong>
                  {task.customer_first_name} {task.customer_last_name}
                </strong>
              </div>
            )}

            <label>
              <span>Agente a cui assegnarla</span>
              <select value={agentId} onChange={(e) => setAgentId(e.target.value)} disabled={!customer && isNew}>
                <option value="">{customer || !isNew ? "— Scegli l’agente —" : "Prima scegli il cliente"}</option>
                {agents.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>Scadenza (facoltativa)</span>
              <input type="date" min={isNew ? todayIso() : undefined} value={due} onChange={(e) => setDue(e.target.value)} />
            </label>

            <label className="full">
              <span>{kind === "ko" ? "Titolo (facoltativo)" : "Cosa deve fare l’agente"}</span>
              <input
                required={kind === "manuale"}
                maxLength={120}
                placeholder={kind === "ko" ? "KO da recuperare" : "Es. Richiamare per confermare i dati"}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </label>
            <label className="full">
              <span>{kind === "ko" ? "Motivo del KO (obbligatorio)" : "Istruzioni (facoltative)"}</span>
              <textarea
                rows={3}
                maxLength={1000}
                required={kind === "ko"}
                value={details}
                onChange={(e) => setDetails(e.target.value)}
              />
            </label>
          </div>
          {error && (
            <p className="form-error modal-error" role="alert">
              {error}
            </p>
          )}
          <div className="modal-actions">
            <Button className="secondary-button" onClick={onClose}>
              Annulla
            </Button>
            <Button className="primary-button" type="submit">
              {busy ? "Attendi…" : isNew ? "Crea task" : "Salva modifiche"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}

// Chiude una task: "completata" (KO recuperato / task fatta) oppure "non recuperabile" (solo KO)
function TaskCloseModal({
  task,
  mode,
  onClose,
  onDone,
}: {
  task: TaskRow
  mode: "complete" | "lost"
  onClose: () => void
  onDone: () => void
}) {
  const [note, setNote] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const lost = mode === "lost"

  const submit = async () => {
    if (busy) return
    if (lost && !note.trim()) return setError("Scrivi perché il KO non è recuperabile")
    setBusy(true)
    setError("")
    try {
      await (lost ? markTaskLost(task.id, note) : completeTask(task.id, note))
      onDone()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Errore imprevisto")
      setBusy(false)
    }
  }

  const heading = lost ? "KO non recuperabile" : task.kind === "ko" ? "KO recuperato" : "Task completata"
  return (
    <div className="modal-layer" role="presentation" onMouseDown={onClose}>
      <div className="modal" role="dialog" aria-modal="true" onMouseDown={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div>
            <p className="panel-kicker neutral">
              {task.customer_first_name} {task.customer_last_name}
            </p>
            <h2>{heading}</h2>
          </div>
          <Button className="icon-button" onClick={onClose} title="Chiudi">
            <Icon name="close" />
          </Button>
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            submit()
          }}
        >
          <div className="form-grid">
            <label className="full">
              <span>{lost ? "Perché non è recuperabile (obbligatorio)" : "Nota per la segreteria (facoltativa)"}</span>
              <textarea rows={3} maxLength={500} autoFocus value={note} onChange={(e) => setNote(e.target.value)} />
            </label>
          </div>
          {error && (
            <p className="form-error modal-error" role="alert">
              {error}
            </p>
          )}
          <div className="modal-actions">
            <Button className="secondary-button" onClick={onClose}>
              Annulla
            </Button>
            <Button className="primary-button" type="submit">
              {busy ? "Attendi…" : "Conferma"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}

function SecretariatPage({ user, onOpenCustomer }: { user: SessionUser; onOpenCustomer: (id: string) => void }) {
  const [rows, setRows] = useState<TaskRow[] | null>(null)
  const [canManage, setCanManage] = useState(false)
  const [error, setError] = useState("")
  const [tab, setTab] = useState<"aperte" | "chiuse">("aperte")
  const [agentFilter, setAgentFilter] = useState("")
  const [form, setForm] = useState<{ task: TaskRow | null } | null>(null)
  const [closing, setClosing] = useState<{ task: TaskRow; mode: "complete" | "lost" } | null>(null)
  const [busyId, setBusyId] = useState("")

  const load = () =>
    fetchTasks()
      .then((res) => {
        setRows(res.rows)
        setCanManage(res.can_manage)
        setError("")
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Errore imprevisto"))

  useEffect(() => {
    load()
  }, [])

  if (error && !rows) return <p className="form-error">{error}</p>
  if (!rows) return <p className="muted">Caricamento…</p>

  const agents = [...new Map(rows.map((r) => [r.agent_id, `${r.agent_first_name} ${r.agent_last_name}`])).entries()]
  const visible = rows.filter((r) => !agentFilter || r.agent_id === agentFilter)
  const open = visible.filter((r) => r.status === "aperta")
  const closed = visible
    .filter((r) => r.status !== "aperta")
    .sort((a, b) => (b.closed_at ?? "").localeCompare(a.closed_at ?? ""))

  const act = async (id: string, fn: () => Promise<unknown>) => {
    setBusyId(id)
    setError("")
    try {
      await fn()
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Errore imprevisto")
    } finally {
      setBusyId("")
    }
  }

  const renderRow = (row: TaskRow) => {
    const isOpen = row.status === "aperta"
    const name = `${row.customer_first_name} ${row.customer_last_name}`
    const mine = row.agent_id === user.id
    return (
      <div className="doc-row task-row" key={row.id}>
        <Icon name={row.kind === "ko" ? "warning" : "check"} size={18} />
        <div>
          <strong>
            <button type="button" className="link-button" onClick={() => onOpenCustomer(row.customer_id)} title="Apri la scheda cliente">
              {name}
            </button>{" "}
            · {row.title}
          </strong>
          {row.details && <small className="task-details">{row.kind === "ko" ? "Motivo: " : ""}{row.details}</small>}
          <small>
            {canManage || !mine ? `Agente: ${row.agent_first_name} ${row.agent_last_name} · ` : ""}
            {row.customer_phone && (
              <>
                <a href={`tel:${row.customer_phone}`}>{row.customer_phone}</a>
                {" · "}
              </>
            )}
            {row.customer_city ? `${row.customer_city} · ` : ""}
            {row.due_date ? (
              <span className={row.overdue ? "task-overdue" : undefined}>
                entro il {formatDate(row.due_date)}
                {row.overdue ? " (scaduta)" : ""}
              </span>
            ) : (
              "senza scadenza"
            )}
            {row.creator_first_name ? ` · creata da ${row.creator_first_name} ${row.creator_last_name ?? ""}` : ""}
          </small>
          {!isOpen && (
            <small>
              {row.closer_first_name ? `Chiusa da ${row.closer_first_name} ${row.closer_last_name ?? ""}` : "Chiusa"}
              {row.closed_at ? ` il ${formatDateTime(row.closed_at)}` : ""}
              {row.closed_note ? ` · ${row.closed_note}` : ""}
            </small>
          )}
        </div>
        <TaskStatusBadge status={row.status} kind={row.kind} />
        <div className="task-actions">
          {isOpen && (
            <>
              <Button className="primary-button" onClick={() => setClosing({ task: row, mode: "complete" })}>
                {row.kind === "ko" ? "Recuperato" : "Fatto"}
              </Button>
              {row.kind === "ko" && (
                <Button className="secondary-button" onClick={() => setClosing({ task: row, mode: "lost" })}>
                  Non recuperabile
                </Button>
              )}
              {canManage && (
                <Button className="secondary-button" onClick={() => setForm({ task: row })}>
                  Modifica
                </Button>
              )}
            </>
          )}
          {!isOpen && canManage && (
            <Button className="secondary-button" onClick={() => act(row.id, () => reopenTask(row.id))}>
              {busyId === row.id ? "Attendi…" : "Riapri"}
            </Button>
          )}
          {canManage && (
            <Button
              className="secondary-button"
              onClick={() => {
                if (window.confirm(`Eliminare la task per ${name}?`)) act(row.id, () => deleteTask(row.id))
              }}
            >
              Elimina
            </Button>
          )}
        </div>
      </div>
    )
  }

  const section = (title: string, hint: string, items: TaskRow[], empty: string) => (
    <section className="panel standalone-panel" key={title}>
      <div className="panel-heading">
        <div>
          <p className="panel-kicker neutral">{hint}</p>
          <h2>
            {title} <span className="task-count">{items.length}</span>
          </h2>
        </div>
      </div>
      <div className="doc-list">
        {items.length === 0 && <p className="muted pad">{empty}</p>}
        {items.map(renderRow)}
      </div>
    </section>
  )

  return (
    <div className="settings-stack">
      <div className="task-toolbar">
        <div className="chip-row">
          <button type="button" className={`chip ${tab === "aperte" ? "on" : ""}`} onClick={() => setTab("aperte")}>
            Da fare ({rows.filter((r) => r.status === "aperta").length})
          </button>
          <button type="button" className={`chip ${tab === "chiuse" ? "on" : ""}`} onClick={() => setTab("chiuse")}>
            Chiuse ({rows.filter((r) => r.status !== "aperta").length})
          </button>
        </div>
        <div className="task-toolbar-right">
          {canManage && agents.length > 1 && (
            <div className="select-wrap">
              <Icon name="users" size={17} />
              <select value={agentFilter} onChange={(e) => setAgentFilter(e.target.value)} aria-label="Filtra per agente">
                <option value="">Tutti gli agenti</option>
                {agents.map(([id, name]) => (
                  <option key={id} value={id}>
                    {name}
                  </option>
                ))}
              </select>
            </div>
          )}
          {canManage && (
            <Button className="primary-button" onClick={() => setForm({ task: null })}>
              <Icon name="plus" size={18} /> Nuova task
            </Button>
          )}
        </div>
      </div>

      {error && <p className="form-error">{error}</p>}

      {tab === "aperte" ? (
        <>
          {section(
            "KO da recuperare",
            "Controlla la motivazione e richiama il cliente",
            open.filter((r) => r.kind === "ko"),
            "Nessun KO da recuperare.",
          )}
          {section(
            "Task per gli agenti",
            canManage ? "Task aggiunte a mano dalla segreteria" : "Le task che la segreteria ti ha assegnato",
            open.filter((r) => r.kind === "manuale"),
            "Nessuna task da fare.",
          )}
        </>
      ) : (
        section("Task chiuse", "KO recuperati, non recuperabili e task completate", closed, "Ancora nessuna task chiusa.")
      )}

      {form && (
        <TaskFormModal
          task={form.task}
          onClose={() => setForm(null)}
          onSaved={() => {
            setForm(null)
            load()
          }}
        />
      )}
      {closing && (
        <TaskCloseModal
          task={closing.task}
          mode={closing.mode}
          onClose={() => setClosing(null)}
          onDone={() => {
            setClosing(null)
            load()
          }}
        />
      )}
    </div>
  )
}


function MenuPage({
  active,
  user,
  search,
  customersVersion,
  focusCustomerId,
  onCustomersChanged,
  onOpenCustomer,
  onNavigate,
  leadQuery,
  onClearLeadQuery,
}: {
  active: string
  user: SessionUser
  search: string
  leadQuery: string
  onClearLeadQuery: () => void
  customersVersion: number
  focusCustomerId: string | null
  onCustomersChanged: () => void
  onOpenCustomer: (id: string) => void
  onNavigate: (label: string) => void
}) {
  if (active === "Call Mode") return <CallModePage query={leadQuery} onClearQuery={onClearLeadQuery} />
  if (active === "Agenda lead") return <LeadAgendaPage onOpenCustomer={onOpenCustomer} />
  if (active === "LeadHub")
    return (
      <LeadHubAdminPage
        onOpenAgents={user.permissions.includes("agents.manage") ? () => onNavigate("Agenti & permessi") : undefined}
      />
    )
  if (active === "Clienti")
    return (
      <CustomersPage
        user={user}
        search={search}
        version={customersVersion}
        focusId={focusCustomerId}
        onChanged={onCustomersChanged}
        onOpenTasks={() => onNavigate("Segreteria")}
      />
    )
  if (active === "Prodotti") return <ProductsPage />
  if (active === "Segreteria") return <SecretariatPage user={user} onOpenCustomer={onOpenCustomer} />
  if (active === "Performance") return <PerformancePage user={user} />
  if (active === "Mappa clienti") return <MapPage user={user} onOpenCustomer={onOpenCustomer} />
  if (active === "Calendario") return <CalendarPage user={user} onOpenCustomer={onOpenCustomer} />
  if (active === "Agenti & permessi")
    return (
      <AgentsPage
        currentUserId={user.id}
        canRoles={user.permissions.includes("roles.manage")}
        canDelete={user.permissions.includes("agents.delete")}
      />
    )
  return <SettingsPage user={user} />
}

export default function App() {
  // Link di firma privacy: /#firma=TOKEN (il token resta nel browser, non viene inviato al server nell'indirizzo)
  const [signToken] = useState(() => new URLSearchParams(window.location.hash.replace(/^#/, "")).get("firma"))
  return signToken ? <PublicSignPage token={signToken} /> : <MainApp />
}

function MainApp() {
  const [user, setUser] = useState<SessionUser | null>(null)
  const [checking, setChecking] = useState(true)
  const [active, setActive] = useState("Dashboard")
  const [dark, setDark] = useState(false)
  const [sidebar, setSidebar] = useState(false)
  const [range, setRange] = useState("Questo mese")
  const [search, setSearch] = useState("")
  const [showSearch, setShowSearch] = useState(false)
  const [leadQuery, setLeadQuery] = useState("")
  const [showCreate, setShowCreate] = useState(false)
  const [customersVersion, setCustomersVersion] = useState(0)
  const [focusCustomerId, setFocusCustomerId] = useState<string | null>(null)
  const [showProfile, setShowProfile] = useState(false)

  useEffect(() => {
    document.documentElement.dataset.theme = dark ? "dark" : "light"
  }, [dark])

  // All'apertura del sito controlla se esiste gia' una sessione valida
  useEffect(() => {
    getMe()
      .then((me) => {
        if (me) {
          setUser(me)
          setDark(me.theme === "dark")
        }
      })
      .catch(() => {})
      .finally(() => setChecking(false))
  }, [])

  const selectNavigation = (label: string) => {
    setActive(label)
    setFocusCustomerId(null)
    setSidebar(false)
  }

  if (checking) return <div className="boot-screen">Caricamento…</div>
  if (!user)
    return (
      <LoginPage
        onLoggedIn={(me) => {
          setUser(me)
          setDark(me.theme === "dark")
          setActive("Dashboard")
        }}
      />
    )

  if (user.must_change_password)
    return (
      <ChangePasswordPage
        onDone={() => setUser({ ...user, must_change_password: false })}
        onLogout={async () => {
          await logout().catch(() => {})
          setUser(null)
        }}
      />
    )

  const can = (keys: string[]) => keys.some((key) => user.permissions.includes(key))
  const allowed = (label: string) =>
    !requiredPermissions[label] || can(requiredPermissions[label])
  const visibleNavigation = navigation.filter((item) => allowed(item.label))
  const visibleAdminNavigation = adminNavigation.filter((item) => allowed(item.label))
  const initials = `${user.first_name[0] ?? ""}${user.last_name[0] ?? ""}`.toUpperCase()
  // la barra di ricerca in alto serve solo dove c'e' qualcosa da cercare
  const searchMode: "crm" | "lead" | null = active === "Call Mode" ? "lead" : active === "Clienti" ? "crm" : null
  const todayLabel = new Date().toLocaleDateString("it-IT", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  })
  const openCustomer = (id: string) => {
    setFocusCustomerId(id)
    setActive("Clienti")
    setSidebar(false)
  }
  const toggleTheme = () => {
    const next = !dark
    setDark(next)
    saveTheme(next ? "dark" : "light").catch(() => {})
  }
  const doLogout = async () => {
    await logout().catch(() => {})
    setUser(null)
    setDark(false)
  }

  return (
    <div className="app-shell">
      {sidebar && (
        <Button
          className="mobile-overlay"
          onClick={() => setSidebar(false)}
          title="Chiudi menu"
        />
      )}
      <aside className={`sidebar ${sidebar ? "open" : ""}`}>
        <div className="brand">
          <img className="brand-logo" src="/logo-fad-white.png" alt="FAD LeadHub" />
          <div>
            <p className="brand-name">FAD LeadHub</p>
            <p className="brand-subtitle">Lead &amp; clienti</p>
          </div>
          <Button
            className="icon-button mobile-close"
            onClick={() => setSidebar(false)}
            title="Chiudi menu"
          >
            <Icon name="close" />
          </Button>
        </div>

        <div className="profile-card" role="button" tabIndex={0} onClick={() => setShowProfile(true)} onKeyDown={(e) => e.key === "Enter" && setShowProfile(true)} title="Il mio profilo">
          <div className="avatar avatar-main">{initials}</div>
          <div className="profile-copy">
            <strong>
              {user.first_name} {user.last_name}
            </strong>
            <span>{roleLabels[user.role] ?? user.role}</span>
          </div>
          <Icon name="chevron" size={16} />
        </div>

        <nav className="nav">
          <p className="nav-label">Area di lavoro</p>
          {visibleNavigation.map((item) => (
            <Button
              key={item.label}
              className={`nav-item ${active === item.label ? "active" : ""}`}
              onClick={() => selectNavigation(item.label)}
            >
              <Icon name={item.icon} />
              <span>{item.label}</span>
            </Button>
          ))}
          {visibleAdminNavigation.length > 0 && (
            <p className="nav-label admin-label">Amministrazione</p>
          )}
          {visibleAdminNavigation.map((item) => (
            <Button
              key={item.label}
              className={`nav-item ${active === item.label ? "active" : ""}`}
              onClick={() => selectNavigation(item.label)}
            >
              <Icon name={item.icon} />
              <span>{item.label}</span>
            </Button>
          ))}
        </nav>

        <div className="sidebar-footer">
          <Button
            className="nav-item logout"
            onClick={doLogout}
          >
            <Icon name="logout" />
            <span>Esci</span>
          </Button>
        </div>
      </aside>

      <main className="main">
        <header className="topbar">
          <Button
            className="icon-button menu-button"
            onClick={() => setSidebar(true)}
            title="Apri menu"
          >
            <Icon name="menu" />
          </Button>
          {searchMode && (
            <div className={`search ${showSearch ? "visible" : ""}`}>
              <Icon name="search" size={18} />
              <input
                value={searchMode === "lead" ? leadQuery : search}
                onChange={(event) => (searchMode === "lead" ? setLeadQuery(event.target.value) : setSearch(event.target.value))}
                placeholder={searchMode === "lead" ? "Cerca tra i tuoi lead: nome o numero (anche le ultime cifre)…" : "Cerca tra i clienti…"}
                aria-label={searchMode === "lead" ? "Cerca tra i lead" : "Cerca tra i clienti"}
              />
              {searchMode === "crm" && <kbd>⌘ K</kbd>}
            </div>
          )}
          <div className="top-actions">
            {searchMode && (
              <Button
                className="icon-button mobile-search"
                onClick={() => setShowSearch(!showSearch)}
                title="Cerca"
              >
                <Icon name="search" />
              </Button>
            )}
            <Button
              className="icon-button"
              onClick={toggleTheme}
              title={dark ? "Attiva modalità chiara" : "Attiva modalità scura"}
            >
              <Icon name={dark ? "sun" : "moon"} />
            </Button>
            <NotificationsBell onNavigate={selectNavigation} />
            <div className="top-avatar">{initials}</div>
          </div>
        </header>

        <div className="content">
          <section className="page-heading">
            <div>
              <p className="today">{todayLabel}</p>
              <h1>{active === "Dashboard" ? `Buongiorno, ${user.first_name}` : active}</h1>
              <p>
                {active === "Dashboard"
                  ? "Ecco cosa sta succedendo oggi in FAD LeadHub."
                  : (pageSubtitles[active] ?? "")}
              </p>
            </div>
            <div className="heading-actions">
              {active === "Dashboard" && (
              <div className="select-wrap">
                <Icon name="calendar" size={17} />
                <select
                  value={range}
                  onChange={(event) => setRange(event.target.value)}
                  aria-label="Periodo"
                >
                  <option>Questa settimana</option>
                  <option>Questo mese</option>
                  <option>Questo trimestre</option>
                </select>
              </div>
              )}
              {(active === "Clienti" || active === "Dashboard") &&
              can(["customers.create"]) ? (
                <Button
                  className="primary-button"
                  onClick={() => setShowCreate(true)}
                >
                  <Icon name="plus" size={18} /> Nuovo cliente
                </Button>
              ) : null}
            </div>
          </section>

          {active === "Dashboard" ? (
            <DashboardPage range={range} user={user} onNavigate={selectNavigation} />
          ) : (
            <MenuPage
              active={active}
              user={user}
              search={search}
              customersVersion={customersVersion}
              focusCustomerId={focusCustomerId}
              onCustomersChanged={() => setCustomersVersion((v) => v + 1)}
              onOpenCustomer={openCustomer}
              onNavigate={selectNavigation}
              leadQuery={leadQuery}
              onClearLeadQuery={() => setLeadQuery("")}
            />
          )}
        </div>
      </main>

      {showCreate && (
        <CustomerFormModal
          customer={null}
          user={user}
          onClose={() => setShowCreate(false)}
          onSaved={(id) => {
            setShowCreate(false)
            setFocusCustomerId(id)
            setCustomersVersion((v) => v + 1)
            setActive("Clienti")
          }}
        />
      )}
      {showProfile && <ProfileModal user={user} onClose={() => setShowProfile(false)} />}
    </div>
  )
}
