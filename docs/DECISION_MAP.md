# PortfolioHub — Decision map

Questo file è la mappa canonica delle decisioni necessarie per trasformare `PRD.md` in un PRD implementabile. Le risposte già presenti nel PRD sono marcate **Risolto**; tutto il resto resta esplicitamente aperto finché non viene deciso con il product owner.

## #1: Utente primario e primo risultato utile

Blocked by: —
Type: Discuss

### Question

Per chi ottimizziamo l'MVP e qual è il risultato che deve ottenere nella prima sessione?

### Answer

Risolto il 31 luglio 2026: l'MVP è ottimizzato allo stesso livello per freelance creativi e piccoli studi. I due profili avranno percorsi iniziali distinti, senza diventare due prodotti separati. Il primo risultato utile comune è creare un progetto, caricare almeno un file e ottenere un link cliente pronto da inviare.

## #2: Confine di workspace, team e identità

Blocked by: #1
Type: Discuss

### Question

Un utente può appartenere a più workspace? Un tenant coincide con un workspace, un'organizzazione o un singolo portfolio?

### Answer

Risolto il 31 luglio 2026: un tenant coincide con un workspace. Ogni utente può appartenere a più workspace. Il freelance parte con un workspace personale; lo studio usa un workspace condiviso. Team, clienti, progetti, portfolio, storage, billing, tema e dominio appartengono sempre al workspace e non direttamente all'utente.

## #3: Perimetro reale dell'MVP

Blocked by: #1, #2
Type: Discuss

### Question

Quale percorso verticale deve essere completo al lancio e quali funzioni del documento sono post-MVP?

### Answer

Risolto il 31 luglio 2026: il primo rilascio è un MVP verticale completo. Include accesso e creazione workspace; onboarding freelance/studio; membri, inviti e ruoli essenziali; clienti, progetti, cartelle e file; upload, download, preview base e quote; link cliente protetti e revocabili; commento e approvazione; portfolio Basic; piano Free, un piano a pagamento e Stripe Portal; notifiche essenziali, audit e amministrazione operativa minima. Sono post-MVP temi avanzati e marketplace, CMS completo e blog, analytics evoluti, custom domain, OAuth aggiuntivi, preview PSD/RAW/Office, revisioni sofisticate, webhook utente, Enterprise e osservabilità estesa. Ogni parte inclusa deve essere funzionante end-to-end: niente mock permanenti, placeholder funzionali, controlli inattivi, schermate orfane o percorsi senza esito.

## #4: Modello di clienti e accesso esterno

Blocked by: #1, #2
Type: Discuss

### Question

Il cliente è un contatto, un utente autenticato, un ospite tramite link o può assumere più di una forma?

### Answer

Risolto il 31 luglio 2026: ogni workspace mantiene un proprio record cliente e può emettere un link personale, anche protetto, che raccoglie tutti i lavori consegnati da quel workspace al cliente. La stessa persona può ricevere link diversi da professionisti o studi diversi e, dopo autenticazione e prova di possesso dei link, unificarli sotto una sola identità cliente globale. Senza sessione autenticata, ciascun link mostra soltanto i progetti del workspace emittente; con sessione autenticata e merge completato, lo stesso link apre la vista aggregata del cliente. Ogni workspace fornitore resta isolato e non può sapere né vedere relazioni o lavori degli altri fornitori. Il cliente è esterno al workspace e non diventa membro del team.

## #5: Navigazione e struttura della UI

Blocked by: #1, #2, #3, #4
Type: Prototype

### Question

Qual è il modello mentale principale della UI e quali destinazioni devono essere sempre raggiungibili?

### Answer

Risolto il 31 luglio 2026. UI app-like pulita, moderna e semplice; sidebar richiudibile; dark mode reale con modalità chiara; impostazione visiva Bootstrap-like; gradienti blu controllati; shell persistente e azioni contestuali; nessuna destinazione o azione orfana. La navigazione primaria comprende Panoramica, Progetti, Clienti, Consegne e Portfolio; Team e Impostazioni restano nella sezione di gestione. File e cartelle vivono dentro i progetti. Il prototipo `prototype-ui/index.html` è stato approvato come direzione visiva, non come codice di produzione.

## #6: Onboarding e creazione del primo valore

Blocked by: #1, #2, #3, #5
Type: Prototype

### Question

Quali passi sono obbligatori dal primo accesso al primo progetto condiviso o portfolio pubblicato?

### Answer

Risolto il 31 luglio 2026: l'onboarding è un tour guidato simulato e non un wizard operativo. Usa dati dimostrativi effimeri, non crea o modifica clienti, progetti, file, link o altre risorse persistenti ed è sempre ignorabile. Lo skip non limita alcuna funzione; il primo progetto reale viene creato dalla normale UI. Il tour viene proposto automaticamente una sola volta per utente, non si ripete quando l'utente entra o crea altri workspace ed è sempre riavviabile da Aiuto → Tour guidato.

