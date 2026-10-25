// src/services/leadsApi.ts
// Chiamate al backend per LeadHub (lead di telemarketing).
import { request } from "./api";

export type LeadOutcome =
  | "nuovo"
  | "appuntamento"
  | "da_ricontattare"
  | "non_interessato"
  | "segreteria"
  | "numero_errato"
  | "persona_sbagliata";

export type AppointmentResult = "in_attesa" | "contratto_chiuso" | "incontrato_con_trattativa" | "incontrato_senza_trattativa" | "annullato" | "chiamato_senza_trattativa";

/* ---------- Agente ---------- */

export type QueueLead = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  phone2: string | null;
  address: string | null;
  house_number: string | null;
  street_type: string | null;
  provider: string | null;
  city: string | null;
  province: string | null;
  fiscal_code: string | null;
  sector: string | null;
  notes: string | null;
  outcome: LeadOutcome;
  call_count: number;
  callback_at: string | null;
};

export type CallSession = { start: string; end: string; active: boolean };

export type QueueCity = { key: string; label: string; n: number };

export type QueueData = {
  cities: QueueCity[];
  session: CallSession;
  lead: QueueLead | null;
  counts: {
    fresh: number;
    due: number;
    waiting: number;
    voicemail: number;
    total: number;
    to_call: number;
    calls: number;
    contacts: number;
    appointments: number;
  };
  now: string;
};

export const fetchQueue = (exclude: string[] = [], focus?: string, cities: string[] = []) => {
  const q = new URLSearchParams();
  if (cities.length) q.set("cities", cities.join(","));
  if (exclude.length) q.set("exclude", exclude.join(","));
  if (focus) q.set("focus", focus);
  const s = q.toString();
  return request<QueueData>(`/leads-queue${s ? `?${s}` : ""}`);
};

export type LeadEdit = {
  first_name?: string;
  last_name?: string;
  phone?: string;
  phone2?: string;
  address?: string;
  house_number?: string;
  street_type?: string;
  city?: string;
  fiscal_code?: string;
  provider?: string;
  notes?: string;
  sector?: string;
};

const work = <T>(payload: Record<string, unknown>) =>
  request<T>("/leads-work", { method: "POST", body: JSON.stringify(payload) });

export const dialLead = (id: string) => work<{ ok: true }>({ action: "dial", id });

export const setLeadOutcome = (
  id: string,
  outcome: "appuntamento" | "da_ricontattare" | "non_interessato" | "segreteria",
  extra: { appointment_at?: string; callback_at?: string; note?: string } = {},
) => work<{ ok: true; callback_at: string | null }>({ action: "outcome", id, outcome, ...extra });

export const editLead = (id: string, fields: LeadEdit) =>
  work<{ ok: true; lead: Partial<QueueLead>; moved_to?: string | null }>({
    action: "edit",
    id,
    ...fields,
  });

export const markWrongNumber = (id: string, reason: "inesistente" | "persona_sbagliata" = "inesistente") =>
  work<{ ok: true }>({ action: "wrong_number", id, reason });
export const undoLeadOutcome = (id: string) => work<{ ok: true }>({ action: "undo", id });
export const setAppointmentResult = (id: string, result: "contratto_chiuso" | "incontrato_con_trattativa" | "incontrato_senza_trattativa" | "annullato") =>
  work<{ ok: true; customer_id: string | null }>({ action: "appointment_result", id, result });

export type AgendaItem = {
  shared: boolean;
  shared_by: string | null; // chi l'ha condiviso con me
  owner_name: string | null; // chi ha creato l'appuntamento
  shared_with: { id: string; name: string; by_me: boolean }[];
  kind: "appuntamento" | "richiamo";
  result_by: string | null; // chi ha esitato, se non e' chi ha creato l'appuntamento
  house_number: string | null;
  street_type: string | null;
  provider: string | null;
  fiscal_code: string | null;
  id: string;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  phone2: string | null;
  address: string | null;
  city: string | null;
  province: string | null;
  sector: string | null;
  notes: string | null;
  appointment_at: string;
  appointment_result: AppointmentResult | null;
  customer_id: string | null;
  anonymized: boolean;
};

export const setCallbackResult = (id: string, result: "contratto_chiuso" | "appuntamento" | "annullato" | "chiamato_senza_trattativa", appointment_at?: string) =>
  work<{ ok: true }>({ action: "callback_result", id, result, ...(appointment_at ? { appointment_at } : {}) });

export const fetchAgenda = (day?: string) =>
  request<{ day: string; items: AgendaItem[]; session: CallSession; now: string }>(`/leads-agenda${day ? `?day=${day}` : ""}`);

export type Colleague = { id: string; first_name: string; last_name: string; role_label: string };
export const fetchColleagues = () => request<{ people: Colleague[] }>("/leads-colleagues");
export const shareLead = (id: string, user_ids: string[]) => work<{ ok: true; shared: number }>({ action: "share", id, user_ids });

export type LeadSettings = { session: CallSession; end_options: string[]; can_edit: boolean };
export const fetchLeadSettings = () => request<LeadSettings>("/leads-settings");
export const saveLeadSettings = (call_end: string) =>
  request<LeadSettings>("/leads-settings", { method: "POST", body: JSON.stringify({ call_end }) });

