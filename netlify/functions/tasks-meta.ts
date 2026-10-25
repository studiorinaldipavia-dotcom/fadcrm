import { json, requireUser, route, sql } from "./_shared/auth";

// Dati per il modulo "Nuova task": clienti con gli agenti a cui si puo' assegnare
// (l'agente responsabile del cliente e gli altri agenti aggiunti sul cliente).
export const handler = route("GET", async (event) => {
  const auth = await requireUser(event, ["tasks.manage"]);
  if ("response" in auth) return auth.response;

  const customers = await sql`
    SELECT c.id, c.first_name, c.last_name, c.city,
           (SELECT coalesce(json_agg(json_build_object('id', u.id, 'name', u.first_name || ' ' || u.last_name)
                                     ORDER BY u.first_name, u.last_name), '[]'::json)
            FROM users u
            WHERE u.status = 'attivo'
              AND (u.id = c.agent_id OR EXISTS (SELECT 1 FROM customer_agents sa WHERE sa.customer_id = c.id AND sa.agent_id = u.id))
           ) AS agents
    FROM customers c
    ORDER BY lower(c.last_name), lower(c.first_name)
    LIMIT 2000`;

  return json(200, { customers });
});
