import { json, requireUser, route, sql } from "./_shared/auth";

// Colleghi con cui si puo' condividere un appuntamento: agenti attivi che usano LeadHub (escluso se stessi).
export const handler = route("GET", async (event) => {
  const auth = await requireUser(event, ["leads.work"]);
  if ("response" in auth) return auth.response;
  const { user } = auth;

  const people = await sql`
    SELECT u.id, u.first_name, u.last_name, coalesce(r.label, u.role) AS role_label
    FROM users u LEFT JOIN roles r ON r.key = u.role
    WHERE u.status = 'attivo' AND u.id <> ${user.id}::uuid AND (
      EXISTS (SELECT 1 FROM user_permissions up WHERE up.user_id = u.id AND up.permission_key = 'leads.work' AND up.granted)
      OR (EXISTS (SELECT 1 FROM role_permissions rp WHERE rp.role = u.role AND rp.permission_key = 'leads.work')
          AND NOT EXISTS (SELECT 1 FROM user_permissions up WHERE up.user_id = u.id AND up.permission_key = 'leads.work' AND NOT up.granted)))
    ORDER BY u.first_name, u.last_name`;
  return json(200, { people });
});
