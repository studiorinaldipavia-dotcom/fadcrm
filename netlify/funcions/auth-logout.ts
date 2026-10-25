import { clearCookie, json, route } from "./_shared/auth";

export const handler = route("POST", async () => json(200, { ok: true }, { "Set-Cookie": clearCookie() }));
