# Governance policy, termini e compliance

Stato: design MVP approvato il 31 luglio 2026. Nessun testo in questo documento sostituisce la redazione e revisione di un professionista legale/fiscale prima del lancio.

## Documenti pubblici minimi

1. Condizioni d'uso e di abbonamento.
2. Privacy Policy per utenti, clienti, visitatori e contatti Portfolio.
3. Cookie Policy e centro preferenze.
4. Acceptable Use / Fair Use Policy.
5. Policy cancellazione, rinnovi e rimborsi.
6. Data Processing Agreement per i workspace.
7. Elenco subprocessori e localizzazione/trasferimenti.
8. Procedura segnalazione abuso/contenuti e ricorso.
9. Procedura richieste autorita e transparency contact.
10. Security overview e canale vulnerability disclosure.
11. Informazioni societarie, contatti legali/privacy e dati richiesti per commercio elettronico.
12. Accessibility statement con limiti noti e contatto.

## Matrice di accettazione

- Condizioni d'uso: accettazione esplicita di ogni utente alla registrazione e sulle modifiche materiali.
- Condizioni abbonamento/cancellazione: accettazione dell'Owner prima di Trial/Checkout e nuova accettazione se cambiano rinnovo, prezzo o rimborso.
- AUP/Fair Use: inclusa come documento distinto collegato ai Termini; modifiche materiali richiedono nuova accettazione.
- DPA: accettazione esclusiva dell'Owner per il workspace, con prova separata.
- Privacy Policy: informativa e prova di versione mostrata; non viene presentata come consenso generale.
- Marketing: consenso globale separato, facoltativo, inizialmente off e revocabile.
- Cookie/tracciamento non tecnico: consenso granulare separato per finalita, inizialmente off.
- Subprocessori: notifica e diritto/mezzo di opposizione o cessazione secondo DPA, non checkbox di consenso individuale impropria.

Checkbox pre-selezionate, silenzio, semplice navigazione e consenso cumulativo non valgono come accettazione quando è richiesto un atto esplicito.

## Versione e prova

Ogni snapshot pubblicato contiene:

- `policyId`, tipo, versione semantica e locale;
- titolo, contenuto HTML/testo, hash e asset allegati;
- stato Draft/Approved/Scheduled/Effective/Superseded/Withdrawn;
- autore, reviewer, approvatore e timestamp;
- effective date, summary delle modifiche e classificazione Materiale/Non materiale/Urgente;
- versioni sostituite e lingue equivalenti;
- base che richiede informativa, presa visione o accettazione.

La prova utente/workspace conserva identificatore soggetto, policy/version/hash, locale mostrato, timestamp, metodo, session/device ID, IP minimizzato, versione precedente, workspace/ruolo e correlation ID. Non conserva una copia ridondante del documento gia hashato.

Versioni superate restano pubblicamente consultabili in archivio con date di efficacia. Una policy pubblicata non viene editata: correzioni generano nuova versione o errata corrige tracciata.

## Approvazione e pubblicazione

1. bozza nel CMS o repository editoriale;
2. legal/privacy review e controllo coerenza con PRD/comportamento reale;
3. test link, accessibilita, locale e rendering;
4. doppia approvazione Legal/Privacy + Platform Owner;
5. snapshot immutabile tramite Policy Publisher;
6. scheduling comunicazioni e richieste di accettazione;
7. monitoraggio errori e prova di invio.

Aggiornamenti urgenti imposti da legge o sicurezza possono avere efficacia immediata, ma richiedono motivazione, approvazione, notifica appena possibile e review successiva.

## Modifiche e preavviso

Modifica materiale include almeno prezzo/rinnovo, diritti e obblighi, uso dati, finalita privacy, sospensione/cancellazione, rimborso, responsabilita, dispute, accesso contenuti e trasferimenti/subprocessori significativi.

- preavviso standard: almeno 30 giorni prima dell'efficacia;
- non materiale: pubblicazione e notifica nel centro comunicazioni, senza nuova accettazione se validato legalmente;
- urgente: efficacia necessaria documentata e comunicazione senza ritardo;
- reminder agli utenti che devono accettare ai giorni -30, -7 e -1;
- data, versione e summary sempre visibili nella richiesta.

