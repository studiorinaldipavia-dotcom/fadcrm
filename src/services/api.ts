// src/services/api.ts
// Tutte le chiamate al backend passano da qui. Nessun segreto nel frontend.

const API_BASE_URL = import.meta.env.VITE_API_URL || "/api";

/** Nome visibile di ogni ruolo. Si aggiorna con i ruoli creati dall'amministratore. */
export const roleLabels: Record<string, string> = {
  agente: "Agente",
  trainer: "Trainer",
  segreteria: "Segreteria",
  manager: "Manager",
  amministratore: "Amministratore",
};

export function registerRoles(list: { key: string; label: string }[] | undefined) {
  for (const r of list ?? []) roleLabels[r.key] = r.label;
}

export type SessionUser = {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  role: string;
  role_label?: string;
  theme: "light" | "dark";
  office_id: string | null;
  photo_url: string | null;
  must_change_password: boolean;
  permissions: string[];
};

export async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    credentials: "same-origin",
  });
  let data: any = null;
  try {
    data = await response.json();
  } catch {
    /* risposta senza contenuto */
  }
  if (!response.ok) {
    const error = new Error(data?.error || "Errore di comunicazione con il server");
    (error as any).status = response.status;
    throw error;
  }
  return data as T;
}

/* ---------- Accesso ---------- */

export async function getStatus(): Promise<{ needsSetup: boolean }> {
  return request("/auth-status");
}

export async function setupAdmin(input: {
  token: string;
  first_name: string;
  last_name: string;
  email: string;
  password: string;
}) {
  return request<{ ok: true }>("/auth-setup", { method: "POST", body: JSON.stringify(input) });
}

export async function login(email: string, password: string, remember: boolean) {
  const data = await request<{ user: SessionUser }>("/auth-login", {
    method: "POST",
    body: JSON.stringify({ email, password, remember }),
  });
  if (data.user.role_label) roleLabels[data.user.role] = data.user.role_label
  return data.user;
}

/** Ritorna l'utente collegato, oppure null se non c'e' una sessione valida */
export async function getMe(): Promise<SessionUser | null> {
  try {
    const data = await request<{ user: SessionUser; roles?: { key: string; label: string }[] }>("/auth-me");
    registerRoles(data.roles)
    if (data.user.role_label) roleLabels[data.user.role] = data.user.role_label
    return data.user;
  } catch (error: any) {
    if (error?.status === 401) return null;
    throw error;
  }
}

export async function logout() {
  await request("/auth-logout", { method: "POST" });
}

export async function saveTheme(theme: "light" | "dark") {
  await request("/auth-theme", { method: "POST", body: JSON.stringify({ theme }) });
}

export async function changePassword(currentPassword: string, newPassword: string) {
  await request("/auth-change-password", {
    method: "POST",
    body: JSON.stringify({ currentPassword, newPassword }),
  });
}

/* ---------- Agenti e permessi (solo amministratore) ---------- */

export type Agent = {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  phone: string | null;
  office_id: string | null;
  office_name: string | null;
  role: string;
  status: "attivo" | "sospeso";
  hire_date: string | null;
  must_change_password: boolean;
};

export type AgentsData = {
  agents: Agent[];
  offices: { id: string; name: string }[];
  permissions: { key: string; description: string }[];
  rolePermissions: { role: string; permission_key: string }[];
  overrides: { user_id: string; permission_key: string; granted: boolean }[];
  roles: RoleInfo[];
};

export type RoleInfo = { key: string; label: string; is_system: boolean; users: number };

export async function fetchAgents(): Promise<AgentsData> {
  const data = await request<AgentsData>("/agents");
  registerRoles(data.roles);
  return data;
}

export async function deleteAgent(id: string, confirm_name: string) {
  return request<{ ok: true }>("/agents-delete", { method: "POST", body: JSON.stringify({ id, confirm_name }) });
}

const roleCall = <T>(payload: Record<string, unknown>) =>
  request<T>("/roles-save", { method: "POST", body: JSON.stringify(payload) });