## #7: Autenticazione e recupero account

Blocked by: #2, #4, #6
Type: Discuss

### Question

Quali metodi entrano davvero nell'MVP e come funzionano verifica email, recupero, sessioni, inviti e 2FA?

### Answer

Risolto il 31 luglio 2026. Membri: email/password, Google e magic link. Clienti: magic link come accesso principale, con possibilità di aggiungere una password all'identità globale. GitHub è post-MVP. La verifica email è obbligatoria prima di inviti, consegne e merge. Il piano Pro include 2FA TOTP e codici di recupero. Le sessioni usano cookie sicuri e refresh token ruotati, sono elencabili e revocabili. Sono inclusi reset password, cambio email verificato e recupero 2FA. Un invito può essere applicato soltanto all'account che controlla l'indirizzo invitato.

## #8: Ruoli, permessi e proprietà delle risorse

Blocked by: #2, #4
Type: Discuss

### Question

Qual è la matrice operativa RBAC + ACL, incluse eredità, override, trasferimento proprietà e ultimo owner?

### Answer

Risolto il 31 luglio 2026. Ruolo come ceiling, ACL su workspace/progetto/cartella/File come scope, inheritance discendente, deny specifico prevalente e default deny. Owner unico: billing, audit, ownership, cancellazione, purge e gestione Admin. Admin gestisce operativita, ACL e ruoli inferiori, ma non Admin/Owner, billing, audit o purge. Editor modifica contenuti, delivery/portfolio draft nello scope; publish delivery solo con capability e Portfolio solo Owner/Admin. Uploader crea/carica e modifica propri elementi non pubblicati; Viewer legge/scarica; Guest esterno scoped con commento e download opzionale.

Trasferimento Owner a membro verificato in transazione serializzata con riautenticazione; precedente Owner diventa Admin. Nessuna successione automatica o self-elevation. Le API applicano policy, invalidano cache al cambio e testano IDOR/race. Matrice completa in [RBAC_MATRIX.md](./RBAC_MATRIX.md).

## #9: Modello di progetto, cartella e file

Blocked by: #3, #4, #8
Type: Discuss

### Question

Quali stati e regole governano progetti, cartelle, file, versioni, cestino e cancellazione definitiva?

### Answer

Risolto il 31 luglio 2026. Un Progetto è Attivo o Archiviato; revisione e consegna non sono stati del progetto. Le cartelle formano una gerarchia interna. Un File ha identita stabile e versioni immutabili; una nuova revisione crea una versione e un oggetto fisico nuovi. Rename/Move sono metadata; Copy crea un File logico che puo riferire lo stesso oggetto e conta quota piena. Commenti e approvazioni riferiscono sempre una versione. Progetti, cartelle e File eliminati restano nel cestino per 30 giorni con struttura/versioni/permessi ripristinabili; purge asincrona auditata rimuove record, derivati e oggetti quando non restano riferimenti o legal hold.

## #10: Upload, elaborazione e fallimenti

Blocked by: #8, #9
Type: Discuss

### Question

Come si comportano upload grandi o interrotti, duplicati, callback mancanti, scansione virus, retry e file non supportati?

### Answer

Risolto il 31 luglio 2026: autorizzazione, piano e quota sono verificati da NestJS; il browser carica direttamente sul gateway PHP con token e il database viene registrato dopo callback. Non è previsto virus scan. L'upload espone soltanto due esiti terminali, Completato o Fallito; avanzamento e pausa sono condizioni temporanee e preview/thumbnail sono processi separati. Il protocollo ufficiale è tus: il gateway persiste sessione e offset, il client riprende automaticamente dopo refresh quando il browser conserva il riferimento al file e altrimenti chiede di riselezionare lo stesso file, senza perdere i byte ricevuti. Ogni file incompleto scade indipendentemente 12 ore dopo l'ultimo chunk; l'attività rinnova il termine, la UI mostra la scadenza e alla scadenza il gateway elimina il parziale mentre NestJS libera la quota riservata. Prima dell'implementazione va verificato che Aruba accetti HEAD, PATCH e gli header tus.

## #11: Download, streaming e token firmati

Blocked by: #8, #9
Type: Discuss

### Question

Quali durata, scope, anti-replay, revoca e comportamento HTTP Range devono avere i token temporanei?

### Answer

Risolto il 31 luglio 2026: il browser non riceve URL diretti agli oggetti storage e NestJS decide ogni autorizzazione. Un token di download è valido 2 minuti per iniziare una richiesta; una risposta già iniziata può terminare dopo la scadenza. Per i video, NestJS emette un token di avvio valido 5 minuti; al play viene scambiato con un token di playback firmato, limitato alla stessa versione video e alle operazioni HEAD/GET/Range, riusato dal player per buffer e seek. La sessione dura quanto il video più 30 minuti, fino a un massimo assoluto di 4 ore. Il token vive nella pagina; al refresh Angular richiede una nuova autorizzazione. La revoca impedisce nuove emissioni, mentre una sessione già aperta resta valida fino alla sua scadenza. Il gateway resta stateless.

