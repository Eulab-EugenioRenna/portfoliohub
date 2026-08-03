# PRD — PortfolioHub SaaS

**Versione:** 1.0 (MVP)
**Obiettivo:** Consentire ad un agente AI di progettare e sviluppare una piattaforma SaaS completa.

---

# 1. Visione

PortfolioHub è una piattaforma SaaS che unisce portfolio professionale, file sharing, consegna ai clienti e collaborazione in un unico prodotto.

L'obiettivo è eliminare la necessità di utilizzare contemporaneamente servizi come Dropbox, Google Drive, WeTransfer, Pixieset e portfolio statici.

La piattaforma deve essere multi-tenant e permettere ad ogni utente di creare il proprio spazio di lavoro con portfolio pubblico e area privata per clienti e collaboratori.

---

# 2. Obiettivi

## MVP

Realizzare una piattaforma funzionante che permetta:

* registrazione utenti
* autenticazione
* gestione team
* gestione clienti
* gestione progetti
* portfolio pubblico
* file manager
* upload/download sicuro
* condivisione tramite link
* billing con Stripe
* amministrazione della piattaforma

---

# 3. Tecnologie

## Monorepo

NX

## Frontend

Angular (ultima versione stabile)

Standalone Components

Signals

Signal Store

TailwindCSS

SSR

## Backend

NestJS

Prisma ORM

PostgreSQL

Redis

RabbitMQ

BullMQ

Sanity CMS

Stripe

Docker

---

# 4. Architettura

La piattaforma è composta da due sistemi separati.

## VPS

Contiene tutta la logica applicativa.

Responsabilità:

* autenticazione
* autorizzazione
* database
* billing
* portfolio
* gestione utenti
* gestione file
* ACL
* API
* notifiche
* logging

## Hosting Aruba

Non contiene logica applicativa.

Contiene esclusivamente:

* filesystem
* gateway PHP
* upload
* download
* streaming
* trasferimento di originali e derivati
* callback

Il gateway PHP non conosce utenti, ruoli o piani.

---

# 5. Storage

Lo storage deve essere completamente astratto.

Creare un'interfaccia:

StorageProvider

Implementazioni previste:

* ArubaPhpProvider (MVP)
* LocalProvider
* S3Provider
* CloudflareR2Provider
* MinioProvider (solo sviluppo)

L'applicazione utilizza esclusivamente StorageProvider.

---

# 6. Download

Il browser non deve mai ricevere link diretti allo storage.

Flusso:

1. utente apre un link PortfolioHub
2. Angular contatta Nest
3. Nest verifica ACL
4. Nest genera token temporaneo
5. Angular richiama PHP Aruba
6. PHP verifica il token
7. PHP restituisce il file

I link devono essere sempre del tipo:

https://app.domain.com/s/{shareId}

Mai:

https://storage.domain.com/file.pdf

---

# 7. Upload

Flusso:

1. richiesta upload
2. verifica quota
3. verifica piano
4. verifica permessi
5. generazione token
6. upload diretto al gateway PHP
7. salvataggio filesystem
8. callback verso Nest
9. registrazione database

---

# 8. Autenticazione

Supportare:

* Email
* Google
* GitHub
* Magic Link

Prevedere:

JWT

Refresh Token

Sessioni

2FA (Pro)

---

# 9. Autorizzazione

Matrice completa: [RBAC_MATRIX.md](./RBAC_MATRIX.md).

Implementare RBAC + ACL.

Ruoli:

Owner

Admin

Editor

Uploader

Viewer

Guest

L'Owner è l'unico ruolo autorizzato a leggere ed esportare l'Audit workspace. L'Admin e gli altri ruoli accedono soltanto alla Cronologia attività filtrata dagli ACL.

Permessi granulari su:

Team

Project

Folder

File

Portfolio

Share

---

# 10. Multi Tenant

Ogni tenant possiede:

Team

Utenti

Portfolio

Clienti

Progetti

Storage

Billing

Tema

Dominio

---

# 11. Billing

Stripe

Supportare:

Trial

Upgrade

Downgrade

Coupon

Webhook

Customer Portal

Piani:

Free

Starter

Pro

Agency

Enterprise

---

# 12. Piano Free

50 GB

30 giorni

1 Team

3 Progetti

Portfolio Basic

Dominio PortfolioHub

---

# 13. Portfolio