export const createRole = (input: { label: string; copy_from?: string }) =>
  roleCall<{ ok: true; key: string }>({ action: "create", ...input });
export const updateRole = (key: string, label: string) =>
  roleCall<{ ok: true }>({ action: "update", key, label });
export const setRolePermissions = (key: string, permissions: string[]) =>
  roleCall<{ ok: true }>({ action: "set_permissions", key, permissions });
export const deleteRole = (key: string) => roleCall<{ ok: true }>({ action: "delete", key });

export type AgentInput = {
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  office_id: string;
  role: string;
  status: string;
  hire_date: string;
};

export async function createAgent(input: AgentInput) {
  return request<{ id: string; tempPassword: string }>("/agents-save", {
    method: "POST",
    body: JSON.stringify({ action: "create", ...input }),
  });
}

export async function updateAgent(id: string, input: AgentInput) {
  return request<{ ok: true }>("/agents-save", {
    method: "POST",
    body: JSON.stringify({ action: "update", id, ...input }),
  });
}

export async function resetAgentPassword(id: string) {
  return request<{ tempPassword: string }>("/agents-save", {
    method: "POST",
    body: JSON.stringify({ action: "reset_password", id }),
  });
}

export async function setAgentPermissions(id: string, overrides: Record<string, boolean | null>) {
  return request<{ ok: true }>("/agents-save", {
    method: "POST",
    body: JSON.stringify({ action: "set_permissions", id, overrides }),
  });
}

/* ---------- Clienti ---------- */

export type CustomerRow = {
  id: string;
  first_name: string;
  last_name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  city: string | null;
  province: string | null;
  status: "OK" | "NR" | "KO";
  agent_id: string | null;
  agent_name: string | null;
  created_at: string;
};

export async function fetchCustomers(): Promise<CustomerRow[]> {
  return request("/customers");
}

export type PrivacyRow = {
  id: string;
  status: "inviata" | "firmata";
  method: "digitale" | "caricata";
  email: string | null;
  sent_at: string;
  expires_at: string | null;
  expired: boolean | null;
  signed_at: string | null;
  consent_marketing: boolean | null;
  consent_third_parties: boolean | null;
  has_pdf: boolean;
};

export type CustomerDetailData = {
  customer: {
    id: string;
    first_name: string;
    last_name: string;
    fiscal_code: string | null;
    privacy_marketing: boolean | null;
    privacy_third_parties: boolean | null;
    privacy_signed_at: string | null;
    phone: string | null;
    email: string | null;
    address: string | null;
    city: string | null;
    province: string | null;
    interests: string[];
    status: "OK" | "NR" | "KO";
    agent_id: string | null;
    agent_name: string | null;
    agent_last_name: string | null;
    created_at: string;
    updated_at: string;
  };
  notes: {
    id: string;
    body: string;
    created_at: string;
    author_name: string | null;
    author_last_name: string | null;
  }[];
  history: {
    id: string;
    event_type: string;
    description: string;
    created_at: string;
    actor_name: string | null;
    actor_last_name: string | null;
  }[];
  privacy: PrivacyRow[];
  shared_agents: { id: string; first_name: string; last_name: string }[];
  tasks: {
    id: string;
    kind: TaskKind;
    title: string;
    status: TaskStatus;
    due_date: string | null;
    agent_first_name: string;
    agent_last_name: string;
  }[];
  can_edit: boolean;
  can_add_agents: boolean;
};

export async function fetchCustomer(id: string): Promise<CustomerDetailData> {
  return request(`/customer?id=${encodeURIComponent(id)}`);
}

export type CustomerMeta = {
  products: string[];
  agents: { id: string; first_name: string; last_name: string }[];
  /** agenti che si possono aggiungere al cliente (vuoto se non hai il permesso) */
  share_agents: { id: string; first_name: string; last_name: string }[];
  /** solo chi puo' modificare tutti i clienti puo' anche togliere agenti */
  can_remove_agents: boolean;
};

export async function fetchCustomerMeta(): Promise<CustomerMeta> {
  return request("/customers-meta");
}

