import { json, requireUser, route, sql } from "./_shared/auth";

// Dati per il modulo cliente: prodotti attivi e agenti a cui si puo' assegnare
export const handler = route("GET", async (event) => {
  const auth = await requireUser(event, ["customers.create", "customers.edit_all", "customers.edit_own"]);
  if ("response" in auth) return auth.response;
  const { user } = auth;

  const products = await sql`SELECT name FROM products WHERE is_active ORDER BY sort_order, name`;
  const agents = user.permissions.includes("customers.edit_all")
    ? await sql`
        SELECT id, first_name, last_name FROM users
        WHERE status = 'attivo' ORDER BY first_name, last_name`
    : [{ id: user.id, first_name: user.first_name, last_name: user.last_name }];

  // elenco per "Altri agenti": anche trainer e agenti (se hanno il permesso) possono aggiungere colleghi
  const canShare = user.permissions.includes("customers.edit_all") || user.permissions.includes("customers.add_agents");
  const share_agents = canShare
    ? user.permissions.includes("customers.edit_all")
      ? agents
      : await sql`SELECT id, first_name, last_name FROM users WHERE status = 'attivo' ORDER BY first_name, last_name`
    : [];

  return json(200, {
    products: products.map((p) => p.name),
    agents,
    share_agents,
    can_remove_agents: user.permissions.includes("customers.edit_all"),
  });
});
