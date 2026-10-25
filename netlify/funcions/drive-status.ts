import { json, requireUser, route } from "./_shared/auth";
import { driveConfigured, getDrive } from "./_shared/drive";

// Controlla che Google Drive sia collegato e che la cartella aziendale sia raggiungibile
export const handler = route("GET", async (event) => {
  const auth = await requireUser(event, ["settings.manage"]);
  if ("response" in auth) return auth.response;

  if (!driveConfigured()) {
    const missing: string[] = [];
    if (!process.env.GOOGLE_DRIVE_FOLDER_ID) missing.push("GOOGLE_DRIVE_FOLDER_ID");
    if (!process.env.GOOGLE_REFRESH_TOKEN && !(process.env.GOOGLE_CLIENT_EMAIL && process.env.GOOGLE_PRIVATE_KEY)) {
      missing.push("GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET", "GOOGLE_REFRESH_TOKEN");
    }
    return json(200, { configured: false, ok: false, missing });
  }

  try {
    const res = await getDrive().files.get({
      fileId: process.env.GOOGLE_DRIVE_FOLDER_ID!,
      fields: "id, name, mimeType",
      supportsAllDrives: true,
    });
    const isFolder = res.data.mimeType === "application/vnd.google-apps.folder";
    return json(200, {
      configured: true,
      ok: isFolder,
      folder_name: res.data.name,
      mode: process.env.GOOGLE_REFRESH_TOKEN ? "account aziendale (OAuth)" : "account di servizio",
      message: isFolder ? null : "L'ID indicato non è una cartella",
    });
  } catch {
    return json(200, {
      configured: true,
      ok: false,
      message: "Google non risponde con queste credenziali: controlla ID cartella, token e permessi.",
    });
  }
});
