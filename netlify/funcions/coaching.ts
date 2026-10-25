import { json, requireUser, route } from "./_shared/auth";
import { computeCoaching } from "./_shared/coaching";

// Schermata Coaching agenti (trainer, manager, amministratore)
export const handler = route("GET", async (event) => {
  const auth = await requireUser(event, ["stats.coaching"]);
  if ("response" in auth) return auth.response;
  return json(200, await computeCoaching());
});