## #12: Condivisioni e portale di consegna

Blocked by: #4, #8, #9, #11
Type: Prototype

### Question

Qual è il ciclo di vita di una share e come convivono password, scadenza, view-only, limiti, revoca, commenti e approvazioni?

### Answer

Risolto il 31 luglio 2026: un link di collaborazione e un link di consegna sono risorse di dominio differenti. Il link di collaborazione è un invito personale autenticato con workspace, scope, ruolo e scadenza. Il link personale cliente è stabile e aggrega le consegne attive del workspace, o di più workspace dopo merge autenticato. Un link di consegna punta a una fotografia immutabile, in stato Bozza, Attiva, Scaduta o Revocata, composta da file singoli, cartelle o entrambi. Le cartelle preservano la gerarchia fotografata; il cliente può scaricare file singoli o l'intera cartella come ZIP. Nuovi file o revisioni producono una nuova consegna. Password, scadenza, capacità cliente e limite download sono policy modificabili. Ogni file scaricato con successo conta uno, uno ZIP conta uno; preview, streaming, retry e Range della stessa sessione non consumano unità ulteriori. Un download interrotto non conta; gli avvii concorrenti riservano slot atomicamente; Owner e Admin possono aumentare o azzerare il contatore con audit. La revoca blocca nuove richieste salvo sessioni playback già emesse; una consegna scaduta o revocata si rinnova duplicandola. Il one-shot viene consumato atomicamente con Apri consegna, crea una sessione pagina fino a 4 ore che non sopravvive al refresh, non entra in merge, area cliente o storico consultabile e resta nell'audit privato del mittente.

## #13: Portfolio pubblico e pubblicazione

Blocked by: #1, #3, #5, #9
Type: Prototype

### Question

Come vengono selezionati e ordinati i contenuti, gestite bozze/pubblicazioni, SEO, dominio, contatti e analytics?

### Answer

Risolto il 31 luglio 2026 per l'MVP. Ogni workspace ha un Portfolio pubblico su `slug.portfoliohub.com`, in stato Bozza o Pubblicato. La pubblicazione è atomica e fotografa soltanto versioni File esplicitamente selezionate, senza duplicare storage o rendere pubblico altro contenuto. Sezioni Basic: Hero, Progetti/Gallery, Profilo e Contatti. Inclusi titolo/descrizione SEO, social image, sitemap, contatto antispam con email/in-app e statistiche essenziali di visualizzazione/apertura. Blog, temi avanzati, analytics dettagliati e dominio custom sono post-MVP.

## #14: Temi e personalizzazione

Blocked by: #13
Type: Prototype

### Question

Quali proprietà sono configurabili per ciascun livello di tema e cosa significa esattamente Custom?

### Answer

Risolto il 31 luglio 2026 per l'MVP. Il tema Basic consente logo, favicon, nome, descrizione, modalità chiara/scura/automatica, colore principale con controllo contrasto, tre coppie tipografiche curate, ordine e visibilità delle sezioni, copertina progetto, rapporto immagini, densità gallery, testi, CTA e social. Offre anteprima desktop/mobile, autosalvataggio bozza e pubblicazione esplicita. Non accetta CSS, script, blocchi arbitrari o page builder. Pro, Premium e Custom estenderanno gli stessi token e componenti post-MVP senza cambiare modello.

## #15: Trial, piano Free e catalogo commerciale

Blocked by: #1, #3
Type: Discuss

### Question

Il limite di 30 giorni appartiene al Free o a un trial? Quali entitlement e limiti definiscono ogni piano?

### Answer

Risolto il 31 luglio 2026. Free è permanente; Trial offre 30 giorni Pro senza carta una sola volta sul primo workspace. Free: 50 GB storage, un progetto, 50 GB mensili traffico, un workspace di proprietà, massimo 3 membri, clienti/consegne illimitati entro quote, Portfolio Basic con branding; password, scadenza, view-only, download e revoca. Pro: €24,90/mese o €249/anno, 1 TB storage, 3 TB traffico mensile, progetti/clienti/consegne illimitati, massimo 10 membri, Portfolio Basic senza branding; aggiunge one-shot, limite download, commenti, approvazioni e 2FA. Unlimited: €159,90/mese o €1.599/anno, nessun limite numerico prefissato per storage, traffico, progetti, clienti, consegne e membri, con fair-use. Prezzi UI finali senza diciture IVA; fiscalità configurabile. Collaborare in workspace altrui non pesa sul proprio piano. Limite tecnico singolo file: 50 GB nel Free, sempre entro quota residua; 100 GB in Pro e Unlimited. Fair-use: sospensione immediata per cause definite, motivazione salvo impedimenti, niente rimborso se violazione utente, rimborso proporzionale se colpa PortfolioHub, ricorso che sospende il countdown e cancellazione dopo 7 giorni di sospensione confermata salvo legal hold. Starter, Agency ed Enterprise sono post-MVP.

