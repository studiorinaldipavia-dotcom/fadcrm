import { json, requireUser, route, sql } from "./_shared/auth";
import { UUID_RE } from "./_shared/customers";

// Report e pulizia: correzioni fatte dagli agenti, numeri segnalati, esiti per lista, dati puliti da esportare.
export const handler = route("GET", async (event) => {
  const auth = await requireUser(event, ["leads.manage"]);
  if ("response" in auth) return auth.response;

  const q = event.queryStringParameters ?? {};
  const listId = q.list_id && UUID_RE.test(q.list_id) ? q.list_id : null;

  const summary = await sql`
    SELECT outcome::text AS outcome, count(*)::int AS n FROM leads
    WHERE (${listId}::uuid IS NULL OR list_id = ${listId}::uuid)
    GROUP BY outcome ORDER BY n DESC`;

  const corrections = await sql`
    SELECT x.id, x.list_id, ll.name AS list_name, x.first_name, x.last_name, x.phone, x.phone2, x.address, x.house_number, x.street_type, x.city,
           x.wrong_number, x.outcome::text AS outcome, x.orig_data, x.corrected_at, x.outcome_at,
           ag.first_name AS agent_first_name, ag.last_name AS agent_last_name
    FROM leads x
    JOIN lead_lists ll ON ll.id = x.list_id
    LEFT JOIN users ag ON ag.id = coalesce(x.corrected_by, x.assigned_to)
    WHERE x.anonymized_at IS NULL AND (x.wrong_number OR x.corrected_at IS NOT NULL)
      AND (${listId}::uuid IS NULL OR x.list_id = ${listId}::uuid)
    ORDER BY coalesce(x.corrected_at, x.outcome_at) DESC NULLS LAST
    LIMIT 500`;

  // elenco per esito (es. tutti i contatti in segreteria): una lista oppure tutte, con i dati completi
  let byOutcome: unknown[] = [];
  const OUTCOMES = ["nuovo", "appuntamento", "da_ricontattare", "non_interessato", "segreteria", "numero_errato", "persona_sbagliata"];
  if (q.export === "outcome" && q.outcome && OUTCOMES.includes(q.outcome)) {
    byOutcome = await sql`
      SELECT ll.name AS list_name, x.first_name, x.last_name, x.phone, x.phone2, x.address, x.house_number, x.city, x.province,
             x.fiscal_code, x.sector, x.provider, x.outcome::text AS outcome, x.outcome_at, x.call_count,
             x.appointment_at, x.appointment_result::text AS appointment_result, x.notes,
             ag.first_name AS agent_first_name, ag.last_name AS agent_last_name
      FROM leads x JOIN lead_lists ll ON ll.id = x.list_id LEFT JOIN users ag ON ag.id = x.assigned_to
      WHERE x.anonymized_at IS NULL AND x.outcome = ${q.outcome}::lead_outcome
        AND (${listId}::uuid IS NULL OR x.list_id = ${listId}::uuid)
      ORDER BY ll.name, lower(coalesce(x.city, '')), lower(coalesce(x.last_name, ''))
      LIMIT 50000`;
  }

  // dati puliti: tutti i lead della lista con i valori corretti, senza i numeri errati
  let clean: unknown[] = [];
  if (q.export === "clean" && listId) {
    clean = await sql`
      SELECT x.first_name, x.last_name, x.phone, x.phone2, x.address, x.house_number, x.street_type, x.city, x.province, x.sector,
             x.outcome::text AS outcome, x.appointment_at, x.appointment_result::text AS appointment_result,
             x.notes, ag.first_name AS agent_first_name, ag.last_name AS agent_last_name
      FROM leads x LEFT JOIN users ag ON ag.id = x.assigned_to
      WHERE x.list_id = ${listId}::uuid AND x.anonymized_at IS NULL AND x.wrong_number = false
      ORDER BY lower(coalesce(x.city, '')), lower(coalesce(x.last_name, ''))
      LIMIT 50000`;
  }

  return json(200, { summary, corrections, clean, by_outcome: byOutcome });
});
