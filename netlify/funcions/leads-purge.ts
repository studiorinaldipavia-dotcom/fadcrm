import { schedule } from "@netlify/functions";
import { purgeLeads } from "./_shared/leads";

// Ogni ora anonimizza i lead delle sessioni chiuse da piu' di 24 ore (conformita' GDPR).
// Le funzioni programmate girano solo sul sito pubblicato (non in anteprima).
export const handler = schedule("0 * * * *", async () => {
  try {
    const n = await purgeLeads();
    console.log(`LeadHub: ${n} lead anonimizzati`);
    return { statusCode: 200 };
  } catch (error) {
    console.error(error);
    return { statusCode: 500 };
  }
});