export type CustomerInput = {
  first_name: string;
  last_name: string;
  fiscal_code: string;
  phone: string;
  email: string;
  address: string;
  city: string;
  province: string;
  interests: string[];
  status: "OK" | "NR" | "KO";
  agent_id: string;
  shared_agent_ids: string[];
  reminder_11m: boolean;
  notes?: string;
};

export async function createCustomer(input: CustomerInput) {
  return request<{ id: string }>("/customers-save", {
    method: "POST",
    body: JSON.stringify({ action: "create", ...input }),
  });
}

export async function addCustomerAgents(id: string, agentIds: string[]) {
  return request<{ ok: true; added: number }>("/customers-save", {
    method: "POST",
    body: JSON.stringify({ action: "add_agents", id, agent_ids: agentIds }),
  });
}

export async function updateCustomer(id: string, input: CustomerInput) {
  return request<{ ok: true }>("/customers-save", {
    method: "POST",
    body: JSON.stringify({ action: "update", id, ...input }),
  });
}

export async function deleteCustomer(id: string, confirm_name: string) {
  return request<{ ok: true }>("/customers-delete", {
    method: "POST",
    body: JSON.stringify({ id, confirm_name }),
  });
}

export async function setCustomerStatus(id: string, status: "OK" | "NR" | "KO") {
  return request<{ ok: true }>("/customers-save", {
    method: "POST",
    body: JSON.stringify({ action: "set_status", id, status }),
  });
}

export async function addCustomerNote(id: string, body: string) {
  return request<{ ok: true }>("/customers-save", {
    method: "POST",
    body: JSON.stringify({ action: "add_note", id, body }),
  });
}

/* ---------- Segreteria: task (KO da recuperare e task manuali) ---------- */

export type TaskKind = "ko" | "manuale";
export type TaskStatus = "aperta" | "completata" | "non_recuperabile";

export type TaskRow = {
  id: string;
  kind: TaskKind;
  title: string;
  details: string | null;
  due_date: string | null;
  status: TaskStatus;
  closed_note: string | null;
  closed_at: string | null;
  created_at: string;
  overdue: boolean;
  customer_id: string;
  customer_first_name: string;
  customer_last_name: string;
  customer_phone: string | null;
  customer_city: string | null;
  agent_id: string;
  agent_first_name: string;
  agent_last_name: string;
  creator_first_name: string | null;
  creator_last_name: string | null;
  closer_first_name: string | null;
  closer_last_name: string | null;
};

export async function fetchTasks(): Promise<{ rows: TaskRow[]; can_manage: boolean }> {
  return request("/tasks");
}

export type TaskMeta = {
  customers: { id: string; first_name: string; last_name: string; city: string | null; agents: { id: string; name: string }[] }[];
};

export async function fetchTaskMeta(): Promise<TaskMeta> {
  return request("/tasks-meta");
}

export type TaskInput = {
  kind: TaskKind;
  customer_id: string;
  agent_id: string;
  title: string;
  details: string;
  due_date: string;
};

const taskCall = <T>(payload: Record<string, unknown>) =>
  request<T>("/tasks-save", { method: "POST", body: JSON.stringify(payload) });

export const createTask = (input: TaskInput) => taskCall<{ id: string }>({ action: "create", ...input });
export const updateTask = (id: string, input: { title: string; details: string; due_date: string; agent_id: string }) =>
  taskCall<{ ok: true }>({ action: "update", id, ...input });
export const completeTask = (id: string, note: string) => taskCall<{ ok: true }>({ action: "complete", id, note });
export const markTaskLost = (id: string, note: string) => taskCall<{ ok: true }>({ action: "lost", id, note });
export const reopenTask = (id: string) => taskCall<{ ok: true }>({ action: "reopen", id });
export const deleteTask = (id: string) => taskCall<{ ok: true }>({ action: "delete", id });

/* ---------- Performance, coaching, dashboard ---------- */