## #16: Ciclo billing e gestione quota

Blocked by: #9, #15
Type: Discuss

### Question

Cosa succede a upgrade, downgrade, insoluto, cancellazione, superamento quota e dati oltre limite?

### Answer

Risolto il 31 luglio 2026. Provider Stripe. Upgrade immediato con prorata e quote disponibili solo dopo webhook riuscito. Downgrade a fine periodo senza rimborso; cancellazione mantiene il piano fino a scadenza e poi passa a Free. Mensile/annuale cambia a scadenza salvo upgrade. Coupon nel Checkout; Customer Portal per pagamento, fatture, rinnovo, cancellazione e piano. Backend unica fonte di verità via webhook firmati/idempotenti; redirect non prova il pagamento. Utilizzo aggregato in byte interi, GB decimali arrotondati per eccesso sul totale. Se al passaggio a Free i dati superano il piano, workspace, portfolio e link vengono bloccati; niente consultazione, export o download. Uniche azioni: pagare il piano precedente o `Svuota e passa a Free`. Lo svuotamento, protetto da riautenticazione e digitazione nome workspace, revoca link ed elimina irreversibilmente senza cestino progetti, file/versioni/cartelle, clienti, consegne, portfolio, inviti e collaboratori; conserva Owner, shell workspace, fatture, consensi, audit e legal hold, quindi riattiva Free vuoto. Un pagamento fallito avvia 7 giorni di tolleranza con servizio attivo e avvisi ai giorni 0, 3 e 6; un webhook riuscito ripristina lo stato. Al giorno 7 passa a Free: operativo se conforme, bloccato con paga/svuota se oltre quota.

## #17: Notifiche e preferenze

Blocked by: #4, #8, #9, #12
Type: Discuss

### Question

Quali eventi notificano chi, su quale canale, con quali preferenze, digest e garanzie anti-duplicato?

### Answer

Risolto il 31 luglio 2026 per l'MVP. Canali: email e in-app; push e webhook configurabili dagli utenti sono post-MVP, mentre i webhook infrastrutturali restano backend. Il centro notifiche supporta lette/non lette, segna tutte e deep link. Notifica inviti, upload falliti, commenti, approvazioni, consegne aperte/scaricate, quote, billing, sicurezza, sospensione e contatti portfolio. Non notifica l'attore della propria azione; raggruppa eventi ripetitivi. Owner/Admin ricevono billing/quote/sicurezza; partecipanti progetto solo il proprio scope; autore consegna riceve interazioni cliente. Retention 90 giorni; audit separato. Le regole email complete sono nel ticket #29.

## #18: Eventi, code e consistenza

Blocked by: #9, #10, #11, #12, #16, #17
Type: Discuss

### Question

Quali operazioni sono sincrone o asincrone e quali contratti servono per idempotenza, retry, dead-letter e ordering?

### Answer

Risolto il 31 luglio 2026. RabbitMQ trasporta eventi di dominio durevoli tra moduli/servizi; BullMQ esegue job, retry e scheduling nei worker. Transactional Outbox PostgreSQL salva evento e mutazione insieme e pubblica verso RabbitMQ. Consegna at-least-once con consumer idempotenti e inbox/deduplica. Envelope versionato con eventId, workspace, aggregate, timestamp, actor, correlation e causation. Nessun ordine globale, solo sequenza per aggregate. Retry/backoff, DLQ e replay manuale auditabile. Payload minimi per ID, senza segreti, token, URL temporanei o corpi file. BullMQ non è fonte di verità: lo è PostgreSQL.

## #19: Storage provider e semantica degli oggetti

Blocked by: #9, #10, #11, #18
Type: Discuss

### Question

Qual è il contratto completo di `StorageProvider`, inclusi checksum, multipart, move/copy, metadata, range, cancellazione e capability opzionali?

### Answer

Risolto il 31 luglio 2026. ArubaPhpProvider è produzione MVP; Local è sviluppo/test; S3, R2 e Minio sono adapter futuri. Gli oggetti fisici sono immutabili e identificati da chiavi opache. Rename e Move modificano solo metadata PostgreSQL; Copy crea un nuovo File logico sullo stesso oggetto e conta comunque per intero nella quota commerciale. Una nuova versione crea un nuovo oggetto. La cancellazione fisica avviene solo quando non restano riferimenti, consegne, portfolio pubblicati, cestino o legal hold. Nessun caller conosce path, URL Aruba o tus. L'interfaccia non espone move/rename/copy.