Ogni utente dispone di un portfolio pubblico.

Funzionalità:

Homepage

Gallery

Hero

Contatti

SEO

Blog

Analytics

Dominio personalizzato

---

# 14. Theme

Tipologie:

Basic

Pro

Premium

Custom

Ogni tema deve essere completamente configurabile.

---

# 15. Team

Ogni tenant può invitare collaboratori.

Permessi configurabili.

La piattaforma separa due superfici:

* `Cronologia attività`: eventi operativi leggibili da ogni membro soltanto per le risorse comprese nel proprio scope; non include sicurezza, billing, gestione membri, cancellazioni, legal hold o operazioni amministrative riservate;
* `Audit workspace`: registro immutabile e completo, consultabile esclusivamente dall'Owner.

L'Admin non può consultare o esportare l'Audit workspace. Può vedere la Cronologia attività delle risorse che amministra. Editor, Uploader, Viewer e Guest vedono soltanto la cronologia compatibile con ruolo e ACL. Il cliente non accede all'audit e vede nell'esperienza di consegna soltanto commenti, approvazioni e azioni che lo riguardano.

Le API di cronologia e audit sono separate e applicano policy distinte; un filtro della UI non costituisce una protezione. Download, export e ricerca dell'audit richiedono autorizzazione Owner sul backend.

Retention:

* Cronologia attività: 12 mesi mobili;
* Audit workspace: 24 mesi mobili;
* allo scadere, il Cleanup Worker elimina o anonimizza irreversibilmente gli eventi secondo il loro schema;
* fatture, consensi, eventi di sicurezza soggetti a indagine, prova di cancellazione e legal hold usano registri e retention dedicate;
* una retention speciale conserva soltanto i campi necessari e non prolunga automaticamente Cronologia attività o Audit workspace;
* dopo la cancellazione del workspace, audit e cronologia seguono la purge prevista, salvo singoli record posti legittimamente in conservazione separata.

La UI mostra all'Owner l'intervallo disponibile e la data di scadenza degli eventi; l'export non modifica né prolunga la retention server-side.

L'Audit workspace registra eventi di dominio e accessi sensibili:

* autenticazione e sicurezza: login anomali o falliti rilevanti, cambio credenziali, 2FA, sessioni revocate e recuperi;
* proprietà, membri, inviti, ruoli, ACL e trasferimenti di ownership;
* creazione, modifica, spostamento, archiviazione, eliminazione e ripristino di progetti, cartelle, File e versioni;
* upload completati/falliti, sostituzioni di versione e cancellazioni fisiche;
* creazione, attivazione, modifica policy, consumo one-shot, scadenza e revoca di consegne e link;
* apertura di una consegna da parte del cliente, download completati, avvio playback autorizzato, commenti e approvazioni;
* pubblicazione, modifica pubblicata e ritiro del Portfolio;
* cambi piano, webhook billing determinanti, superamento quota, blocco e `Svuota e passa a Free`;
* sospensione, ricorso, cancellazione account/workspace, ripristino durante la finestra consentita e completamento purge;
* accessi amministrativi di piattaforma, export audit, legal hold e richieste valide dell'autorità.

Non entrano nell'Audit workspace: apertura ordinaria di pagine interne, caricamento thumbnail, polling, health check, job heartbeat, retry tecnici, singole richieste HTTP Range della stessa sessione e altri eventi senza effetto di dominio. Questi segnali appartengono a log e metriche operative con retention propria.

## Cancellazione volontaria dell'Owner

Se l'Owner elimina il proprio account senza trasferire la proprietà, nello stesso commit applicativo vengono programmati account e workspace per la cancellazione a 30 giorni ed entrano in `Quarantena cancellazione`.

Durante la quarantena:

* tutte le sessioni dell'Owner e dei membri vengono revocate;
* nessun membro può entrare o modificare il workspace;
* link di collaborazione, consegne, link personali cliente, one-shot e portfolio pubblico vengono disabilitati;
* upload, download, playback, preview, email operative non indispensabili e job di elaborazione non partono;
* i dati restano conservati senza essere modificati, salvo attività tecniche necessarie alla sicurezza, billing, retention e legal hold;
* la UI pubblica mostra una risposta neutra e non rivela che il workspace è in cancellazione;
* il workspace non può essere trasferito, esportato o scaricato finché la richiesta non viene annullata.