export type StatTotals = {
  chiamate: number;
  con_trattativa: number;
  senza_trattativa: number;
  contatti: number;
  fissati: number;
  visti: number;
  chiusi: number;
  pacchi: number;
  visti_non_chiusi: number;
};

export type Insight = { level: "red" | "yellow" | "green"; area: string; title: string; text: string };

export type StatsData = {
  insights: { agent_id: string; name: string; items: Insight[] }[];
  day_detail: { manual: Record<string, number>; auto: Record<string, number> } | null;
  totals: StatTotals;
  byAgent: (StatTotals & { agent_id: string; first_name: string; last_name: string; giorni: number })[];
  byDay: (StatTotals & { date: string })[];
  agents: { id: string; first_name: string; last_name: string }[];
  offices: { id: string; name: string }[];
  entry_agents: { id: string; first_name: string; last_name: string }[];
  can_enter_others: boolean;
  can_view_all: boolean;
};

export async function fetchStats(params: {
  from: string;
  to: string;
  agent_id?: string;
  office_id?: string;
  for_entry?: boolean;
}): Promise<StatsData> {
  const query = new URLSearchParams({ from: params.from, to: params.to });
  if (params.agent_id) query.set("agent_id", params.agent_id);
  if (params.office_id) query.set("office_id", params.office_id);
  if (params.for_entry) query.set("for_entry", "1");
  return request(`/stats?${query.toString()}`);
}

export type StatsInput = {
  date: string;
  agent_id?: string;
  contatti: number;
  fissati: number;
  chiusi: number; // contratti conclusi
  con_trattativa: number;
  senza_trattativa: number;
  pacchi: number;
};

export async function saveStats(input: StatsInput) {
  return request<{ ok: true }>("/stats-save", { method: "POST", body: JSON.stringify(input) });
}

export type Light = "green" | "yellow" | "red";

export type CoachingData = {
  team_conversion: number | null;
  agents: {
    agent_id: string;
    name: string;
    totals: { contatti: number; fissati: number; visti: number; chiusi: number };
    lights: Record<"contatti" | "fissati" | "visti" | "chiusi", Light>;
    conversion: number | null;
    weak_area: string | null;
    weeks: { contatti: number; chiusi: number; conversion: number | null }[];
  }[];
};

export async function fetchCoaching(): Promise<CoachingData> {
  return request("/coaching");
}

export type DashboardData = {
  range: string;
  from: string;
  to: string;
  customers: { total: number; recent: number };
  tasks: { ko_open: number; manual_open: number; overdue: number; ko_recovered: number };
  stats: { contatti: number; fissati: number; visti: number; chiusi: number };
  closing_rate: number | null;
  avg_appointments: { avg: number; agents: number; total: number } | null;
  recent: {
    id: string;
    kind: TaskKind;
    title: string;
    status: TaskStatus;
    due_date: string | null;
    updated_at: string;
    customer_first_name: string;
    customer_last_name: string;
    agent_first_name: string;
    agent_last_name: string;
  }[];
  attention: { key: string; title: string; detail: string; tone: string; icon: string; target: string }[];
  coaching: CoachingData | null;
  ctes: DashboardCte[];
};

export type DashboardCte = {
  id: string;
  product_name: string;
  product_category: string | null;
  title: string;
  cost: number | null;
  fixed_cost: number | null;
  kwh_cost: number | null;
  smc_cost: number | null;
  notes: string | null;
};

export async function fetchDashboard(range: "week" | "month" | "quarter"): Promise<DashboardData> {
  return request(`/dashboard?range=${range}`);
}

/* ---------- Calendario ---------- */

export type CalendarEvent = {
  id: string;
  title: string;
  starts_at: string;
  ends_at: string | null;
  notes: string | null;
  agent_id: string;
  agent_name: string;
  customer_id: string | null;
  customer_first_name: string | null;
  customer_last_name: string | null;
  manager_id: string | null;
  manager_name: string | null;
};

export type CalendarData = {
  events: CalendarEvent[];
  people: { id: string; first_name: string; last_name: string }[];
  can_view_all: boolean;
};

