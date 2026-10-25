import { useEffect, useMemo, useState } from "react"
import { createRole, deleteRole, setRolePermissions, updateRole, type AgentsData } from "./services/api"

const GROUPS: Record<string, string> = {
  customers: "Clienti",
  stats: "Performance",
  calendar: "Calendario",
  agents: "Agenti e ruoli",
  roles: "Agenti e ruoli",
  products: "Prodotti",
  offices: "Uffici",
  leads: "LeadHub",
  privacy: "Privacy",
  tasks: "Segreteria",
  audit: "Impostazioni",
  settings: "Impostazioni",
  map: "Mappa",
  dashboard: "Dashboard",
}

const groupOf = (key: string) => {
  const prefix = key.split(".")[0]
  return GROUPS[prefix] ?? prefix.charAt(0).toUpperCase() + prefix.slice(1)
}

// Ruoli e permessi: l'amministratore sceglie cosa puo' fare ogni ruolo e ne crea di nuovi.
export function RolesPanel({ data, onChanged }: { data: AgentsData; onChanged: () => Promise<unknown> | void }) {
  const [selected, setSelected] = useState(data.roles[0]?.key ?? "agente")
  const role = data.roles.find((r) => r.key === selected) ?? data.roles[0]
  const locked = role?.key === "amministratore"

  const current = useMemo(
    () => new Set(data.rolePermissions.filter((r) => r.role === role?.key).map((r) => r.permission_key)),
    [data.rolePermissions, role?.key],
  )
  const [perms, setPerms] = useState<Set<string>>(current)
  const [label, setLabel] = useState(role?.label ?? "")
  const [msg, setMsg] = useState({ ok: "", error: "" })
  const [busy, setBusy] = useState(false)
  const [creating, setCreating] = useState(false)
  const [draft, setDraft] = useState({ label: "", copy_from: "agente" })

  useEffect(() => {
    setPerms(new Set(current))
    setLabel(role?.label ?? "")
    setMsg({ ok: "", error: "" })
  }, [role?.key, current, role?.label])

  const groups = useMemo(() => {
    const map = new Map<string, { key: string; description: string }[]>()
    for (const p of data.permissions) {
      const g = groupOf(p.key)
      map.set(g, [...(map.get(g) ?? []), p])
    }
    return [...map.entries()]
  }, [data.permissions])

  const run = async (task: () => Promise<string | void>) => {
    setBusy(true)
    setMsg({ ok: "", error: "" })
    try {
      const ok = await task()
      if (ok) setMsg({ ok, error: "" })
      await onChanged()
    } catch (e) {
      setMsg({ ok: "", error: e instanceof Error ? e.message : "Errore imprevisto" })
    } finally {
      setBusy(false)
    }
  }

  const toggle = (key: string) =>
    setPerms((s) => {
      const next = new Set(s)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })

  const toggleGroup = (items: { key: string }[], on: boolean) =>
    setPerms((s) => {
      const next = new Set(s)
      for (const i of items) {
        if (on) next.add(i.key)
        else next.delete(i.key)
      }
      return next
    })

  if (!role) return null
  const dirty = perms.size !== current.size || [...perms].some((k) => !current.has(k))

  return (
    <div className="roles-panel">
      <div className="filter-row roles-chips">
        {data.roles.map((r) => (
          <button key={r.key} type="button" className={`chip ${r.key === role.key ? "on" : ""}`} onClick={() => setSelected(r.key)}>
            {r.label} <span className="roles-count">{r.users}</span>
          </button>
        ))}
        <button type="button" className="chip" onClick={() => setCreating((c) => !c)}>
          + Nuovo ruolo
        </button>
      </div>

      {creating && (
        <section className="panel standalone-panel">
          <div className="panel-heading">
            <div>
              <p className="panel-kicker neutral">Parti da una copia di un ruolo esistente</p>
              <h2>Nuovo ruolo</h2>
            </div>
          </div>
          <div className="form-grid">
            <label>
              <span>Nome del ruolo</span>
              <input value={draft.label} maxLength={40} placeholder="Es. Responsabile zona" onChange={(e) => setDraft({ ...draft, label: e.target.value })} />
            </label>
            <label>
              <span>Copia i permessi da</span>
              <select value={draft.copy_from} onChange={(e) => setDraft({ ...draft, copy_from: e.target.value })}>
                {data.roles.map((r) => (
                  <option key={r.key} value={r.key}>
                    {r.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="modal-actions">
            <button type="button" className="secondary-button" onClick={() => setCreating(false)}>
              Annulla
            </button>
            <button
              type="button"
              className="primary-button"
              disabled={busy || draft.label.trim().length < 2}
              onClick={() =>
                run(async () => {
                  const res = await createRole({ label: draft.label, copy_from: draft.copy_from })
                  setCreating(false)
                  setDraft({ label: "", copy_from: "agente" })
                  setSelected(res.key)
                  return "Ruolo creato: ora personalizza i permessi"
                })
              }
            >
              Crea ruolo
            </button>
          </div>
        </section>
      )}

      <section className="panel standalone-panel">
        <div className="panel-heading">
          <div>
            <p className="panel-kicker neutral">
              {role.users} {role.users === 1 ? "persona" : "persone"} con questo ruolo
              {role.is_system ? " · ruolo di base" : ""}
            </p>
            <h2>{role.label}</h2>
          </div>
        </div>
        <div className="roles-pad">
          {msg.error && <p className="form-error">{msg.error}</p>}
          {msg.ok && <p className="form-ok flush">{msg.ok}</p>}

          <div className="form-grid roles-name">
            <label>
              <span>Nome visibile</span>
              <input value={label} maxLength={40} onChange={(e) => setLabel(e.target.value)} />
            </label>
          </div>
          <div className="roles-actions">
            <button
              type="button"
              className="secondary-button"
              disabled={busy || label.trim() === role.label}
              onClick={() => run(async () => (await updateRole(role.key, label), "Ruolo aggiornato"))}
            >
              Salva nome
            </button>
            {!role.is_system && (
              <button
                type="button"
                className="secondary-button danger-outline"
                disabled={busy}
                onClick={() => {
                  if (!window.confirm(`Eliminare il ruolo "${role.label}"? I suoi permessi vengono cancellati.`)) return
                  run(async () => {
                    await deleteRole(role.key)
                    setSelected("agente")
                    return "Ruolo eliminato"
                  })
                }}
              >
                Elimina ruolo
              </button>
            )}
          </div>

          <p className="modal-hint">
            {locked
              ? "L'amministratore ha sempre tutti i permessi: non si modificano."
              : "Scegli cosa può fare questo ruolo. Le eccezioni per una singola persona si impostano dalla sua scheda."}
          </p>

          <div className="roles-groups">
            {groups.map(([group, items]) => {
              const all = items.every((i) => locked || perms.has(i.key))
              return (
                <div className="roles-group" key={group}>
                  <div className="roles-group-head">
                    <strong>{group}</strong>
                    {!locked && (
                      <button type="button" className="link-button" onClick={() => toggleGroup(items, !all)}>
                        {all ? "Togli tutti" : "Seleziona tutti"}
                      </button>
                    )}
                  </div>
                  {items.map((p) => (
                    <label className="roles-perm" key={p.key}>
                      <input type="checkbox" disabled={locked} checked={locked || perms.has(p.key)} onChange={() => toggle(p.key)} />
                      <span>{p.description}</span>
                    </label>
                  ))}
                </div>
              )
            })}
          </div>
        </div>
        {!locked && (
          <div className="modal-actions roles-save">
            <button type="button" className="secondary-button" disabled={!dirty || busy} onClick={() => setPerms(new Set(current))}>
              Annulla modifiche
            </button>
            <button
              type="button"
              className="primary-button"
              disabled={!dirty || busy}
              onClick={() => run(async () => (await setRolePermissions(role.key, [...perms]), "Permessi del ruolo salvati"))}
            >
              {busy ? "Attendi…" : "Salva permessi del ruolo"}
            </button>
          </div>
        )}
      </section>
    </div>
  )
}