Il contratto minimo comprende `beginWrite`, `inspectWrite`, `commitWrite`, `grantRead`, `inspectObject` e `deleteObjects`. Ogni adapter deve supportare upload resumable, letture Range, stat e cancellazione idempotente. Dimensione e checksum vengono verificati al commit; errori e capability sono normalizzati. Multipart, CDN e lifecycle nativi restano dettagli opzionali dell'adapter. Il contratto completo, incluse invarianti, input/output, errori e flussi asincroni, è in [STORAGE_PROVIDER_CONTRACT.md](./STORAGE_PROVIDER_CONTRACT.md).

## #20: Preview e formati supportati

Blocked by: #3, #9, #10, #18, #19
Type: Research

### Question

Quale livello di supporto reale garantisce l'MVP per immagini, video, audio, PDF, Office, ZIP, PSD e RAW?

### Answer

Risolto il 31 luglio 2026 per l'MVP. Le elaborazioni avvengono sulla VPS in worker separati dall'API; Aruba conserva e serve originali e derivati ma non esegue conversioni pesanti. RabbitMQ riceve l'evento di versione completata e il coordinatore crea job idempotenti in quattro code BullMQ: immagini/thumbnail, documenti, media e ispezione ZIP. I worker leggono e scrivono soltanto mediante grant temporanei e `StorageProvider`.

La pipeline produce thumbnail/preview per immagini, PSD e RAW supportati; PDF e Office in rappresentazione web; poster e proxy web per video/audio; elenco ZIP sicuro senza estrazione persistente. Una variante o codec non elaborabile resta `Non supportata`. Upload e preview hanno esiti indipendenti.

I worker hanno concorrenza separata, backpressure, priorità inferiore, limiti rigidi di CPU/RAM/I/O/spazio temporaneo/tempo/input, retry finiti, DLQ, cleanup e metriche. Superate le soglie si fermano le nuove elaborazioni, non API, upload o download. Il profilo conservativo limita l'intero pool al 30% CPU e 25% RAM della VPS, con una conversione pesante e due leggere; sopra il 75% di CPU o RAM complessive non partono nuovi job. La ripresa usa isteresi. I limiti sono applicati tramite container/cgroup o unità di servizio; i job dubbi sono classificati pesanti.

Immagini/RAW, documenti, media e archivi usano quattro immagini container distinte, mai un'immagine universale. Ogni conversione gira non-root, senza rete, con root filesystem read-only, input read-only, temp isolato, cgroup, timeout, process-group cleanup e senza secret o socket Docker. I convertitori non accedono direttamente ai servizi applicativi.

Toolchain approvato: libvips, ImageMagick e LibRaw per immagini/PSD/RAW; LibreOffice headless e Poppler per Office/PDF; FFmpeg e ffprobe per video/audio; libarchive per l'indice ZIP. Versioni bloccate, capability manifest, corpus di contract test e rollout/rollback indipendente per immagine. Nessun servizio esterno di conversione. Le anteprime Office/PSD/RAW non promettono resa pixel-perfect e l'originale resta sempre disponibile. Il ticket formati e architettura preview è risolto; la quota dei derivati resta nel ticket #20A.

## #20A: Quota dei derivati tecnici

Blocked by: #18, #20
Type: Discuss

### Question

Thumbnail e preview generate dalla piattaforma consumano la quota storage commerciale del workspace oppure sono costo tecnico interno? Il traffico prodotto quando vengono visualizzate resta comunque conteggiato in byte serviti.

### Answer

Risolto il 31 luglio 2026. Thumbnail, poster, proxy video/audio, PDF di anteprima e altri derivati generati dalla piattaforma non consumano la quota storage commerciale del workspace. La quota storage conteggia i File logici originali secondo le regole già definite, anche quando più File riferiscono lo stesso oggetto fisico. I byte dei derivati restano costo tecnico interno e vengono misurati separatamente per capacity planning. Quando originali o derivati vengono serviti al browser, i byte effettivamente trasferiti consumano la quota traffico del workspace. Rigenerazioni e copie tecniche non producono traffico commerciale finché non vengono servite a un utente o cliente.

## #21: Audit, cronologia e conservazione dati

Blocked by: #8, #9, #12, #16
Type: Discuss

### Question

Quali azioni sono auditabili, chi può leggerle, per quanto tempo e quali regole valgono per export, cancellazione e ripristino?

### Answer

Risolto il 31 luglio 2026. L'Audit workspace immutabile e il suo export sono accessibili soltanto all'Owner; gli altri ruoli vedono una Cronologia attività separata e filtrata per ACL. Il cliente non accede all'audit. Le API sono distinte. Cronologia e audit hanno retention mobile rispettivamente di 12 e 24 mesi; registri fiscali, consensi, sicurezza, prova di cancellazione e legal hold hanno retention dedicate e minimizzate. L'export non prolunga la retention.