Entro 30 giorni l'Owner può annullare la cancellazione tramite un link inviato all'email verificata, seguito da riautenticazione. Il ripristino è atomico: riabilita account, membri, risorse e link non scaduti o revocati prima della quarantena e genera un evento audit. I link scaduti per la propria scadenza naturale restano scaduti.

Allo scadere del trentesimo giorno, se non esiste un annullamento valido, il Cleanup Worker avvia la purge asincrona e impedisce definitivamente il ripristino applicativo. I soli record coperti da retention dedicata o legal hold vengono isolati dalla workspace operativa.

Comunicazioni:

* l'Owner riceve conferma immediata con data/ora della purge e istruzioni di annullamento;
* l'Owner riceve promemoria ai giorni 7, 23 e 29, senza creare nuovi token prima della richiesta esplicita di ripristino;
* tutti i membri ricevono l'avviso iniziale e l'esito finale di ripristino o cancellazione, ma non possono annullare la richiesta;
* clienti e destinatari dei link non ricevono email sulla cancellazione del workspace;
* le comunicazioni di cancellazione e sicurezza restano abilitate durante la quarantena anche se le email operative ordinarie sono sospese.

Billing durante la quarantena:

* ogni rinnovo viene programmato per la cancellazione alla fine del periodo corrente e non vengono creati nuovi addebiti ricorrenti;
* il periodo corrente non viene rimborsato automaticamente, coerentemente con la cancellazione volontaria già definita e salvo diritti inderogabili;
* il ripristino non riattiva automaticamente il rinnovo: l'Owner deve confermarlo esplicitamente;
* se il periodo pagato è scaduto, il workspace ripristinato passa a Free e applica le normali regole di blocco oltre quota.

Backup e prova di cancellazione:

* i backup cifrati hanno una finestra mobile massima di 30 giorni;
* la purge crea tombstone non reversibili che devono essere riapplicati in ogni restore, impedendo che un backup riporti online dati già cancellati;
* i dati purgati possono restare cifrati e non accessibili nei backup fino alla naturale sovrascrittura, comunque entro 30 giorni dal completamento della purge;
* legal hold e retention dedicate sono esclusi dal dataset ordinario e conservano soltanto i record necessari;
* al completamento viene generato un certificato di cancellazione con identificatori pseudonimizzati, timestamp richiesta/inizio/fine, categorie eliminate, eventuali categorie trattenute e relativa base, versione della procedura e correlation ID;
* il certificato non contiene nomi file, contenuti, token o dati eccedenti ed è conservato per 24 mesi;
* una copia viene inviata all'indirizzo verificato dell'ex Owner; la prova interna è accessibile soltanto al personale autorizzato per compliance.

---

# 16. Clienti

Ogni cliente può:

visualizzare file

scaricare

commentare (Pro)

approvare consegne

ricevere notifiche

---

# 17. Progetti

Ogni progetto contiene:

cartelle

file

clienti

collaboratori

commenti

revisioni

versioni

share

---

# 18. File Manager

Supportare:

Grid

Lista

Ricerca

Tag

Preferiti

Drag & Drop

Move

Rename

Copy

Delete

Bulk

Metadata

---

# 19. Preview

L'MVP usa worker di preview dedicati sulla VPS. Aruba conserva e serve gli oggetti, ma non esegue conversioni pesanti. NestJS non elabora file nel processo API.

Pipeline:

1. il commit della versione file salva l'originale e un evento nella Transactional Outbox;
2. RabbitMQ consegna l'evento al coordinatore preview;
3. il coordinatore crea un job idempotente nella coda BullMQ appropriata;
4. il worker ottiene da `StorageProvider` un grant interno temporaneo per leggere l'originale;
5. il worker elabora in una directory temporanea con spazio limitato;
6. i derivati vengono scritti come oggetti immutabili tramite `StorageProvider`;
7. PostgreSQL registra stato, formato, dimensione e riferimenti dei derivati;
8. un evento aggiorna UI e notifiche senza bloccare il file originale.

Code e processi sono separati per classe di carico:

* `preview-image`: thumbnail e preview di immagini, PSD e RAW;
* `preview-document`: PDF e documenti Office convertiti in rappresentazioni web;
* `preview-media`: poster, proxy video/audio e metadata multimediali;
* `preview-archive`: elenco sicuro dei contenuti ZIP, senza estrazione persistente.

