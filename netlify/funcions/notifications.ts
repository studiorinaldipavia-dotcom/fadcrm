import { json, parseBody, requireUser, route, sql } from "./_shared/auth";
import { UUID_RE } from "./_shared/customers";
import { generateReminders } from "./_shared/notifications";

// Notifiche dell'utente collegato (tutti gli utenti): elenco, segna come letta, segna tutte.
export const handler = route(["GET", "POST"], async (event) => {
  const auth = await requireUser(event);
  if ("response" in auth) return auth.response;
  const { user } = auth;

  if (event.httpMethod === "POST") {
    const body = parseBody(event);
    if (body.action === "read_all") {
      await sql`UPDATE notifications SET read_at = now() WHERE user_id = ${user.id}::uuid AND read_at IS NULL`;
    } else if (body.action === "read" && UUID_RE.test(String(body.id ?? ""))) {
      await sql`UPDATE notifications SET read_at = now() WHERE id = ${String(body.id)}::uuid AND user_id = ${user.id}::uuid AND read_at IS NULL`;
    } else {
      return json(400, { error: "Azione non valida" });
    }
  } else {
    // promemoria "al volo": funzionano anche se la funzione programmata non e' ancora girata
    await generateReminders(user.id);
  }

  const items = await sql`
    SELECT id, kind, title, body, link, created_at, read_at
    FROM notifications WHERE user_id = ${user.id}::uuid
    ORDER BY created_at DESC LIMIT 40`;
  const unread = (await sql`SELECT count(*)::int AS n FROM notifications WHERE user_id = ${user.id}::uuid AND read_at IS NULL`)[0].n;
  return json(200, { items, unread });
});