L'audit registra modifiche di dominio e accessi sensibili relativi a sicurezza, ownership, membri/ACL, contenuti/versioni, upload, consegne e interazioni cliente, portfolio, billing/quota, sospensione/cancellazione/purge, amministrazione, export e richieste legali. Navigazione ordinaria, thumbnail, polling, heartbeat, retry e Range tecniche restano in log e metriche.

La cancellazione dell'unico Owner senza trasferimento avvia 30 giorni di quarantena immediata: sessioni revocate, membri bloccati, accessi pubblici e job non essenziali disabilitati, dati congelati. Solo l'Owner può annullare tramite email verificata e riautenticazione. Al giorno 30 parte la purge irreversibile. Owner avvisato subito e ai giorni 7, 23 e 29; membri avvisati all'inizio e all'esito; nessuna comunicazione ai clienti. Il rinnovo Stripe viene cancellato a fine periodo e non riparte automaticamente dopo il recupero.

Backup cifrati mobili massimo 30 giorni; tombstone riapplicati durante ogni restore impediscono la ricomparsa dei dati purgati. Entro 30 giorni dalla purge i residui non accessibili escono dai backup. Un certificato pseudonimizzato di cancellazione, privo di contenuti, documenta tempi, categorie, eccezioni e correlation ID, viene inviato all'ex Owner e conservato 24 mesi.

## #22: Sicurezza, privacy e abuso

Blocked by: #4, #7, #8, #10, #11, #21
Type: Research

### Question

Quali requisiti misurabili servono per rate limit, malware, CSRF/CORS, secret rotation, privacy/GDPR, data residency e abuse handling?

### Answer

Risolto il 31 luglio 2026 per il design MVP. Core data e backup in UE, preferibilmente Italia; subprocessori e trasferimenti sono documentati nel DPA. Poiché Aruba non documenta esplicitamente la cifratura a riposo dello spazio web, originali e derivati usano envelope encryption applicativa con DEK per oggetto, AEAD chunked compatibile con resume/Range e KEK in vault/KMS UE dietro `KeyProvider`. Gateway stateless e Key Broker scambiano chiavi effimere soltanto per grant validi. Review crittografica indipendente e benchmark sono gate di lancio.

Password Argon2id, cookie `__Host-` Secure/HttpOnly/SameSite, refresh rotation, CSRF token piu Origin/Fetch Metadata, CORS allowlist, CSP e origin pubblico isolato. Rate limit Redis misurabili per auth, magic link, password consegna, API, share, download e upload. File identificati dai byte e trattati come non fidati; sandbox protegge da traversal, archive bomb, macro/script e parser. Nessun antivirus e nessuna dichiarazione di file sicuro.

Secret separati per ambiente/servizio, vault, rotazione e recovery. Rights workflow verificato entro un mese salvo estensioni ammesse. Segnalazioni abuso tracciate; sospensione solo per cause definite e ricorso separato. Richieste autorita e legal hold richiedono verifica, minimizzazione e doppia approvazione; notifica interessato salvo divieto. Incident response include valutazione breach, eventuale notifica entro 72 ore, postmortem e gate di sicurezza. Contratto dettagliato in [SECURITY_ARCHITECTURE.md](./SECURITY_ARCHITECTURE.md).

## #23: Admin globale e support operations

Blocked by: #2, #8, #16, #18, #21, #22
Type: Prototype

### Question

Quali azioni può eseguire l'amministratore di piattaforma, con quali vincoli, approvazioni, impersonation e audit?

### Answer

Risolto il 31 luglio 2026. Admin globale su applicazione/origin separato con ruoli Support, Billing Operations, Trust & Safety, Security Operations, Platform Operations e Platform Owner; account personali, 2FA e sessioni brevi. Vista ordinaria limitata a metadata diagnostici e ricerca esatta, con PII mascherata e nessun contenuto, password, token, chiave o pagamento completo.

Nessuna impersonazione invisibile. L'Owner può concedere una Support Session read-only, limitata e revocabile di 30 minuti, senza download, mutazioni, billing, sicurezza, team o audit. Break-glass di 15 minuti soltanto per sicurezza, urgenza o richiesta legale, con case, doppia approvazione, scope nominato, review entro 24 ore e notifica quando consentita. Le mutazioni sono comandi amministrativi espliciti; purge, legal hold/disclosure, sospensione definitiva, refund fuori policy, restore e chiavi master richiedono doppia approvazione. Audit staff append-only separato per 24 mesi. Contratto in [ADMIN_OPERATIONS.md](./ADMIN_OPERATIONS.md).

## #24: CMS e confine con l'applicazione

Blocked by: #3, #13
Type: Discuss

### Question

Quali contenuti vivono in Sanity e quali nel database applicativo? Blog e pagine del portfolio appartengono allo stesso dominio?

### Answer

