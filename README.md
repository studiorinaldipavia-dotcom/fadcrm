# FAD LeadHub

Web app per F.A.D. SRL: lead di telemarketing (Call Mode, Agenda, Control Room), clienti, calendario, performance e Segreteria a task. Frontend React + Vite, backend con funzioni Netlify, database Neon (PostgreSQL), informative privacy su Google Drive.

**Colori**: nero `#000000` (dominante), verde mela `#B3D445` (accento), bianco `#FFFFFF` (sfondo). Logo in `public/logo-fad.png` (sfondi chiari) e `public/logo-fad-white.png` (sfondi scuri).

## Variabili da impostare su Netlify (Site configuration → Environment variables)

| Variabile | A cosa serve |
|---|---|
| `DATABASE_URL` | Indirizzo di connessione a Neon (segreto) |
| `JWT_SECRET` | Stringa casuale di almeno 40 caratteri per firmare le sessioni |
| `SETUP_TOKEN` | Serve solo al primo avvio per creare l'amministratore (si può togliere dopo) |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REFRESH_TOKEN` | Collegamento a Google Drive con l'account aziendale |
| `GOOGLE_DRIVE_FOLDER_ID` | ID della cartella CLIENTI su Drive |
| `GEOCODE_CONTACT` | (facoltativa) email di riferimento per il servizio di mappe |
| `MAIL_FROM_ADDRESS` | Indirizzo da cui partono le email (informativa privacy), es. privacy@fad.it |
| `MAIL_PROVIDER` | `resend`, `brevo` o `gmail` (se manca: sceglie da solo in base alle chiavi presenti) |
| `RESEND_API_KEY` / `BREVO_API_KEY` | Chiave del servizio di invio gratuito con il tuo dominio |
| `MAIL_REPLY_TO` | (facoltativa) Indirizzo a cui arrivano le risposte dei clienti |
| `MAIL_FROM_NAME` | (facoltativa) Nome mostrato come mittente, es. F.A.D. SRL |
| `SITE_URL` | (facoltativa) Indirizzo del sito per i link nelle email |
| `RECOVERY_TOKEN` | (solo in emergenza) codice per reimpostare la password di un amministratore; da togliere dopo l'uso |

## Script SQL da eseguire su Neon, in ordine

Dal `01_schema_fad_leadhub.sql` al `16_migrazione_fad_leadhub_task_segreteria.sql`, in ordine numerico. La 16 elimina contratti e provvigioni e crea le task della Segreteria.

## Struttura

- `src/App.tsx`: interfaccia (la Segreteria è `SecretariatPage`)
- `src/leadhub/`: Call Mode, Agenda lead, Control Room
- `src/services/api.ts`: chiamate al backend
- `netlify/functions/`: backend (una funzione per operazione); `tasks*.ts` gestiscono la Segreteria; `_shared/` contiene login, permessi, Drive e coaching

## Informativa privacy

- Testo in `netlify/functions/_shared/privacyText.ts` (modello F.A.D. SRL). Non modificarlo senza l'approvazione di F.A.D. SRL.
- Guida passo per passo (Drive + email): `GUIDA_GOOGLE_DRIVE_E_EMAIL.md`.

## LeadHub e Segreteria
Vedi `GUIDA_LEADHUB.md`.
