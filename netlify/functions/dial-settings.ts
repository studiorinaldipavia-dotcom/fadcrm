import { json, parseBody, requireUser, route, sql } from "./_shared/auth";
import { getDialConfig } from "./_shared/leads";

// Modalita' di chiamata PERSONALE: ogni utente sceglie se chiamare dal telefono (tel:) o con il VoIP.
// Il collegamento VoIP lo imposta l'amministratore (leads-settings); qui si sceglie solo se usarlo.
export const handler = route(["GET", "POST"], async (event) => {
  const auth = await requireUser(event);
  if ("response" in auth) return auth.response;
  const { user } = auth;

  if (event.httpMethod === "POST") {
    const mode = String(parseBody(event).mode ?? "");
    if (mode !== "tel" && mode !== "voip") return json(400, { error: "Modalità non valida" });
    if (mode === "voip" && !(await getDialConfig()).available) {
      return json(400, { error: "Il VoIP non è ancora configurato: chiedi all'amministratore di impostare il collegamento" });
    }
    await sql`
      INSERT INTO leadhub_settings (key, value, updated_by, updated_at) VALUES (${`dial_user:${user.id}`}, ${mode}, ${user.id}::uuid, now())
      ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_by = EXCLUDED.updated_by, updated_at = now()`;
  }
  return json(200, await getDialConfig(user.id));
});
