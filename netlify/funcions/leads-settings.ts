import { json, logAudit, parseBody, requireUser, route, sql } from "./_shared/auth";
import { CALL_END_OPTIONS, getCallWindow } from "./_shared/leads";

// Orario della Call Mode. Tutti quelli che usano LeadHub lo leggono; solo "leads.manage" lo cambia.
export const handler = route(["GET", "POST"], async (event) => {
  const auth = await requireUser(event, ["leads.work", "leads.manage"]);
  if ("response" in auth) return auth.response;
  const { user } = auth;
  const canEdit = user.permissions.includes("leads.manage");

  if (event.httpMethod === "POST") {
    if (!canEdit) return json(403, { error: "Non hai il permesso per cambiare l'orario" });
    const end = String(parseBody(event).call_end ?? "");
    if (!(CALL_END_OPTIONS as readonly string[]).includes(end)) return json(400, { error: "Orario non valido" });
    await sql`
      INSERT INTO leadhub_settings (key, value, updated_by, updated_at) VALUES ('call_end', ${end}, ${user.id}::uuid, now())
      ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_by = EXCLUDED.updated_by, updated_at = now()`;
    await logAudit(user.id, "leadhub_orario_modificato", "leadhub_settings", null, { call_end: end });
  }
  return json(200, { session: await getCallWindow(), end_options: CALL_END_OPTIONS, can_edit: canEdit });
});
