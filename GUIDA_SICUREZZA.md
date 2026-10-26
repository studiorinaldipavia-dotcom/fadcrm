# FAD LeadHub – guida alla sicurezza

## 1. Da fare ADESSO (in quest'ordine)
1. **Esegui su Neon** `database/18_migrazione_sicurezza.sql` (dopo la 17). Va fatto PRIMA di pubblicare il nuovo codice, altrimenti il login non funziona.
2. (Consigliato) su Netlify → Environment variables aggiungi `MFA_ENCRYPTION_KEY` con una stringa casuale di almeno 32 caratteri, **prima** che qualcuno attivi la 2FA, e poi non cambiarla più.
3. Pubblica il sito. Al primo accesso gli amministratori (e chi ha permessi alti) dovranno attivare la verifica in due passaggi: tieni il telefono a portata di mano e **salva i codici di recupero**.
4. Se ti blocchi: imposta `MFA_REQUIRED=off` su Netlify per sospendere l'obbligo, oppure usa il recupero amministratore (`RECOVERY_TOKEN`), che azzera anche la 2FA.

## 2. Cosa è cambiato nel comportamento
- **2FA (TOTP)** con qualsiasi app di autenticazione. Obbligatoria per amministratori e account che possono gestire utenti, ruoli o eliminare clienti; facoltativa per gli altri (`MFA_REQUIRED=all` per renderla obbligatoria a tutti).
- **Azioni protette**: eliminare clienti o agenti, creare utenti, cambiare ruoli/permessi/stato/email, nuova password temporanea, reimpostare la 2FA. L'app chiede di riscrivere la password; vale 10 minuti.
- **Sessioni**: account con permessi alti restano collegati max 12 ore (niente «Ricordami»); gli altri max 14 giorni (prima 30). Dal profilo: «Esci da tutti gli altri dispositivi».
- **Password**: minimo 12 caratteri, niente password comuni, niente email dentro la password, controllo su elenchi di password violate (servizio HIBP: si invia solo l'inizio dell'impronta, mai la password; se il servizio non risponde il controllo viene saltato).
- **Registro attività**: ora segna anche accessi falliti/bloccati, errori 2FA, uso dei codici di recupero, riconferme password, chiusura sessioni, consultazione delle schede cliente (una volta ogni 10 minuti per cliente) e dei report lead.
- **Avviso email** all'utente quando accede da un browser nuovo (serve l'invio email già configurato).
- **Limiti di richieste**: ricerca clienti, ricerca lead, report lead, pagine pubbliche di firma privacy.
- **Anti-CSRF**: le richieste di scrittura devono avere l'header `X-Requested-With: fad-leadhub` (lo aggiunge l'app).

## 3. Da fare a mano (non si può fare dal codice)
- **Neon – ruolo con permessi minimi**: crea un ruolo dedicato all'app (solo SELECT/INSERT/UPDATE/DELETE sulle tabelle, niente creazione/eliminazione di tabelle né accesso ad altri database) e usa quello in `DATABASE_URL`. Le migrazioni si eseguono con il ruolo proprietario, solo dalla console Neon.
- **Neon – backup**: verifica la finestra di ripristino (point-in-time restore) del tuo piano e prova almeno una volta un ripristino su un branch di test.
- **Rotazione dei segreti** ogni 6–12 mesi (o subito se un file con i segreti è stato condiviso): `JWT_SECRET` (chiude tutte le sessioni, nessun altro effetto), `SETUP_TOKEN`, `RECOVERY_TOKEN` (tienilo vuoto/assente finché non serve), chiavi email. Non cambiare `MFA_ENCRYPTION_KEY`.
- **Google Drive**: usa un account di servizio con accesso solo alla cartella dei clienti.
- **Dipendenze**: esegui ogni tanto `npm run audit` e aggiorna i pacchetti segnalati.
- **Conservazione dei dati**: decidi per iscritto per quanto tempo tenere clienti KO, lead e log; poi si può automatizzare la cancellazione.
