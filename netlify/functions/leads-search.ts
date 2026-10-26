import { rateLimit, json, requireUser, route, sql } from "./_shared/auth";

// Ricerca tra i lead dell'agente (chiamati e da chiamare): per numero (anche le ultime cifre, minimo 3)
// oppure per nome/cognome (minimo 2 lettere). Al massimo 8 risultati, solo i SUOI contatti.
// Storico leggero: i contatti gia' lavorati si trovano per una settimana; poi spariscono dalla ricerca
// (restano nelle liste, che si scaricano dal Report).
export const handler = route("GET", async (event) => {
  const auth = await requireUser(event, ["leads.work"]);
  if ("response" in auth) return auth.response;
  if (!(await rateLimit(`leadsearch:${auth.user.id}`, 120, 60))) return json(429, { error: "Troppe richieste. Riprova tra un minuto." });
  const { user } = auth;

  const text = String(event.queryStringParameters?.q ?? "").trim().slice(0, 60);
  const isNumber = /^[\d\s+()./-]+$/.test(text);

  if (isNumber) {
    const digits = text.replace(/\D/g, "").slice(0, 15);
    if (digits.length < 3) return json(200, { results: [] });
    const results = await sql`
      SELECT id, first_name, last_name, phone, city, outcome::text AS outcome
      FROM leads
      WHERE assigned_to = ${user.id}::uuid AND anonymized_at IS NULL AND (phone IS NOT NULL OR phone2 IS NOT NULL)
        AND (position(${digits}::text in regexp_replace(coalesce(phone, ''), '\\D', '', 'g')) > 0
             OR position(${digits}::text in regexp_replace(coalesce(phone2, ''), '\\D', '', 'g')) > 0)
      ORDER BY (right(regexp_replace(phone, '\\D', '', 'g'), ${digits.length}::int) = ${digits}::text) DESC, last_name, first_name
      LIMIT 8`;
    return json(200, { results });
  }

  if (text.length < 2) return json(200, { results: [] });
  const like = "%" + text.replace(/[\\%_]/g, (c) => "\\" + c) + "%";
  const results = await sql`
    SELECT id, first_name, last_name, phone, city, outcome::text AS outcome
    FROM leads
    WHERE assigned_to = ${user.id}::uuid AND anonymized_at IS NULL
      AND (outcome = 'nuovo' OR outcome_at >= now() - interval '7 days')
      AND (coalesce(first_name, '') || ' ' || coalesce(last_name, '') ILIKE ${like}
           OR coalesce(last_name, '') || ' ' || coalesce(first_name, '') ILIKE ${like})
    ORDER BY last_name, first_name
    LIMIT 8`;
  return json(200, { results });
});