Ogni classe usa una propria immagine container e installa soltanto i convertitori necessari. Non esiste un'immagine universale con tutti gli strumenti. Questo consente versionamento, aggiornamenti, rollback, contract test e gestione delle vulnerabilità indipendenti per immagini, documenti, media e archivi.

Toolchain MVP:

* immagine `preview-image`: libvips come pipeline principale, ImageMagick per i formati compatibili non coperti e LibRaw per i RAW supportati;
* immagine `preview-document`: LibreOffice in modalità headless per produrre PDF e Poppler per metadata, rendering e thumbnail PDF;
* immagine `preview-media`: FFmpeg e ffprobe per identificazione, poster e proxy video/audio web;
* immagine `preview-archive`: libarchive per leggere e validare l'indice ZIP senza estrazione persistente.

Le versioni di sistema, tool e codec sono bloccate nell'immagine e registrate nel manifest di build. Ogni immagine pubblica un capability manifest verificato dai contract test; soltanto i formati presenti nel manifest possono essere mostrati come supportati. Aggiornare un convertitore richiede rebuild, scansione delle dipendenze, test del corpus e rollout indipendente con possibilità di rollback.

Office, PSD e RAW sono anteprime fedeli quanto consentito dal convertitore, ma non promettono identità pixel-perfect con l'applicazione autrice. La UI conserva sempre l'originale e rende esplicito che la rappresentazione è un'anteprima.

Ogni job gira in un container effimero o sandbox equivalente con:

* utente non-root e nessuna escalation di privilegi;
* root filesystem in sola lettura;
* rete disabilitata durante la conversione;
* input in sola lettura e directory temporanea dedicata, vuota a inizio job;
* limiti cgroup per CPU e RAM e limiti per processi/file descriptor;
* timeout rigido e terminazione dell'intero process group;
* cleanup della directory temporanea anche dopo errore o timeout;
* nessun secret applicativo, credenziale persistente o socket Docker montato.

Il runner prepara input e grant prima della sandbox e trasferisce l'output verificato tramite un componente controllato. I convertitori non contattano direttamente Aruba, database, Redis, RabbitMQ o servizi internet.

La piattaforma mira a offrire:

* immagini JPEG, PNG, WebP e GIF direttamente, con thumbnail ottimizzate;
* PSD e RAW come preview raster derivata quando il decoder supporta il formato specifico;
* video come poster e proxy web riproducibile con HTTP Range;
* audio come proxy web riproducibile e metadata;
* PDF direttamente e tramite thumbnail;
* Office tramite derivato PDF e thumbnail;
* ZIP tramite elenco sicuro dei contenuti, senza estrazione sullo storage.

Il supporto non viene dedotto dalla sola estensione: il worker identifica il formato reale e può restituire `Non supportata` per codec, variante o file corrotto non elaborabile.

L'upload riuscito resta `Completato` anche quando la preview è `Non supportata` o `Fallita`. La UI distingue `In coda`, `In elaborazione`, `Disponibile`, `Non supportata` e `Fallita`, mostra il motivo utile all'utente e consente sempre le azioni compatibili con l'originale.

## Isolamento risorse preview

I worker sono servizi/processi distinti dall'API e usano code, concorrenza e priorità indipendenti. Devono avere limiti rigidi di CPU, RAM, I/O, spazio temporaneo, durata e dimensione di input; girano a priorità inferiore rispetto ad API, database, Redis e RabbitMQ. Un job pesante non può occupare tutti i core né impedire l'esecuzione dei job leggeri.

Il profilo MVP è conservativo e si applica al pool preview complessivo, non a ogni singolo worker:

* massimo 30% della capacità CPU della VPS;
* massimo 25% della RAM della VPS;
* una sola elaborazione pesante contemporanea;
* massimo due elaborazioni leggere contemporanee;
* processi e I/O a priorità inferiore rispetto ai servizi interattivi;
* sospensione dell'avvio di nuovi job quando CPU o RAM complessive della VPS raggiungono il 75%;
* ripresa automatica soltanto dopo il rientro sotto la soglia con isteresi, per evitare continui stop/start.

La classificazione `Leggero` o `Pesante` avviene prima dell'esecuzione usando tipo, dimensione, numero di pagine, risoluzione e durata disponibili. In caso di dubbio il job è `Pesante`. I limiti devono essere imposti a livello di container/cgroup o unità di servizio, non affidati soltanto alla concorrenza BullMQ.

