import { json, logAudit, parseBody, requireUser, route, sql } from "./_shared/auth";
import { UUID_RE } from "./_shared/customers";
import { deleteFile, driveConfigured } from "./_shared/drive";

const norm = (s: string) => s.replace(/\s+/g, " ").trim().toLowerCase();

// Cancella un cliente con TUTTI i suoi dati (task, note, storico, appuntamenti, informative privacy).
// Serve il permesso "customers.delete" e il nome e cognome scritti per conferma.
export const handler = route("POST", async (event) => {
  const auth = await requireUser(event, ["customers.delete"]);
  if ("response" in auth) return auth.response;
  const { user } = auth;

  const body = parseBody(event);
  const id = String(body.id ?? "");
  if (!UUID_RE.test(id)) return json(400, { error: "Cliente non valido" });

  const customer = (await sql`SELECT id, first_name, last_name, drive_folder_id FROM customers WHERE id = ${id}::uuid`)[0];
  if (!customer) return json(404, { error: "Cliente non trovato" });

  const expected = norm(`${customer.first_name} ${customer.last_name}`);
  if (norm(String(body.confirm_name ?? "")) !== expected)
    return json(400, { error: "Il nome e cognome scritti non corrispondono" });

  const privacyDocs = await sql`SELECT drive_file_id FROM privacy_requests WHERE customer_id = ${id}::uuid AND drive_file_id IS NOT NULL`;

  await sql.transaction([
    sql`DELETE FROM calendar_events WHERE customer_id = ${id}::uuid`,
    sql`DELETE FROM customers WHERE id = ${id}::uuid`,
  ]);

  // file su Google Drive: pulizia best-effort (la cartella del cliente contiene i PDF delle informative)
  if (driveConfigured()) {
    for (const d of privacyDocs) if (d.drive_file_id) await deleteFile(d.drive_file_id as string);
    if (customer.drive_folder_id) await deleteFile(customer.drive_folder_id as string);
  }

  await logAudit(user.id, "cliente_eliminato", "customers", id, { nome: `${customer.first_name} ${customer.last_name}` });
  return json(200, { ok: true });
});
