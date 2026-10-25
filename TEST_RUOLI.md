# Prova dei permessi, ruolo per ruolo

Usa una finestra in incognito per ogni ruolo. Crea prima un utente di prova per ruolo (Agenti & permessi).

## Agente
- [ ] Menu: Dashboard, Clienti, Segreteria (solo le sue task), Performance, Mappa clienti, Calendario. NON compaiono Agenti & permessi, Prodotti, Impostazioni.
- [ ] Clienti: vede solo i propri; non riesce ad aprire un cliente di un altro (errore "non trovato").
- [ ] Segreteria: vede solo le task assegnate a lui; non ha "Nuova task", "Modifica", "Elimina"; può chiudere con Recuperato / Fatto.
- [ ] Performance: vede solo i propri numeri; non può inserire una data più vecchia di 7 giorni.
- [ ] Mappa e Calendario: solo i propri.

## Segreteria
- [ ] Menu: Dashboard, Clienti, Segreteria, Calendario. Non può creare clienti.
- [ ] Crea un KO da recuperare (motivo obbligatorio) e una task manuale per un agente del cliente; l'agente riceve la notifica.
- [ ] Può modificare, riaprire ed eliminare le task; non può assegnarle a un agente non collegato al cliente.
- [ ] Non vede Performance, Mappa, Agenti, Prodotti, Impostazioni.

## Trainer / Manager
- [ ] Come agente, più la sezione Coaching dentro Performance.
- [ ] Non vede i clienti degli altri agenti.

## Amministratore
- [ ] Vede tutto: tutti i clienti, task, calendari, mappa con filtri, performance di tutti.
- [ ] Crea, sospende e riattiva agenti; un agente sospeso non riesce più a entrare, nemmeno se era già collegato.
- [ ] Non può sospendere né declassare se stesso.
- [ ] Impostazioni: uffici, stato Google Drive, registro attività.

## Sicurezza
- [ ] 5 password sbagliate di fila → blocco di 15 minuti.
- [ ] Dopo il cambio password, l'altro dispositivo viene scollegato.
- [ ] Aprire /api/agents da agente → errore 403.

## Informativa privacy
- [ ] Nuovo cliente con email e codice fiscale + spunta "Invia subito l'informativa": arriva l'email.
- [ ] Aprire il link da telefono: testo personalizzato, firma con il dito, entrambi i consensi obbligatori.
- [ ] Dopo la firma: in scheda cliente compare "Firmata", si apre il PDF e il file è nella cartella Drive del cliente.
- [ ] Il PDF riporta "Firmato il ... da ... - IP: ...".
- [ ] Riaprire lo stesso link: "già firmata". Un link vecchio dopo un nuovo invio: "sostituito".
- [ ] Un agente non vede l'informativa di clienti non suoi.

## Clienti condivisi e promemoria
- [ ] Marco crea un cliente, aggiunge Stefano in "Altri agenti": il cliente compare nell'elenco di Stefano.
- [ ] La segreteria crea una task per Stefano su quel cliente: Stefano la vede, Marco no.
- [ ] Task con scadenza passata: l'agente riceve il promemoria e la task risulta "scaduta".
- [ ] KO "Non recuperabile" senza nota: rifiutato. Chiusura da parte dell'agente: la segreteria riceve la notifica.
- [ ] Nuovo cliente con la spunta "Appuntamento fra 11 mesi": in Calendario, fra 11 mesi, compare «Aggiornamento tariffe Nome Cognome» collegato alla scheda.
- [ ] Gli appuntamenti sono visibili a chi li ha creati, ad amministratore, manager e segreteria; non agli altri agenti.