Il coordinatore applica backpressure: quando capacità o spazio temporaneo sono esauriti, i job restano durevolmente `In coda` invece di avviare nuovi processi. Timeout e processi figli vengono terminati e ripuliti. Retry limitati con backoff gestiscono errori transitori; file corrotti, formati non supportati e limiti superati non entrano in retry infinito. Dopo i tentativi previsti il job va in DLQ, con replay manuale auditabile.

Health check e metriche misurano almeno profondità/età code, job attivi, durata, successi/fallimenti, timeout, CPU, RAM, I/O e spazio temporaneo. Se una soglia di protezione viene superata, i worker si mettono in pausa; upload, download e API restano disponibili.

Ogni convertitore è dietro un contratto interno e deve superare capability probe e contract test nella propria immagine container di produzione. Tool, codec e limiti numerici sono configurazione versionata dell'ambiente, non capacità presunte del server Aruba. Il toolchain è interamente locale alla VPS: nessun file viene inviato a servizi esterni di conversione.

---

# 20. Video

Streaming HTTP Range.

Player integrato.

Thumbnail.

Preview.

---

# 21. Share

Permettere:

password

scadenza

download limitato

view only

download disabilitato

revoca

---

# 22. Database

Entità principali:

Users

Tenants

Teams

Projects

Folders

Files

StorageObjects

Clients

Portfolio

PortfolioPages

Themes

Shares

Invitations

Permissions

Roles

Subscriptions

Invoices

Payments

Usage

Notifications

AuditLogs

Events

---

# 23. RabbitMQ

Utilizzare RabbitMQ come broker eventi.

Eventi principali:

UserRegistered

ProjectCreated

UploadCompleted

DownloadCompleted

ShareCreated

ShareRevoked

PortfolioPublished

InvoicePaid

SubscriptionChanged

NotificationCreated

Contratto eventi:

* RabbitMQ trasporta eventi di dominio durevoli
* BullMQ esegue job concreti, retry e scheduling dei worker
* Transactional Outbox PostgreSQL garantisce coerenza tra mutazione ed evento
* consegna at-least-once con consumer idempotenti e inbox di deduplica
* envelope versionato con eventId, workspace, aggregate, timestamp, actor, correlation e causation
* ordine soltanto per singolo aggregate, mai globale
* retry con backoff, dead-letter e replay manuale auditabile
* payload minimi per ID, senza token, segreti, URL temporanei o corpi file
* PostgreSQL resta fonte di verità; BullMQ non contiene stato di dominio autorevole

---

# 24. Worker

Worker separati e isolati dal processo API.

Image Preview Worker

Document Preview Worker

Media Preview Worker

Archive Inspection Worker

Email Worker

Notification Worker

Analytics Worker

Storage Usage Worker

Cleanup Worker

---

# 25. Redis

Session

Cache

Rate Limit

OTP

Distributed Lock

Queue Cache

---

# 26. Notifiche

Email

In-App

Webhook

Push (futuro)

Regole MVP:

* centro notifiche in-app con lette/non lette, segna tutte e deep link
* eventi: inviti, upload falliti, commenti, approvazioni, aperture/download consegne, quote, billing, sicurezza, sospensione e contatti portfolio
* nessuna notifica per azioni compiute dallo stesso utente
* raggruppamento degli eventi ripetitivi
* Owner e Admin ricevono billing, quota e sicurezza
* partecipanti del progetto ricevono eventi nel proprio scope
* autore della consegna riceve le interazioni cliente
* retention in-app 90 giorni, audit separato
* webhook configurabili dagli utenti post-MVP; webhook infrastrutturali nel backend MVP

---

# 27. CMS

Sanity CMS dietro interfaccia `ContentProvider`, limitato ai contenuti editoriali pubblici di PortfolioHub: marketing, FAQ, documentazione, release notes e bozze legali. Blog e marketplace temi sono post-MVP.

Nessun dato di workspace, cliente, progetto, consegna o Portfolio utente vive nel CMS. PostgreSQL resta fonte di verità per dominio applicativo, catalogo piani, policy pubblicate e consensi.