export async function fetchCalendar(fromIso: string, toIso: string, agentId?: string): Promise<CalendarData> {
  const query = new URLSearchParams({ from: fromIso, to: toIso });
  if (agentId) query.set("agent_id", agentId);
  return request(`/calendar?${query.toString()}`);
}

export type CalendarInput = {
  title: string;
  starts_at: string;
  ends_at: string;
  notes: string;
  customer_id: string;
  agent_id: string;
  manager_id: string;
};

export async function createCalendarEvent(input: CalendarInput) {
  return request<{ id: string }>("/calendar-save", {
    method: "POST",
    body: JSON.stringify({ action: "create", ...input }),
  });
}

export async function updateCalendarEvent(id: string, input: CalendarInput) {
  return request<{ ok: true }>("/calendar-save", {
    method: "POST",
    body: JSON.stringify({ action: "update", id, ...input }),
  });
}

export async function deleteCalendarEvent(id: string) {
  return request<{ ok: true }>("/calendar-save", {
    method: "POST",
    body: JSON.stringify({ action: "delete", id }),
  });
}

/* ---------- Mappa ---------- */

export type MapCustomer = {
  id: string;
  first_name: string;
  last_name: string;
  address: string | null;
  city: string | null;
  province: string | null;
  phone: string | null;
  interests: string[];
  status: "OK" | "NR" | "KO";
  latitude: number;
  longitude: number;
  agent_name: string | null;
};

export type MapData = {
  customers: MapCustomer[];
  pending: number;
  unplaced: number;
  agents: { id: string; first_name: string; last_name: string }[];
  offices: { id: string; name: string }[];
  products: string[];
  can_view_all: boolean;
};

export async function fetchMap(filters: {
  agent_id?: string;
  office_id?: string;
  product?: string;
  status?: string;
}): Promise<MapData> {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) if (value) query.set(key, value);
  return request(`/map?${query.toString()}`);
}

export async function geocodePending() {
  return request<{ found: number; failed: number; remaining: number }>("/map-geocode", { method: "POST" });
}

/* ---------- Recupero, prodotti, uffici, impostazioni, audit ---------- */

export async function recoverAdmin(input: { token: string; email: string; newPassword: string }) {
  return request<{ ok: true }>("/auth-recovery", { method: "POST", body: JSON.stringify(input) });
}

export type ProductRow = {
  id: string;
  name: string;
  category: string | null;
  description: string | null;
  is_active: boolean;
  sort_order: number;
  customers: number;
  ctes: CteRow[];
};

export type CteRow = {
  id: string;
  title: string;
  cost: number | null;
  fixed_cost: number | null;
  kwh_cost: number | null;
  smc_cost: number | null;
  notes: string | null;
  is_active: boolean;
  sort_order: number;
};

export type CteInput = {
  title: string;
  cost: string;
  fixed_cost: string;
  kwh_cost: string;
  smc_cost: string;
  notes: string;
  is_active: boolean;
  sort_order: number;
};

export async function saveCte(input: CteInput, target: { productId: string } | { id: string }) {
  return request<{ ok?: true; id?: string }>("/ctes-save", {
    method: "POST",
    body: JSON.stringify("id" in target ? { action: "update", id: target.id, ...input } : { action: "create", product_id: target.productId, ...input }),
  });
}

export async function deleteCte(id: string) {
  return request<{ ok: true }>("/ctes-save", { method: "POST", body: JSON.stringify({ action: "delete", id }) });
}

export type ProductInput = {
  name: string;
  category: string;
  description: string;
  is_active: boolean;
  sort_order: number;
};

export async function fetchProducts(): Promise<ProductRow[]> {
  return request("/products");
}

export async function saveProduct(input: ProductInput, id?: string) {
  return request<{ ok?: true; id?: string }>("/products-save", {
    method: "POST",
    body: JSON.stringify(id ? { action: "update", id, ...input } : { action: "create", ...input }),
  });
}

export type OfficeRow = { id: string; name: string; city: string | null; agents: number; customers: number };

