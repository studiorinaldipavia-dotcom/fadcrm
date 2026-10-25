import { schedule } from "@netlify/functions";
import { sql } from "./_shared/auth";
import { generateReminders } from "./_shared/notifications";

// Ogni 15 minuti prepara i promemoria per tutti e ripulisce le notifiche vecchie (oltre 30 giorni).
export const handler = schedule("*/15 * * * *", async () => {
  try {
    await generateReminders(null);
    await sql`DELETE FROM notifications WHERE created_at < now() - interval '30 days'`;
    return { statusCode: 200 };
  } catch (error) {
    console.error(error);
    return { statusCode: 500 };
  }
});