Le policy redatte nel CMS diventano pubbliche soltanto tramite `Policy Publisher`, che salva in PostgreSQL uno snapshot immutabile, versionato e hashato. Prezzi e entitlement mostrati dal sito provengono dal catalogo backend, non da testo CMS.

Marketing, app, API, Admin, delivery e portfolio usano origin distinti. Dettagli in [CONTENT_BOUNDARIES.md](./CONTENT_BOUNDARIES.md).

---

# 28. Admin Dashboard

Applicazione separata dall'app workspace, definita in [ADMIN_OPERATIONS.md](./ADMIN_OPERATIONS.md).

Include viste operative per account/workspace, billing, storage, code, worker, email, webhook, backup, incidenti e audit staff. Non espone contenuti, password, token, chiavi o dati di pagamento completi nella vista ordinaria.

Ruoli staff distinti: Support, Billing Operations, Trust & Safety, Security Operations, Platform Operations e Platform Owner. Account personali e 2FA obbligatori.

Nessuna impersonazione invisibile. Support Session concessa dall'Owner, read-only, scope limitato e massimo 30 minuti. Break-glass massimo 15 minuti soltanto per sicurezza/legalita, con doppia approvazione e review entro 24 ore.

Mutazioni come comandi espliciti e auditati; azioni distruttive, disclosure, legal hold, restore e chiavi master richiedono doppia approvazione. Audit staff append-only separato, retention 24 mesi.

---

# 29. Logging

Registrare:

API

Worker

Storage

Billing

Errori

Webhook

Audit

---

# 30. Monitoring

SLO, error budget, prestazioni, accessibilita e browser support sono definiti in [QUALITY_SLOS.md](./QUALITY_SLOS.md).

Stack consigliato:

Prometheus

Grafana

Loki

Promtail

Alertmanager

Node Exporter

cAdvisor

Uptime Kuma

Stack Enterprise opzionale:

ElasticSearch

Logstash

Kibana

OpenTelemetry

Jaeger

---

# 31. Sicurezza

Il contratto completo è in [SECURITY_ARCHITECTURE.md](./SECURITY_ARCHITECTURE.md).

Requisiti inderogabili dell'MVP:

* TLS end-to-end, cookie sessione sicuri, refresh rotation e CSRF token;
* CORS per origin esatti, header browser difensivi e origin separato per contenuti pubblici;
* RBAC + ACL applicati dal backend e test anti-IDOR;
* password Argon2id, token casuali persistiti come hash e riautenticazione per azioni critiche;
* originali e derivati cifrati a chunk con AEAD e envelope encryption prima della persistenza su Aruba;
* `KeyProvider` e Key Broker separati dallo storage, con chiavi mai presenti su Aruba o nel database in chiaro;
* rate limit Redis misurabili per auth, link, mutazioni, upload e download;
* file trattati come non fidati e convertitori sandboxati; nessun virus scan e nessuna attestazione di sicurezza del file;
* core data in UE, subprocessori documentati e contenuti esclusi da email/log/analytics;
* privacy workflow entro i termini applicabili, abuse handling, legal hold limitato e incident response;
* secret manager, rotazione, vulnerability management, penetration test e restore/key recovery test come gate di lancio.

---

# 32. Docker

Ambienti, pipeline, backup e disaster recovery sono definiti in [DEPLOYMENT_AND_RECOVERY.md](./DEPLOYMENT_AND_RECOVERY.md).

Container principali:

Traefik

Angular

Nest

Worker

Scheduler

RabbitMQ

Redis

PostgreSQL

Sanity

Grafana

Prometheus

Loki

Promtail

Uptime Kuma

---

# 33. Principi Architetturali

Strategia di test e criteri di accettazione: [TEST_STRATEGY.md](./TEST_STRATEGY.md).

Sequenza di implementazione e rilascio: [RELEASE_PLAN.md](./RELEASE_PLAN.md).

* Nessun accesso diretto allo storage.
* Tutte le autorizzazioni vengono decise dal backend NestJS.
* Il gateway PHP Aruba è completamente stateless.
* Tutti i file transitano tramite token temporanei firmati.
* L'applicazione comunica esclusivamente con l'interfaccia `StorageProvider`.
* Tutti i processi pesanti devono essere asincroni tramite RabbitMQ.
* Il sistema deve essere completamente multi-tenant.
* L'architettura deve essere modulare, facilmente estendibile e predisposta alla sostituzione del provider di storage senza modifiche alla logica di business.

