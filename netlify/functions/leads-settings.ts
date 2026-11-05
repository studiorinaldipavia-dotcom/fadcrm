import { json, logAudit, parseBody, requireUser, route, sql } from "./_shared/auth";
import { CALL_END_OPTIONS, getCallWindow, getDialConfig, validDialTemplate } from "./_shared/leads";

const save = (key: string, value: string, userId: string) => sql`
  INSERT INTO leadhub_settings (key, value, updated_by, updated_at) VALUES (${key}, ${value}, ${userId}::uuid, now())
  ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_by = EXCLUDED.updated_by, updated_at = now()`;

// Impostazioni della Call Mode (orario e modalita' di chiamata). Le leggono tutti quelli che usano LeadHub; solo "leads.manage" le cambia.
export const handler = route(["GET", "POST"], async (event) => {
  const auth = await requireUser(event, ["leads.work", "leads.manage"]);
  if ("response" in auth) return auth.response;
  const { user } = auth;
  const canEdit = user.permissions.includes("leads.manage");

  if (event.httpMethod === "POST") {
    if (!canEdit) return json(403, { error: "Non hai il permesso per cambiare le impostazioni" });
    const body = parseBody(event);

    if ("call_end" in body) {
      const end = String(body.call_end ?? "");
      if (!(CALL_END_OPTIONS as readonly string[]).includes(end)) return json(400, { error: "Orario non valido" });
      await save("call_end", end, user.id);
      await logAudit(user.id, "leadhub_orario_modificato", "leadhub_settings", null, { call_end: end });
    }

    if ("dial_mode" in body) {
      const mode = body.dial_mode === "voip" ? "voip" : "tel";
      const template = String(body.voip_template ?? "").trim();
      const prefix = String(body.voip_prefix ?? "").replace(/\s+/g, "");
      if (mode === "voip" && !validDialTemplate(template)) {
        return json(400, { error: "Il collegamento VoIP deve contenere {numero} e iniziare con sip:, callto:, tel: oppure https://" });
      }
      if (!/^\+?\d{0,6}$/.test(prefix)) return json(400, { error: "Il prefisso deve essere del tipo +39" });
      await save("dial_mode", mode, user.id);
      await save("voip_template", template, user.id);
      await save("voip_prefix", prefix, user.id);
      await logAudit(user.id, "leadhub_chiamata_modificata", "leadhub_settings", null, { mode, template, prefix });
    }
  }
  const [session, dial] = await Promise.all([getCallWindow(), getDialConfig()]);
  return json(200, { session, dial, end_options: CALL_END_OPTIONS, can_edit: canEdit });
});
