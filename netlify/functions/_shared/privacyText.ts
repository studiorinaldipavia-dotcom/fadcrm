// Testo dell'informativa privacy di F.A.D. SRL (Rev. 00 del 6.10.2025), riportato come nel modello originale.
// NON modificare il testo senza l'approvazione del Titolare del trattamento (F.A.D. SRL).

export const PRIVACY_REV = "Rev. 00 del 6.10.2025";
export const PRIVACY_FOOTER = "Informativa Clienti Agenzia FAD S.r.l. Rev. 00 del 6.10.2025";

export const PRIVACY_HEADER = [
  "F.A.D. SRL",
  "C.F. e P.iva: 13258690018",
  "Sede legale: VIA MONTE BIANCO 32",
  "10024 MONCALIERI TO",
  "PEC: fadsrl25@legalmail.it",
];

export type PrivacyBlock =
  | { type: "title"; text: string }
  | { type: "h"; text: string }
  | { type: "p"; text: string }
  | { type: "consent"; id: "marketing" | "third"; text: string }
  | { type: "declaration"; text: string };

export type PrivacyPerson = {
  first_name: string;
  last_name: string;
  fiscal_code: string;
  contact: string; // telefono e/o email
};

export function privacyBlocks(p: PrivacyPerson): PrivacyBlock[] {
  return [
    {
      type: "title",
      text: "OGGETTO: INFORMATIVA DI F.A.D. SRL SUL TRATTAMENTO DEI DATI PERSONALI DI PROSPECT E/O CLIENTI CONTRATTUALIZZATI PER CONTO DI UNA COMPAGNIA",
    },
    { type: "p", text: "Egregio Sig/Gent.ma Sig.ra" },
    { type: "p", text: `${p.first_name} (nome) ${p.last_name} (cognome) C.F./P.I. ${p.fiscal_code}` },
    { type: "p", text: `numero di telefono fisso/cellulare o indirizzo e-mail ${p.contact}` },
    {
      type: "p",
      text: "ai sensi del Regolamento UE n. 679 del 2016 (GDPR) con riferimento al trattamento dei Suoi dati personali, la scrivente Agenzia F.A.D. SRL (C.F. e P.iva: 13258690018 Sede legale: VIA MONTE BIANCO 32 10024 MONCALIERI TO PEC: fadsrl25@legalmail.it) comunica che, in riferimento ai dati personali raccolti per ragioni di contatto a fini di comunicazione commerciale, inclusi e-mail marketing e/o tele-marketing (pertanto per finalità differenti da quelle contrattuali di erogazione del servizio da parte di una certa compagnia con la quale Lei abbia, per il tramite dell’Agenzia F.A.D. Srl - o sua sub-Agenzia formalmente incaricata - concluso un contratto per l’erogazione di luce/gas/telefonia) è Titolare del trattamento dei Suoi dati personali. Concordemente all’attuale disciplina vigente in materia, il trattamento che la scrivente Agenzia effettuerà sarà improntato ai principi di liceità, correttezza, trasparenza e agli ulteriori principi di cui all’art. 5 Reg. UE 679/2016 (GDPR). Forniamo, pertanto, le seguenti informazioni.",
    },
    { type: "h", text: "A) Trattamento dei dati personali" },
    {
      type: "p",
      text: "Per “trattamento” si intende, ai sensi del num. 2 dell’art. 4 Reg. UE 679/2016, “qualsiasi operazione compiuta, con o senza l’ausilio di processi automatizzati, e applicata a dati personali come la raccolta, la registrazione, l’organizzazione, la strutturazione, la conservazione, l’estrazione, la consultazione, l’uso, la comunicazione… la cancellazione o la distruzione”. Saranno richiesti e trattati soltanto i dati personali essenziali al conseguimento delle finalità di comunicazione commerciale (inclusi e-mail marketing e/o tele-marketing) quali nominativo e dati anagrafici, C.F./P.IVA, indirizzo, numero di telefono fisso/cellulare, indirizzo e-mail, copia del contratto da Lei in precedenza stipulato con una data Compagnia per la fornitura del servizio di luce/gas/telefonia (c.d. “dati comuni”). Ad ogni modo, i dati personali trattati dalla scrivente Agenzia sono quelli da Lei forniti in occasione della stipula (o anche solo proposta di stipula) di contratti per la fornitura di servizi di luce/gas/telefonia e si limitano a quei dati che consentono di individuare le Sue esigenze e di ricontattarla (a mezzo e-mail oppure SMS/Whatsapp oppure telefonate), al fine di poter formulare nuove proposte personalizzate e/o comunque migliorative della tariffa a Lei applicata ed eventualmente offerte da un differente Fornitore.",
    },
    {
      type: "p",
      text: "I dati trattati da F.A.D. Srl per le proprie attività di marketing potrebbero essere stati, inoltre, reperiti per il tramite di un c.d. list provider, soggetto che l’art. 2 lett. g) del nuovo Codice di condotta in materia di telemarketing e teleselling definisce come “soggetto che, operando in qualità di titolare del trattamento, procede, in virtù del consenso degli interessati, alla comunicazione dei dati personali, autonomamente raccolti, a soggetti terzi per finalità di teleselling e telemarketing”, ed in tal caso il trattamento dei dati personali dell’Interessato avviene sulla base di un suo consenso previamente acquisito dal list provider per tale specifica attività di trattamento a fini marketing da parte di F.A.D. Srl.",
    },
    { type: "h", text: "B) Finalità del trattamento e Basi Giuridiche" },
    {
      type: "p",
      text: "I dati personali di cui alla presente informativa – in particolare, oltre a nome, cognome e CF/PI: numero di tel/cell ed indirizzo di posta elettronica - saranno oggetto di trattamento per finalità di comunicazione commerciale/marketing (email marketing e/o tele-marketing e/o invio di messaggistica SMS/Whatsapp) proprie dell’Agenzia F.A.D. Srl e, pertanto, diverse da quelle proprie contrattuali della Compagnia.",
    },
    {
      type: "p",
      text: "i) Con il Suo consenso, F.A.D. Srl utilizzerà il suo numero di cellulare e/o il suo indirizzo e-mail per lo svolgimento (tramite messaggi SMS/Whatsapp, nel caso del numero di cellulare; messaggi di posta elettronica, nel caso dell’indirizzo e-mail) di attività di informazione commerciale e/o promozionale in merito a prodotti e/o servizi che riterrà possano essere di Suo interesse (in particolare, perché migliorativi delle tariffe a Lei applicate) e per i quali l’Agenzia abbia ricevuto mandato da Compagnie fornitrici. Per quanto concerne l’attività di marketing tramite chiamata ad un numero telefonico, fisso o cellulare, (c.d. tele-marketing) trova in tal caso applicazione il comma 3bis dell’art. 130 del Codice Privacy (D.Lgs 196/2003) ai sensi del quale il trattamento della numerazione telefonica “per finalità di invio di materiale pubblicitario o di vendita diretta o per il compimento di ricerche di mercato o di comunicazione commerciale è consentito nei confronti di chi non abbia esercitato il diritto di opposizione…mediante l'iscrizione della numerazione della quale è intestatario… in un registro pubblico delle opposizioni”. Pertanto, qualora in avvenire F.A.D. Srl (anche per il tramite di una propria sub-Agenzia formalmente incaricata) intenda effettuare nei Suoi confronti attività di tele-marketing, oltre al Suo consenso espresso con la presente informativa, sarà nostra cura verificare previamente che la Sua numerazione telefonica non risulti iscritta nel RPO – Registro Pubblico delle Opposizioni, concordemente con quanto previsto dal Garante Privacy sul proprio sito internet (https://www.garanteprivacy.it/home/docweb/-/docweb-display/docweb/1794339) e a quanto da ultimo previsto nel “Codice di condotta per le attività di telemarketing e teleselling” ed approvato dal Garante Privacy in data 9 marzo 2023 (https://www.garanteprivacy.it/web/guest/home/docweb/-/docwebdisplay/docweb/9868836)",
    },
    {
      type: "p",
      text: "ii) Previo suo distinto consenso, i suoi dati personali potranno, inoltre, essere eventualmente ceduti in avvenire da F.A.D. Srl ad altro operatore (es. altra Agenzia o Compagnia fornitrice di servizi di luce/gas/telefonia) per finalità commerciali proprie del soggetto terzo.",
    },
    { type: "h", text: "C) Soggetti autorizzati al trattamento (c.d. Incaricati), Responsabili del trattamento ed altri destinatari" },
    {
      type: "p",
      text: "Dei Suoi dati personali potranno avere conoscenza tutti i soggetti specificamente nominati quali “Incaricati/Autorizzati al trattamento” da F.A.D. Srl in veste di Titolare oppure dagli “incaricati alle vendite” delle sub-Agenzie cui F.A.D. Srl abbia conferito mandato e che operano, pertanto, in qualità di Responsabili del trattamento. Tali soggetti (es. personale amministrativo o di segreteria, incaricati alle vendite, etc) individuati secondo l’ambito ed il profilo a ciascuno assegnato, agiranno solo su autorizzazione del Titolare (e delle sub-Agenzie Responsabili) e, conformemente a quanto disposto dall’art. 29 Reg. UE 679/2016 tratteranno i Suoi dati soltanto previa istruzione. I Suoi dati potranno altresì essere conosciuti e trattati da soggetti ai quali l’Agenzia abbia esternalizzato un servizio, ed i quali effettuano dunque un trattamento per conto del Titolare (es. società incaricate di verificare l’iscrizione della numerazione telefonica al RPO): i Responsabili del trattamento prescelti dalla nostra Agenzia – in particolare, come detto, le nostre sub-Agenzie, tutte designate quali Responsabili del trattamento - si sono impegnati ad istruire i propri Incaricati e a mettere in atto misure tecniche ed organizzative adeguate in modo tale che i trattamenti soddisfino i requisiti di cui al Reg EU 679/2016 e garantisca la tutela dei Suoi dati personali. I soggetti Responsabili si sono inoltre impegnati, con apposita e sottoscritta lettera di nomina ad assolvere tutti gli specifici obblighi di cui all’art. 28 Reg. UE 679/2016 e ad agire, ai sensi dell’art. 29 del medesimo Regolamento, sotto l’autorità del Titolare e previa sua istruzione, nonché a comunicare al Titolare (ai sensi del secondo comma dell’art. 33 Reg UE 679/2016) eventuali violazioni di dati personali.",
    },
    { type: "p", text: "La presente informativa viene consegnata all’Interessato dalla sub-Agenzia in veste di Agenzia incaricata da F.A.D. Srl" },
    {
      type: "p",
      text: "Ricordiamo infine che, in caso di accettazione delle nostre proposte commerciali, i Suoi dati saranno poi trasmessi alla Compagnia fornitrice del servizio/prodotto da Lei richiesto a fini di contrattualizzazione.",
    },
    { type: "h", text: "C) Modalità di trattamento, tempo di conservazione dei dati e trasferimento dei dati all’estero" },
    {
      type: "p",
      text: "I dati personali verranno trattati - con modalità idonee a garantirne la sicurezza e la riservatezza e nel pieno rispetto delle disposizioni di cui al Reg. UE 679/2016 - con il supporto, oltre che di materiali cartacei, anche di materiali informatici o telematici nonché attraverso strumenti automatizzati atti a memorizzare, gestire o trasmettere i dati stessi. Lei potrà, in qualunque momento, revocare il consenso al trattamento dei propri dati personali o esercitare il diritto di opposizione, sia contattando direttamente il Titolare ad uno dei propri recapiti (oppure una sua sub-Agenzia), sia eventualmente mediante la funzione “unsubscribe” posta in calce alle e-mail pubblicitarie, sia rispondendo al messaggio (SMS/Whatapp) pubblicitario, sia nel corso della chiamata a fini di telemarketing: nel momento in cui Lei revocherà il suo consenso/eserciterà il suo diritto di opposizione al trattamento, i suoi dati di contatto verranno inseriti in una black list/lista di non contattabilità in modo tale da non poterla più ricontattare per finalità promozionali.",
    },
    {
      type: "p",
      text: "I Suoi dati personali non saranno trasferiti all’estero. La scrivente si riserva, tuttavia, la possibilità di utilizzare servizi cloud, nel qual caso il fornitore di detto servizio sarà selezionato tra coloro che forniscono garanzie adeguate ai sensi dell’art. 46 Reg. 679/2016.",
    },
    { type: "h", text: "D) Diritti esercitabili dall’Interessato; reclamo all’Autorità di controllo e ricorso giurisdizionale" },
    {
      type: "p",
      text: "Nei confronti del Titolare del trattamento è possibile esercitare i diritti di cui agli artt. 15 ss del Reg. UE 679/2016 (accesso ai dati personali, rettifica o cancellazione degli stessi, limitazione del trattamento, opposizione al trattamento, portabilità dei dati). E’ sempre possibile, inoltre, proporre reclamo all’Autorità di controllo competente (Garante Privacy) ai sensi dell’art. 77 Reg UE 679/2016 o ricorso giurisdizionale ai sensi dell’art. 79 Reg UE 679/2016 qualora l’Interessato ritenga che i diritti di cui gode siano stati violati a seguito di un trattamento.",
    },
    { type: "h", text: "E) Periodo di conservazione dei dati" },
    {
      type: "p",
      text: "F.A.D. Srl conserverà i Suoi dati per il tempo necessario al perseguimento delle finalità, fermo restando che Lei potrà in qualunque momento revocare il consenso prestato e/o opporsi al trattamento dei Suoi dati, momento a decorrere dal quale F.A.D. Srl e le sue sub-Agenzie cesseranno qualunque attività di marketing nei suoi confronti.",
    },
    { type: "h", text: "F) Responsabile della Protezione dei Dati/Data Protection Officer" },
    { type: "p", text: "Duepuntozero Srls non ha nominato alcun RPD/DPO non essendo obbligata ex art. 37 ss GDPR." },
    { type: "h", text: "G) Facoltatività del conferimento dei dati personali" },
    {
      type: "p",
      text: "Il conferimento dei Suoi dati alla scrivente Agenzia per il perseguimento, da parte di questa, della finalità di cui alla lett. B) è assolutamente facoltativo: l’eventuale Suo mancato conferimento dei dati a F.A.D. Srl per le attività commerciali/marketing (proprie e/o di soggetti terzi) non pregiudicherà in alcun modo l’esecuzione del contratto di servizio stipulato con la Compagnia fornitrice del servizio di luce/gas/telefonia ed avrà quale unica conseguenza l’impossibilità di svolgere il trattamento dei Suoi dati personali per conseguire finalità commerciali.",
    },
    { type: "h", text: "H) Consensi" },
    {
      type: "consent",
      id: "marketing",
      text: "i) Si richiede il Suo consenso all’uso dei Suoi dati personali (in particolare: numero di cellulare ed indirizzo e-mail) per lo svolgimento (tramite messaggi SMS/Whatsapp/telefonate, nel caso del numero di cellulare; messaggi di posta elettronica, nel caso dell’indirizzo e-mail) di attività di informazione commerciale e/o promozionale in merito a prodotti e/o servizi che F.A.D. Srl (anche per il tramite delle proprie sub-Agenzie cui abbia conferito mandato) riterrà possano essere di Suo interesse e per i quali l’Agenzia abbia ricevuto mandato da Compagnie fornitrici. Si ricorda che il consenso qui prestato potrà, in qualsiasi momento, essere revocato senza che con ciò venga pregiudicata la liceità dei trattamenti basati sul consenso effettuati prima della revoca.",
    },
    {
      type: "consent",
      id: "third",
      text: "ii) Si richiede il Suo consenso per l’eventuale futura cessione dei Suoi dati personali (in particolare, oltre a nome, cognome e CF/PI: numero di cellulare ed indirizzo e-mail) a soggetti terzi (operatori del settore luce, gas o telefonia come, ad esempio, altra Agenzia o Compagnia) per lo svolgimento da parte di questi (tramite messaggi SMS/Whatsapp/telefonate, nel caso del numero di telefono; messaggi di posta elettronica, nel caso dell’indirizzo e-mail) di attività di informazione commerciale e/o promozionale in merito a prodotti e/o servizi che tali soggetti riterranno poter essere di Suo interesse. Si ricorda che il consenso qui prestato potrà, in qualsiasi momento, essere revocato senza che con ciò venga pregiudicata la liceità dei trattamenti basati sul consenso effettuati prima della revoca.",
    },
    {
      type: "declaration",
      text: "Il/La sottoscritto/a in calce identificato/a dichiara di aver ricevuto completa informativa ai sensi dell’art. 13 del Regolamento UE 2016/679 da parte di F.A.D. Srl",
    },
  ];
}