---

# 34. Email e comunicazioni

Rate limit, massive, deliverability e incidenti sono definiti in [EMAIL_OPERATIONS.md](./EMAIL_OPERATIONS.md).

La piattaforma deve includere un sottosistema email completo e provider-agnostic, eseguito tramite Email Worker asincrono.

Categorie minime:

* verifica email
* magic link
* reset password
* recupero e modifica sicurezza account
* inviti collaboratori
* consegne ai clienti
* commenti e approvazioni
* notifiche di quota
* trial e billing
* pagamenti falliti
* sospensione e cancellazione account
* incidenti di sicurezza e servizio
* modifiche contrattuali e policy
* comunicazioni massive autorizzate

Requisiti:

* template versionati e localizzabili
* mittenti e domini verificati
* coda, retry con backoff e dead-letter
* idempotenza e prevenzione duplicati
* rate limiting
* gestione bounce e complaint
* suppression list globale
* preferenze per categoria e canale
* unsubscribe dove applicabile
* separazione tra email obbligatorie di servizio e marketing
* consenso e base giuridica tracciabili
* audit di richiesta, invio, consegna, bounce e complaint
* webhook firmati dal provider email
* nessun segreto o provider specifico nel browser

Il provider MVP è Resend Pro, integrato esclusivamente tramite un'interfaccia applicativa `EmailProvider` sostituibile. Template, consensi, preferenze, audit, suppression e stato dei messaggi appartengono a PortfolioHub e non al provider.

Confine MVP:

* PortfolioHub può inviare email operative per autenticazione, link di consegna, inviti e collaborazioni
* i workspace possono attivare esclusivamente messaggi operativi legati alle proprie attività
* i workspace non possono inviare campagne, newsletter o comunicazioni massive ai clienti
* le comunicazioni massive possono essere inviate soltanto da PortfolioHub ai propri utenti

Identità mittente MVP:

* `accesso@auth.portfoliohub.com` per autenticazione e sicurezza
* `notifiche@mail.portfoliohub.com` per inviti, collaborazioni, consegne, commenti, approvazioni e billing
* `aggiornamenti@updates.portfoliohub.com` per comunicazioni massive della piattaforma
* le email workspace mostrano `<nome workspace> via PortfolioHub`
* il Reply-To può usare soltanto un indirizzo workspace verificato

Preferenze e consenso:

* autenticazione, sicurezza, billing, sospensione, cancellazione, incidenti critici e modifiche contrattuali sostanziali non sono disattivabili
* commenti, approvazioni, attività progetto, promemoria e digest sono configurabili per workspace e canale
* marketing e aggiornamenti prodotto richiedono consenso globale esplicito, inizialmente disattivato, e unsubscribe one-click
* il cliente può bloccare i messaggi successivi di uno specifico workspace
* le preferenze di un'identità cliente restano isolate per workspace mittente
* hard bounce e complaint inseriscono l'indirizzo in suppression e producono feedback visibile nella UI
* anche le email obbligatorie rispettano la suppression tecnica

Affidabilità:

* stati messaggio: In coda, Accettata dal provider, Consegnata, Rimbalzata, Segnalata, Soppressa, Fallita
* idempotency key per evento, destinatario e versione template
* retry degli errori temporanei dopo 30 secondi, 2 minuti, 10 minuti, 30 minuti e 2 ore
* nessun retry oltre la scadenza di token e link temporanei
* nessun retry per errori permanenti, complaint e suppression
* dead-letter dopo l'ultimo tentativo e alert per messaggi critici
* stato visibile e reinvio manuale per inviti e consegne
* webhook Resend firmati e idempotenti

Retention email:

* nessun corpo HTML o testo completo salvato stabilmente nel database
* conservazione di template, versione e parametri minimi necessari
* metadata di invio e delivery per 12 mesi
* token salvati come hash ed eliminati 24 ore dopo la scadenza
* prova di consenso, revoca e accettazione policy per durata account e periodo legale successivo
* suppression finché l'indirizzo resta associato o viene verificato nuovamente
* billing, sicurezza e richieste autorità seguono retention legali dedicate
* eliminazione o anonimizzazione automatica tramite Cleanup Worker

---

# 35. Policy, termini e compliance

Governance, versioni, accettazioni, cookie e gate legali sono definiti in [POLICY_GOVERNANCE.md](./POLICY_GOVERNANCE.md).

