import { useCallback, useEffect, useRef, useState } from "react"
import { fetchNotifications, markAllNotificationsRead, markNotificationRead, type AppNotification } from "./services/api"

const kindIcon: Record<string, string> = {
  shared_appointment: "👥",
  calendar_reminder: "⏰",
  shared_result: "📋",
  task_assigned: "📌",
  task_due: "⚠️",
  task_done: "✅",
}

const ago = (iso: string) => {
  const s = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000))
  if (s < 60) return "ora"
  if (s < 3600) return `${Math.floor(s / 60)} min fa`
  if (s < 86400) return `${Math.floor(s / 3600)} h fa`
  return new Date(iso).toLocaleDateString("it-IT", { day: "2-digit", month: "2-digit" })
}

// Campanella delle notifiche: appuntamenti condivisi, promemoria calendario (1 giorno e 2 ore prima),
// task della segreteria (assegnate, in scadenza, completate). Si aggiorna da sola ogni minuto.
export function NotificationsBell({ onNavigate }: { onNavigate: (label: string) => void }) {
  const [items, setItems] = useState<AppNotification[]>([])
  const [unread, setUnread] = useState(0)
  const [open, setOpen] = useState(false)
  const [error, setError] = useState("")
  const [permission, setPermission] = useState<string>(() => ("Notification" in window ? Notification.permission : "unsupported"))
  const seen = useRef<Set<string> | null>(null)
  const wrap = useRef<HTMLDivElement | null>(null)

  const apply = useCallback((res: { items: AppNotification[]; unread: number }) => {
    // avviso del dispositivo per le notifiche arrivate mentre l'app e' in secondo piano
    if (seen.current && "Notification" in window && Notification.permission === "granted" && document.hidden) {
      for (const n of res.items) {
        if (!n.read_at && !seen.current.has(n.id)) {
          try {
            new Notification(n.title, { body: n.body ?? undefined, tag: n.id })
          } catch {
            /* alcuni telefoni non permettono le notifiche dalla pagina */
          }
        }
      }
    }
    seen.current = new Set(res.items.map((n) => n.id))
    setItems(res.items)
    setUnread(res.unread)
    setError("")
  }, [])

  const load = useCallback(() => {
    fetchNotifications()
      .then(apply)
      .catch(() => setError("Non riesco ad aggiornare le notifiche"))
  }, [apply])

  useEffect(() => {
    load()
    const t = setInterval(() => {
      if (!document.hidden) load()
    }, 60000)
    const onFocus = () => load()
    window.addEventListener("focus", onFocus)
    return () => {
      clearInterval(t)
      window.removeEventListener("focus", onFocus)
    }
  }, [load])

  useEffect(() => {
    if (!open) return
    const close = (e: MouseEvent) => {
      if (wrap.current && !wrap.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", close)
    return () => document.removeEventListener("mousedown", close)
  }, [open])

  const openItem = async (n: AppNotification) => {
    setOpen(false)
    if (!n.read_at) markNotificationRead(n.id).then(apply).catch(() => {})
    if (n.link) onNavigate(n.link)
  }

  const askPermission = async () => {
    if (!("Notification" in window)) return
    setPermission(await Notification.requestPermission())
  }

  return (
    <div className="notif-wrap" ref={wrap}>
      <button type="button" className="icon-button notification" title="Notifiche" aria-label={`Notifiche${unread ? `: ${unread} da leggere` : ""}`} onClick={() => setOpen((o) => !o)}>
        <svg className="icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
          <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
        </svg>
        {unread > 0 && <b className="notif-count">{unread > 9 ? "9+" : unread}</b>}
      </button>
      {open && (
        <div className="notif-panel" role="dialog" aria-label="Notifiche">
          <div className="notif-head">
            <strong>Notifiche</strong>
            {unread > 0 && (
              <button type="button" className="link-button" onClick={() => markAllNotificationsRead().then(apply).catch(() => {})}>
                Segna tutte come lette
              </button>
            )}
          </div>
          {error && <p className="notif-empty">{error}</p>}
          {!error && items.length === 0 && <p className="notif-empty">Nessuna notifica per ora. Qui compaiono appuntamenti condivisi, promemoria, PDF mancanti ed esiti della segreteria.</p>}
          <div className="notif-list">
            {items.map((n) => (
              <button type="button" key={n.id} className={`notif-item ${n.read_at ? "" : "unread"}`} onClick={() => openItem(n)}>
                <span className="notif-ico">{kindIcon[n.kind] ?? "🔔"}</span>
                <span className="notif-text">
                  <strong>{n.title}</strong>
                  {n.body && <small>{n.body}</small>}
                </span>
                <em>{ago(n.created_at)}</em>
              </button>
            ))}
          </div>
          {permission === "default" && (
            <button type="button" className="notif-enable" onClick={askPermission}>
              Attiva gli avvisi sul dispositivo
            </button>
          )}
          {permission === "denied" && <p className="notif-hint">Gli avvisi sul dispositivo sono bloccati: puoi riattivarli dalle impostazioni del browser.</p>}
        </div>
      )}
    </div>
  )
}
