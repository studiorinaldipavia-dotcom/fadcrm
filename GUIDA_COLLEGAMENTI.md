# Collegare Neon, Google Drive ed email

Tutto passa da Netlify (Site configuration -> Environment variables). Dopo ogni modifica alle variabili: Deploys -> Trigger deploy -> Deploy site.

## 1. Neon (database)
1. SQL Editor di Neon: esegui in ordine i file della cartella `database/` (01 ... 06).
2. Pulsante Connect -> ruolo `neondb_owner`, "Connection pooling" attivo -> copia l'indirizzo `postgresql://...`.
3. Netlify: variabile `DATABASE_URL` = quell'indirizzo (spunta "Contains secret values").
4. Controllo: SQL Editor -> `SELECT table_name FROM information_schema.tables WHERE table_schema='public' ORDER BY 1;` (21 tabelle).

## 2. Google Drive + email (un solo collegamento Google)
1. Account Google aziendale: nel suo Drive crea la cartella CLIENTI; l'ID e' il testo dopo `folders/` nell'indirizzo.
2. console.cloud.google.com -> nuovo progetto -> API e servizi -> Libreria -> abilita "Google Drive API" e "Gmail API".
3. Google Auth Platform (schermata consenso OAuth): nome app, email di supporto.
   - Se l'account e' Google Workspace (es. @fad.it): tipo utenti "Interno" (nessuna scadenza, nessuna verifica).
   - Se e' un Gmail normale: "Esterno", aggiungi l'account tra gli utenti di prova, poi pagina Pubblico -> "Pubblica app" (stato "In produzione"). Se resta "In test" il token scade dopo 7 giorni.
4. Client -> Crea client -> "Applicazione web" -> URI di reindirizzamento autorizzato: `https://developers.google.com/oauthplayground` -> copia ID client e segreto (il segreto si vede una sola volta).
5. developers.google.com/oauthplayground -> ingranaggio -> "Use your own OAuth credentials" -> incolla ID e segreto.
   Nel passo 1 scrivi nel campo degli scope: `https://www.googleapis.com/auth/drive https://www.googleapis.com/auth/gmail.send` -> Authorize APIs -> accedi con l'account aziendale -> Consenti (se compare "app non verificata": Avanzate -> Vai a ...).
   Passo 2: "Exchange authorization code for tokens" -> copia il **Refresh token**.
6. Netlify, variabili: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REFRESH_TOKEN`, `GOOGLE_DRIVE_FOLDER_ID`, `MAIL_FROM_ADDRESS` (l'indirizzo dell'account), facoltative `MAIL_FROM_NAME` (F.A.D. SRL) e `SITE_URL`.
7. Controllo: nel CRM, Impostazioni -> Google Drive -> "Verifica collegamento". Per l'email: crea un cliente con la tua email e invia l'informativa privacy.


> Versione dettagliata, con tutti i passaggi e la configurazione dell'email col tuo dominio: **GUIDA_GOOGLE_DRIVE_E_EMAIL.md**.