Risolto il 31 luglio 2026. Sanity, dietro `ContentProvider`, contiene soltanto marketing, FAQ, documentazione, release notes e bozze legali PortfolioHub. Blog, marketplace e CMS avanzato sono post-MVP. Workspace, utenti, clienti, progetti, file, consegne, Portfolio, billing, audit e consensi restano in PostgreSQL. Prezzi ed entitlement vengono sempre dal catalogo backend.

Le policy passano da un `Policy Publisher` che crea snapshot immutabili, versionati e hashati in PostgreSQL; Sanity non modifica versioni gia pubblicate. Il Portfolio Basic è uno snapshot applicativo e non una pagina CMS. Domini separati: marketing root/www, app, api, admin, delivery e `{slug}.portfoliohub.com`, con slug tecnici riservati e cookie host-only. Cache locale e webhook firmati rendono Sanity non critico per i flussi applicativi. Contratto in [CONTENT_BOUNDARIES.md](./CONTENT_BOUNDARIES.md).

## #25: Ambienti, deployment e responsabilità operative

Blocked by: #18, #19, #22
Type: Research

### Question

Come sono separati sviluppo, staging e produzione e come avvengono deploy, migrazioni, backup, restore e disaster recovery tra VPS e Aruba?

### Answer

Risolto il 31 luglio 2026. Local, CI, staging e produzione sono isolati; staging usa una VPS distinta e non condivide dati, secret, DB, queue, storage o account esterni con produzione. Artefatti container immutabili per digest, SBOM/provenance e promozione senza rebuild. Deploy con migrazioni expand/contract, API N/N-1, rollout/drain worker e rollback del codice senza rollback distruttivo DB. Gateway Aruba in release versionate con switch atomico e sessioni tus esterne alla release.

AWS KMS e S3 in `eu-south-1` (Milano) sono rispettivamente `KeyProvider` e `BackupProvider` MVP. Database: full giornaliero, WAL 15 minuti, retention 30 giorni. Oggetti cifrati replicati entro 1 ora; copia corrente finche attiva, storico eliminato entro 30 giorni e tombstone riapplicati. Failover S3 read-only a doppia approvazione. Obiettivi: RPO DB 15 minuti, oggetti 1 ora; RTO app/lettura 4 ore e scrittura completa 24 ore. Restore, failover, perdita queue e rollback sono gate di lancio. Contratto in [DEPLOYMENT_AND_RECOVERY.md](./DEPLOYMENT_AND_RECOVERY.md).

## #26: SLO, accessibilità e compatibilità

Blocked by: #3, #5, #10, #11, #20, #25
Type: Discuss

### Question

Quali obiettivi misurabili valgono per prestazioni, disponibilità, upload, responsive, browser e WCAG?

### Answer

Risolto il 31 luglio 2026. SLO mensile: 99,5% app/API, delivery, download/stream e portfolio; 99,0% upload e Admin. API read p95 300 ms, mutation 700 ms; Core Web Vitals p75 LCP 2,5 s, INP 200 ms, CLS 0,1. Commit upload visibile entro 5 s, first byte download 2 s, playback start 3 s. Preview: immagini 2 min, documenti 5 min, poster 5 min, proxy media entro max 15 min/50% durata. Error budget governa i release e le dipendenze esterne restano visibili nelle metriche.

Target WCAG 2.2 AA su marketing, app, cliente, delivery, portfolio e Admin; keyboard, focus, contrasto, reflow, reduced motion, form error, player e alternative drag/drop verificati. Controlli touch principali 44 CSS px. Viewport 320-2560; ultime due major Chrome/Edge/Firefox/Safari e mobile moderni, no IE. Gate con load/fault test, browser matrix, axe e screen reader manuale. Contratto in [QUALITY_SLOS.md](./QUALITY_SLOS.md).

## #27: Strategia di test e criteri di accettazione

Blocked by: #3, #5, #6, #7, #8, #9, #10, #11, #12, #13, #15, #16, #17, #18, #19, #20, #21, #22, #23, #24, #25, #26, #29, #30
Type: Discuss

### Question

Quali scenari end-to-end, contract test, failure test e gate provano che l'MVP è pronto?

### Answer

Risolto il 31 luglio 2026. Strategia a livelli: domain/property test, contract test comuni per ogni adapter, integration su PostgreSQL/Redis/RabbitMQ reali, component/UI, quindici scenari end-to-end verticali, provider reali in staging, fault injection, security/privacy, accessibilita/browser, performance/capacity e migrazioni N/N-1. Stato PostgreSQL e risultato osservabile prevalgono su response/coda; duplicati, timeout, crash e ordine invertito sono casi obbligatori.

