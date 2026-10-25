import { json, route, sql } from "./_shared/auth";

// Dice al frontend se il CRM e' al primo avvio (nessun utente ancora creato)
export const handler = route("GET", async () => {
  const rows = await sql`SELECT count(*)::int AS n FROM users`;
  return json(200, { needsSetup: rows[0].n === 0 });
});
