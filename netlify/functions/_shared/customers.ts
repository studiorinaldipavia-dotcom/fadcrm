import { sql, type SessionUser } from "./auth";

export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// "Proprio" = sei l'agente responsabile oppure un agente aggiunto al cliente (sharedIds)
const isOwn = (user: SessionUser, agentId: string | null, sharedIds?: string[] | null) =>
  agentId === user.id || (sharedIds ?? []).includes(user.id);

export function canViewCustomer(user: SessionUser, agentId: string | null, sharedIds?: string[] | null): boolean {
  if (user.permissions.includes("customers.view_all")) return true;
  return user.permissions.includes("customers.view_own") && isOwn(user, agentId, sharedIds);
}

export function canEditCustomer(user: SessionUser, agentId: string | null, sharedIds?: string[] | null): boolean {
  if (user.permissions.includes("customers.edit_all")) return true;
  return user.permissions.includes("customers.edit_own") && isOwn(user, agentId, sharedIds);
}

export async function addHistory(
  customerId: string,
  actorId: string,
  eventType: string,
  description: string,
) {
  await sql`
    INSERT INTO customer_history (customer_id, actor_id, event_type, description)
    VALUES (${customerId}, ${actorId}, ${eventType}, ${description})
  `;
}