Se un utente non accetta entro l'efficacia, la sessione entra in `Policy Restricted`: puo leggere i documenti, accettare, esportare i propri dati, gestire billing/cancellazione o contattare supporto, ma non compiere nuove attivita. Se l'Owner non accetta per il workspace, portfolio e link pubblici vengono sospesi; nessun dato viene cancellato automaticamente. Il rifiuto esplicito consente di programmare chiusura/esportazione secondo contratto e periodo gia pagato.

## Cookie e tracking

- soltanto cookie strettamente necessari prima della scelta;
- `Accetta tutti`, `Rifiuta non necessari` e `Personalizza` con pari evidenza e senza dark pattern;
- categorie separate almeno Necessari, Preferenze, Analytics e Marketing;
- nessun analytics/marketing non esente prima del consenso;
- revoca semplice e permanente tramite link Preferenze cookie;
- consenso registrato con policy/versione, categorie, timestamp e proof ID;
- nuova richiesta soltanto per cambiamenti significativi, impossibilita di riconoscere la scelta o dopo almeno sei mesi quando giustificato dalle regole applicabili;
- delivery e portfolio privi di tracking non essenziale per default; analytics essenziali del workspace progettati in forma aggregata/minimizzata e valutati legalmente.

## Fair Use, sospensione e contenuti

AUP descrive in modo concreto rivendita storage/CDN, backup estraneo, frode, abuso, malware intenzionale, violazioni di diritti, contenuti illeciti e rischio sicurezza. Non usa la formula “senza motivo”.

Ogni restrizione genera, salvo divieto/rischio, una statement of reasons con categoria, fatti essenziali, base contrattuale/legale, ruolo di automazione, durata, dati coinvolti e ricorso. La piattaforma mantiene notice-and-action, contatto e processo di ricorso compatibili con gli obblighi applicabili ai servizi hosting; l'applicabilita concreta DSA/P2B viene validata dal legale.

Ricorso sospende il countdown di cancellazione, non necessariamente la misura protettiva. Nessun rimborso per violazione confermata dell'utente; rimborso proporzionale per indisponibilita imputabile a PortfolioHub secondo policy e diritti inderogabili.

## Autorita, legal hold e trasparenza

- richieste scritte, motivate, verificate e riferite a un'indagine/base valida;
- nessuna consegna indiscriminata dell'intero workspace quando è sufficiente uno scope minore;
- doppia approvazione Legal/Privacy + Security/Operations;
- legal hold limitato, con owner, scadenza e review periodica;
- notifica all'interessato prima o appena consentito;
- registro e report aggregato di trasparenza quando legalmente possibile;
- richieste informali o non valide respinte/documentate.

## Privacy operations

- registro trattamenti, data map, DPIA pre-lancio e review a ogni cambiamento ad alto rischio;
- workflow diritti con verifica identita, ticket, owner e termine ordinario massimo di un mese;
- export interoperabile senza dati di terzi o altri workspace;
- rettifica, opposizione, limitazione e cancellazione propagate ai sistemi e subprocessori pertinenti;
- breach register e processo 72 ore quando la notifica è richiesta;
- subprocessori con DPA, misure, regioni, finalita e data ingresso/uscita;
- contatto privacy pubblicato; nomina DPO soltanto se la valutazione legale ne determina l'obbligo.

## Lingue e prevalenza

Italiano e inglese sono versioni pubblicate, versionate e revisionate. La clausola di prevalenza linguistica, legge applicabile, foro, disciplina B2B/B2C e diritto di recesso vengono stabiliti dal professionista in base ai mercati realmente aperti; non sono dedotti dal codice.

## Gate di lancio

- testi finali firmati dal consulente legale/fiscale;
- comportamento prodotto confrontato con ogni clausola;
- cookie scan e prova assenza tracker prima del consenso;
- DPA/subprocessori/trasferimenti completi;
- Policy Publisher e acceptance proof E2E;
- modalita Policy Restricted, export e chiusura testati;
- notice-and-action, statement of reasons e ricorso esercitati;
- DPIA, ROPA, breach e authority runbook approvati;
- accessibilita HTML delle pagine legali verificata.
