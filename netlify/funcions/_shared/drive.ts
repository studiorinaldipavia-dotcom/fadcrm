import { google } from "googleapis";
import { Readable } from "node:stream";

// Con GOOGLE_REFRESH_TOKEN usa l'account Google aziendale (consigliato, usa il suo spazio).
// Altrimenti prova con l'account di servizio (GOOGLE_CLIENT_EMAIL / GOOGLE_PRIVATE_KEY).
export function getDrive() {
  let auth: any;
  if (process.env.GOOGLE_REFRESH_TOKEN) {
    const oauth = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
    );
    oauth.setCredentials({ refresh_token: process.env.GOOGLE_REFRESH_TOKEN });
    auth = oauth;
  } else {
    auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: process.env.GOOGLE_CLIENT_EMAIL,
        private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
      },
      scopes: ["https://www.googleapis.com/auth/drive"],
    });
  }
  return google.drive({ version: "v3", auth });
}

export function driveConfigured(): boolean {
  return Boolean(
    process.env.GOOGLE_DRIVE_FOLDER_ID &&
      (process.env.GOOGLE_REFRESH_TOKEN ||
        (process.env.GOOGLE_CLIENT_EMAIL && process.env.GOOGLE_PRIVATE_KEY)),
  );
}

export async function createFolder(name: string): Promise<string> {
  const drive = getDrive();
  const res = await drive.files.create({
    requestBody: {
      name,
      mimeType: "application/vnd.google-apps.folder",
      parents: [process.env.GOOGLE_DRIVE_FOLDER_ID!],
    },
    fields: "id",
    supportsAllDrives: true,
  });
  return res.data.id!;
}

export async function uploadPdf(folderId: string, name: string, data: Buffer) {
  const drive = getDrive();
  const res = await drive.files.create({
    requestBody: { name, parents: [folderId] },
    media: { mimeType: "application/pdf", body: Readable.from(data) },
    fields: "id, webViewLink",
    supportsAllDrives: true,
  });
  return { fileId: res.data.id!, link: res.data.webViewLink ?? null };
}

export async function downloadFile(fileId: string): Promise<Buffer> {
  const drive = getDrive();
  const res = await drive.files.get(
    { fileId, alt: "media", supportsAllDrives: true },
    { responseType: "arraybuffer" },
  );
  return Buffer.from(res.data as ArrayBuffer);
}

export async function deleteFile(fileId: string) {
  try {
    await getDrive().files.delete({ fileId, supportsAllDrives: true });
  } catch {
    /* pulizia best-effort */
  }
}

/** Cartella aziendale CLIENTI/<Nome Cognome>: la crea alla prima necessita' e ne ricorda l'ID */
export async function ensureCustomerFolder(
  customer: { id: string; first_name: string; last_name: string; drive_folder_id: string | null },
  save: (folderId: string) => Promise<void>,
): Promise<string> {
  if (customer.drive_folder_id) return customer.drive_folder_id;
  const name = `${customer.first_name} ${customer.last_name}`.replace(/[\\/:*?"<>|]/g, " ").replace(/\s+/g, " ").trim();
  const folderId = await createFolder(name || "Cliente");
  await save(folderId);
  return folderId;
}