export async function fetchOffices(): Promise<OfficeRow[]> {
  return request("/offices");
}

export async function saveOffice(input: { name: string; city: string }, id?: string) {
  return request<{ ok?: true; id?: string }>("/offices-save", {
    method: "POST",
    body: JSON.stringify(id ? { action: "update", id, ...input } : { action: "create", ...input }),
  });
}

export type DriveStatus = {
  configured: boolean;
  ok: boolean;
  missing?: string[];
  folder_name?: string;
  mode?: string;
  message?: string | null;
};

export async function fetchDriveStatus(): Promise<DriveStatus> {
  return request("/drive-status");
}

export type AuditRow = {
  id: number;
  action: string;
  entity: string;
  entity_id: string | null;
  details: Record<string, any> | null;
  created_at: string;
  actor_name: string | null;
  actor_last_name: string | null;
};

export async function fetchAudit(): Promise<AuditRow[]> {
  return request("/audit");
}

/* ---------- Informativa privacy ---------- */

export async function sendPrivacy(customerId: string, mode: "email" | "link") {
  return request<{ link: string; emailed: boolean; email: string | null }>("/privacy-send", {
    method: "POST",
    body: JSON.stringify({ customer_id: customerId, mode }),
  });
}

export const privacyPdfUrl = (id: string) => `${API_BASE_URL}/privacy-open?id=${encodeURIComponent(id)}`;

const fileToBase64 = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve((reader.result as string).split(",")[1]);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });

export async function uploadSignedPrivacy(input: {
  customer_id: string;
  signed_at: string;
  consent_marketing: boolean;
  consent_third_parties: boolean;
  file: File;
}) {
  return request<{ id: string }>("/privacy-upload", {
    method: "POST",
    body: JSON.stringify({
      customer_id: input.customer_id,
      signed_at: input.signed_at,
      consent_marketing: input.consent_marketing,
      consent_third_parties: input.consent_third_parties,
      mimeType: input.file.type,
      fileBase64: await fileToBase64(input.file),
    }),
  });
}

/* Pagina pubblica di firma (senza login) */

export type PrivacyBlock =
  | { type: "title" | "h" | "p" | "declaration"; text: string }
  | { type: "consent"; id: "marketing" | "third"; text: string };

export type PrivacyView =
  | { state: "invalid" | "expired" | "signed" | "replaced" }
  | { state: "pending"; name: string; blocks: PrivacyBlock[] };

export async function viewPrivacy(token: string): Promise<PrivacyView> {
  return request("/privacy-view", { method: "POST", body: JSON.stringify({ token }) });
}

export async function signPrivacy(input: {
  token: string;
  consent_marketing: boolean;
  consent_third_parties: boolean;
}) {
  return request<{ ok: true; code: string; when: string }>("/privacy-sign", {
    method: "POST",
    body: JSON.stringify({ ...input, accept: true }),
  });
}

/* ---------- Notifiche ---------- */

export type AppNotification = {
  id: string;
  kind: string;
  title: string;
  body: string | null;
  link: string | null;
  created_at: string;
  read_at: string | null;
};

export const fetchNotifications = () => request<{ items: AppNotification[]; unread: number }>("/notifications");
export const markNotificationRead = (id: string) =>
  request<{ items: AppNotification[]; unread: number }>("/notifications", { method: "POST", body: JSON.stringify({ action: "read", id }) });
export const markAllNotificationsRead = () =>
  request<{ items: AppNotification[]; unread: number }>("/notifications", { method: "POST", body: JSON.stringify({ action: "read_all" }) });


/* ---------- Classifica ---------- */

export type LeaderRow = { agent_id: string; name: string; chiusi: number; visti: number; fissati: number; contatti: number; rate: number };
export type LeaderboardData = { period: "day" | "week"; by_contracts: LeaderRow[]; by_rate: LeaderRow[]; agents: number };

export const fetchLeaderboard = (period: "day" | "week") => request<LeaderboardData>(`/leaderboard?period=${period}`);
