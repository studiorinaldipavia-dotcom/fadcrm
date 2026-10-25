import { json, logAudit, requireUser, route, sql } from "./_shared/auth";
import { geocode, sleep } from "./_shared/geocode";

// Posiziona sulla mappa i clienti che hanno un indirizzo ma non ancora le coordinate.
// Poche richieste per volta (limite di Nominatim: 1 al secondo); il frontend la richiama finche' ce ne sono.
export const handler = route("POST", async (event) => {
  const auth = await requireUser(event, ["map.view_all"]);
  if ("response" in auth) return auth.response;

  const started = Date.now();
  const batch = await sql`
    SELECT id, address, city, province FROM customers
    WHERE latitude IS NULL AND NOT geocode_failed AND coalesce(trim(address), '') <> ''
    ORDER BY created_at LIMIT 4`;

  let found = 0;
  let failed = 0;
  for (const row of batch) {
    if (Date.now() - started > 7500) break;
    const point = await geocode(row.address, row.city, row.province);
    if (point) {
      await sql`UPDATE customers SET latitude = ${point.lat}, longitude = ${point.lng} WHERE id = ${row.id}`;
      found++;
    } else {
      await sql`UPDATE customers SET geocode_failed = true WHERE id = ${row.id}`;
      failed++;
    }
    await sleep(1100);
  }

  const remaining = (
    await sql`
      SELECT count(*)::int AS n FROM customers
      WHERE latitude IS NULL AND NOT geocode_failed AND coalesce(trim(address), '') <> ''`
  )[0].n;
  if (found + failed > 0) await logAudit(auth.user.id, "clienti_geolocalizzati", "customers", null, { found, failed });
  return json(200, { found, failed, remaining });
});