export type SearchHit = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  city: string | null;
  outcome: LeadOutcome;
};

export const searchLeads = (q: string) => request<{ results: SearchHit[] }>(`/leads-search?q=${encodeURIComponent(q)}`);

export type AgendaFields = LeadEdit & { note?: string };

export const createAgendaItem = (fields: AgendaFields & { appointment_at: string }) =>
  work<{ ok: true; id: string }>({ action: "agenda_create", ...fields });

export const updateAgendaItem = (id: string, fields: AgendaFields & { when?: string }) =>
  work<{ ok: true }>({ action: "agenda_update", id, ...fields });

export const deleteAgendaItem = (id: string) => work<{ ok: true }>({ action: "agenda_delete", id });

/* ---------- Admin ---------- */

export type LeadList = {
  id: string;
  name: string;
  source_filename: string | null;
  created_at: string;
  session_closed_at: string | null;
  purge_after: string | null;
  anonymized_at: string | null;
  total: number;
  assigned: number;
  unassigned: number;
  worked: number;
  appointments: number;
  closed: number;
  with_data: number;
  untreated: number;
};

export type LeadAgent = {
  id: string;
  first_name: string;
  last_name: string;
  role: string;
  to_call: number;
  assigned: number;
};

export type LeadAdminData = {
  lists: LeadList[];
  agents: LeadAgent[];
  cities: { city: string; n: number }[];
  sectors: { sector: string; n: number }[];
  untreated: { total: number; assigned: number; unassigned: number };
  now: string;
};

export const fetchLeadAdmin = () => request<LeadAdminData>("/leads-admin");

const admin = <T>(payload: Record<string, unknown>) =>
  request<T>("/leads-admin-save", { method: "POST", body: JSON.stringify(payload) });

export type ImportRow = {
  first_name: string;
  last_name: string;
  phone: string;
  phone2: string;
  address: string;
  house_number: string;
  street_type: string;
  fiscal_code: string;
  provider: string;
  city: string;
  province: string;
  sector: string;
  notes: string;
};

export const createLeadList = (name: string, filename: string) =>
  admin<{ id: string }>({ action: "create_list", name, filename });

export const addLeadRows = (list_id: string, rows: ImportRow[]) =>
  admin<{ inserted: number; no_phone: number; duplicates: number }>({ action: "add_rows", list_id, rows });

export const assignLeads = (input: {
  mode: "round_robin" | "manual";
  agent_ids: string[];
  list_id?: string;
  city?: string;
  sector?: string;
  count?: number;
}) => admin<{ assigned: number; per_agent: Record<string, number> }>({ action: "assign", ...input });

export const releaseAgentLeads = (agent_id: string, list_id?: string) =>
  admin<{ released: number }>({ action: "unassign", agent_id, list_id });

export const closeLeadSession = (list_id: string) => admin<{ ok: true }>({ action: "close_session", list_id });
export const reopenLeadSession = (list_id: string) => admin<{ ok: true }>({ action: "reopen_session", list_id });
export const purgeLeadList = (list_id: string) => admin<{ anonymized: number }>({ action: "purge_now", list_id });
export const deleteLeadList = (list_id: string) => admin<{ ok: true }>({ action: "delete_list", list_id });
export const deleteWrongLeads = (list_id?: string) => admin<{ deleted: number }>({ action: "delete_wrong", list_id });

export type ControlAgent = {
  id: string;
  first_name: string;
  last_name: string;
  assigned: number;
  to_call: number;
  worked: number;
  dials: number;
  calls: number;
  contacts: number;
  appointments: number;
  closed: number;
  cancelled: number;
  not_interested: number;
  callbacks: number;
  voicemail: number;
  wrong: number;
  moved: number;
  last_activity: string | null;
};

export type ControlData = {
  average: { avg: number; agents: number; total: number };
  session: CallSession;
  end_options: string[];
  day: string;
  agents: ControlAgent[];
  feed: {
    id: number;
    kind: string;
    outcome: string | null;
    sector: string | null;
    created_at: string;
    first_name: string;
    last_name: string;
  }[];
  now: string;
};

export const fetchControlRoom = () => request<ControlData>("/leads-control");

export type ReportCorrection = {
  id: string;
  list_id: string;
  list_name: string;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
  wrong_number: boolean;
  outcome: LeadOutcome;
  orig_data: Record<string, string | null> | null;
  corrected_at: string | null;
  outcome_at: string | null;
  agent_first_name: string | null;
  agent_last_name: string | null;
};

export type ReportData = {
  summary: { outcome: LeadOutcome; n: number }[];
  corrections: ReportCorrection[];
  clean: Record<string, string | null>[];
  by_outcome: Record<string, string | null>[];
};

export const fetchLeadReport = (listId?: string, exportClean = false, outcome?: string) => {
  const q = new URLSearchParams();
  if (listId) q.set("list_id", listId);
  if (exportClean) q.set("export", "clean");
  if (outcome) {
    q.set("export", "outcome");
    q.set("outcome", outcome);
  }
  const s = q.toString();
  return request<ReportData>(`/leads-report${s ? `?${s}` : ""}`);
};
