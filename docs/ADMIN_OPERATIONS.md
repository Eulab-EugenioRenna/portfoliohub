# Admin globale e support operations

Stato: approvato per MVP il 31 luglio 2026.

## Confine

L'Admin globale è un'applicazione separata dall'app workspace, su origin dedicato e non raggiungibile con una normale sessione utente. Serve a operare la piattaforma, non a lavorare al posto dei clienti.

Ogni operatore usa un account personale verificato, 2FA obbligatoria, sessione breve e dispositivo registrato. Account condivisi, credenziali generiche e accesso diretto al database di produzione non sono procedure operative accettate.

## Ruoli staff

- `Support`: consulta metadata diagnostici, stato email, piano, quota e timeline di servizio; può reinviare messaggi idempotenti e guidare l'utente.
- `Billing Operations`: consulta stato Stripe sincronizzato, fatture e webhook; può avviare procedure esplicite di rimborso/correzione entro policy.
- `Trust & Safety`: gestisce segnalazioni, sospensioni, ricorsi e richieste contenuto mediante case.
- `Security Operations`: gestisce incidenti, sessioni, credenziali workload, legal hold tecnico e break-glass.
- `Platform Operations`: monitora deploy, code, worker, storage reconciliation, backup e restore; non accede ai contenuti per default.
- `Platform Owner`: assegna ruoli staff e approva azioni eccezionali; non può cancellare o alterare l'audit staff.

Un operatore può avere più ruoli soltanto quando documentato. Le azioni che richiedono due persone devono essere approvate da un secondo account idoneo, mai dallo stesso operatore con un altro ruolo.

## Vista ordinaria

La vista predefinita mostra il minimo necessario:

- identificatori, stato account/workspace, piano e lifecycle;
- utilizzo aggregato, contatori e stato dei servizi;
- eventi tecnici correlati, senza payload sensibili;
- stato di email, webhook, job e code;
- sessioni e dispositivi come metadata, mai token;
- audit delle precedenti azioni staff sul soggetto.

Ricerca utenti e workspace tramite identificatore esatto o email esatta; niente directory liberamente esplorabile o ranking per contenuto. PII non necessaria è mascherata. Password, recovery code, token, secret, chiavi, URL firmati e dati di pagamento completi non sono mai visibili.

## Contenuti e support session

Non esiste impersonazione invisibile. Per riprodurre un problema dentro un workspace, l'Owner può concedere una `Support Session`:

- consenso esplicito con scopo e motivazione visibili;
- durata massima 30 minuti, revocabile in ogni momento;
- sola lettura della UI e delle risorse incluse nello scope;
- banner persistente per operatore e Owner;
- niente download originali, export, billing, sicurezza, membri, audit workspace, creazione link o mutazioni;
- registrazione di apertura, viste sensibili e chiusura nell'audit staff e nell'Audit workspace dell'Owner.

Il supporto deve preferire dati sintetici, screenshot forniti dall'utente e correlation ID. Una Support Session non può essere estesa silenziosamente.

## Break-glass

Senza consenso dell'Owner, l'accesso a metadata o contenuti oltre la vista ordinaria è consentito soltanto per incidente di sicurezza, rischio urgente, richiesta legale valida o tutela dell'integrità della piattaforma.

Richiede:

1. case con base, scope, urgenza e durata;
2. approvazione di due persone tra Security, Trust & Safety, Privacy/Legal e Platform Owner secondo il caso;
3. riautenticazione e credenziale effimera, massimo 15 minuti;
4. accesso soltanto alle risorse nominate;
5. registrazione append-only e review entro 24 ore;
6. notifica all'Owner prima dell'accesso o appena cessa un eventuale divieto/rischio.

Il break-glass non permette di conoscere password o chiavi e non rende cancellabili i log.

## Azioni esplicite

Le mutazioni staff non vengono eseguite tramite impersonazione: sono comandi amministrativi nominati, con anteprima del target, motivo obbligatorio, idempotency key ed esito auditato.

Richiedono doppia approvazione:

- cancellazione anticipata o purge manuale;
- legal hold, export o divulgazione di contenuti;
- sospensione permanente o rigetto definitivo di un ricorso;
- rimborso fuori policy o oltre soglia configurata;
- restore di produzione;
- rotazione di chiavi master o disattivazione di un controllo di sicurezza.

Reinvio email, retry di job idempotente, revoca di una singola sessione compromessa e correzioni entro policy possono richiedere un solo operatore autorizzato, ma sempre un motivo e audit.

## Audit staff

Ogni visualizzazione sensibile, ricerca, support session, break-glass, approvazione e mutazione registra:

- operatore e ruolo effettivo;
- case/ticket e motivo;
- target e scope;
- timestamp, IP e device/session ID;
- stato precedente e successivo per le mutazioni;
- approvatore quando richiesto;
- correlation ID ed esito.

L'audit staff è append-only, separato dagli audit workspace, non modificabile dagli operatori e conservato 24 mesi; case legali o di sicurezza possono isolare i soli record necessari con retention dedicata. Alert automatici rilevano accessi massivi, ricerca anomala, break-glass, export e tentativi negati.

## Gate MVP

- matrice permessi testata per ogni ruolo staff;
- 2FA e session timeout obbligatori;
- test che provano l'assenza di token/secret/contenuti nella vista ordinaria;
- support session scope/read-only/revoca verificati end-to-end;
- doppia approvazione senza self-approval;
- audit append-only e alert accessi anomali;
- esercitazione break-glass e review entro 24 ore.