La piattaforma deve pubblicare documenti coerenti con il comportamento reale del prodotto e mantenerne versioni e storico.

Documenti minimi:

* Condizioni d'uso
* Privacy Policy
* Cookie Policy e gestione preferenze
* Acceptable Use / Fair Use Policy
* Policy di cancellazione e rimborso
* Data Processing Agreement
* elenco subprocessori
* contatti legali e privacy
* procedura per richieste delle autorità

Requisiti:

* versionamento e data di efficacia
* evidenza dell'accettazione quando richiesta
* notifica delle modifiche sostanziali
* distinzione tra comunicazioni obbligatorie e marketing
* sospensione immediata per cause definite dalla fair-use policy
* possibilità di ricorso con sospensione del countdown di cancellazione durante la revisione
* cancellazione dopo 7 giorni consecutivi di sospensione confermata
* cancellazione volontaria del workspace dopo 30 giorni
* legal hold per obblighi legali, fiscali, richieste valide dell'autorità e difesa di diritti
* comunicazione di dati alle sole autorità competenti sulla base di una richiesta o base giuridica valida, verificata, proporzionata e auditata
* testi finali sottoposti a revisione legale e fiscale professionale prima del lancio

---

# 36. Catalogo piani e misurazione

Piani MVP:

* Free: €0, 50 GB storage, 50 GB traffico mensile, un progetto, massimo 3 membri
* Pro: €24,90/mese o €249/anno, 1 TB storage, 3 TB traffico mensile, progetti illimitati, massimo 10 membri
* Unlimited: €159,90/mese o €1.599/anno, nessun limite numerico prefissato per storage, traffico, progetti, clienti, consegne e membri, soggetto a fair-use

I prezzi sono importi finali e la UI non mostra diciture IVA. La configurazione fiscale appartiene al backend di fatturazione.

Limite singolo file:

* Free: massimo 50 GB e comunque non oltre la quota storage residua
* Pro e Unlimited: massimo tecnico 100 GB

Misurazione:

* storage e traffico vengono sommati in byte interi esatti
* 1 GB equivale a 1.000.000.000 byte
* la conversione arrotonda per eccesso soltanto il totale aggregato
* nessun file o evento viene arrotondato individualmente
* la quota storage commerciale conteggia i File logici originali, non thumbnail, poster, proxy, PDF di anteprima o altri derivati tecnici
* i derivati sono misurati separatamente come costo infrastrutturale per capacity planning
* i byte di originali e derivati effettivamente serviti al browser consumano la quota traffico
* generazione e rigenerazione interna dei derivati non consumano traffico commerciale

Ciclo abbonamento:

* upgrade immediato con prorata e quote disponibili dopo webhook riuscito
* downgrade a fine periodo senza rimborso anticipato
* cancellazione efficace a fine periodo con passaggio a Free
* cambio mensile/annuale alla scadenza salvo upgrade immediato
* coupon gestiti nel Checkout
* Customer Portal per pagamento, fatture, rinnovo, cancellazione e cambio piano
* backend unica fonte di verità tramite webhook Stripe firmati e idempotenti
* il redirect Checkout non prova il pagamento

Downgrade oltre quota:

* se i dati superano i limiti Free, il workspace viene bloccato alla data effettiva del downgrade
* portfolio e link esterni vengono disattivati
* consultazione, export e download non sono consentiti
* le sole azioni disponibili sono il pagamento per ripristinare il piano precedente oppure lo svuotamento dei dati
* `Svuota e passa a Free` richiede riautenticazione e digitazione del nome workspace
* lo svuotamento revoca tutti i link ed elimina irreversibilmente, senza cestino o download, progetti, file, versioni, cartelle, clienti, consegne, portfolio, inviti e collaboratori
* restano soltanto account Owner, workspace vuoto, fatture, consensi, audit e legal hold obbligatori

Pagamento fallito:

* stato `Pagamento in ritardo` senza blocco immediato
* 7 giorni di tolleranza con tentativi di pagamento e avvisi ai giorni 0, 3 e 6
* funzioni e link restano attivi durante la tolleranza
* pagamento riuscito ripristina lo stato tramite webhook
* dopo 7 giorni il workspace passa a Free
* se conforme ai limiti Free continua, altrimenti entra nel blocco paga/svuota