PR gate con lint/typecheck/unit/contract/integration/migration/security scan e component test. Release gate con E2E, Aruba/KMS/S3/Stripe/Resend/Sanity reali, fault/security/WCAG/browser/load, restore/failover, zero Critical/High e approvazioni Standards/Spec/Security/Operations. Ogni requisito mappa a test/evidenza/owner e stato Pass/Fail/Blocked. Contratto in [TEST_STRATEGY.md](./TEST_STRATEGY.md).

## #28: Piano di rilascio in vertical slice

Blocked by: #27
Type: Discuss

### Question

In quale sequenza di incrementi dimostrabili costruiamo e rilasciamo il prodotto?

### Answer

Risolto il 31 luglio 2026. Dodici slice dopo la fondazione: identita/workspace; primo progetto-file-link reale; team/ACL; file/versioni/trash; preview/media; consegna professionale; identita cliente/merge/one-shot; Portfolio; piani/Stripe; email/notifiche/audit; lifecycle/privacy/Admin; marketing/policy/readiness. Ogni slice attraversa UI/API/persistenza/permessi/audit/test e resta nascosta finche incompleta.

Il lancio pubblico segue una beta privata di almeno 14 giorni con error budget sano e nessun Critical/High. Exit finale richiede tutti i gate test, security, SLO, recovery e legal review. Piano dettagliato con demo ed exit per slice in [RELEASE_PLAN.md](./RELEASE_PLAN.md).

## #29: Email transazionali e comunicazioni massive

Blocked by: #7, #15, #17, #18, #22, #24
Type: Discuss

### Question

Chi può inviare quali categorie di email, a quali destinatari, con quale base giuridica, consenso, preferenze, template, dominio mittente, quota, rate limit, suppression, retry e audit?

### Answer

Risolto il 31 luglio 2026. PortfolioHub invia email operative per autenticazione/sicurezza, consegne, inviti/collaborazioni, attività, billing, quota, sospensione/cancellazione, incidenti e policy. I workspace non inviano campagne; le massive sono soltanto PortfolioHub → utenti. Provider MVP Resend Pro dietro `EmailProvider`. Mittenti separati auth/mail/updates e Reply-To workspace verificato. Categorie obbligatorie e configurabili sono separate; marketing opt-in, initially off, con one-click unsubscribe. Preferenze cliente isolate per workspace. Hard bounce e complaint producono suppression. Stati: In coda, Accettata, Consegnata, Rimbalzata, Segnalata, Soppressa, Fallita. Retry temporanei a 30s, 2m, 10m, 30m e 2h, entro la validità del token; idempotenza, dead-letter, alert e reinvio manuale. Webhook firmati e idempotenti. Nessun corpo completo persistente: template/versione e parametri minimi; metadata 12 mesi; token hash eliminati 24 ore dopo scadenza; consensi e policy per durata account più periodo legale; suppression fino a rimozione/riverifica; billing, sicurezza e autorità seguono retention legali; Cleanup Worker elimina o anonimizza.

Rate limit anti-abuso mobile 24 ore: 100 destinatari unici Free, 1.000 Pro, 5.000 Unlimited; massimo 10 messaggi per destinatario/workspace, reinvio dopo 5 minuti e 30 richieste/minuto/utente. Non sono quote marketing: la consegna resta creata e la UI offre Copia link. Massive PortfolioHub su pipeline separata con segmento/base documentati, doppia approvazione oltre 1.000 destinatari, canary 1%/5%, batch, soglie reputazionali e kill switch. Dettagli in [EMAIL_OPERATIONS.md](./EMAIL_OPERATIONS.md).

## #30: Pagine legali e governance delle policy

Blocked by: #15, #21, #22, #29
Type: Research

### Question

Quali documenti devono essere pubblicati, versionati e accettati, come vengono notificati gli aggiornamenti e quali prove di consenso o presa visione devono essere conservate?

### Answer

Risolto il 31 luglio 2026 a livello di governance, con redazione professionale obbligatoria prima del lancio. Documenti minimi: Termini/abbonamento, Privacy, Cookie, AUP/Fair Use, cancellazione/rimborsi, DPA, subprocessori, abuse/ricorso, autorita, security disclosure, informazioni societarie e accessibilita. Policy Publisher crea snapshot immutabili hashati, archivio versioni e prove distinte di accettazione, presa visione, marketing e cookie.

Modifiche materiali con 30 giorni di preavviso e reminder -30/-7/-1; urgenze legali/sicurezza motivate. Mancata accettazione porta a Policy Restricted con accesso ad accettazione, export, billing/cancellazione e supporto, senza cancellazione automatica; per Owner sospende link/portfolio. Cookie non necessari off, rifiuto pari evidenza, categorie granulari e revoca. AUP usa cause concrete, statement of reasons e ricorso; richieste autorita verificate/minimizzate con doppia approvazione. DPIA/ROPA, subprocessori, breach, DSA/P2B applicability e testi fiscali/contrattuali sono gate legali. Contratto in [POLICY_GOVERNANCE.md](./POLICY_GOVERNANCE.md).
