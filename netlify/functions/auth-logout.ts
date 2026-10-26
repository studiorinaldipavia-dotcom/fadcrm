import { clearCookie, json, route } from "./_shared/auth";
import { clearSudoCookie } from "./_shared/security";

export const handler = route("POST", async () => ({
  ...json(200, { ok: true }),
  multiValueHeaders: { "Set-Cookie": [clearCookie(), clearSudoCookie()] },
}));
