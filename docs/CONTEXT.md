# PortfolioHub — Linguaggio di dominio

Solo termini già esplicitamente stabiliti nel PRD. Le ambiguità vengono risolte una alla volta nella decision map.

## Workspace

Nome di prodotto del tenant. È il confine isolato che possiede team, clienti, progetti, portfolio, storage, billing, tema e dominio. Un utente può appartenere a più workspace. Un workspace può iniziare come personale ed evolvere in condiviso senza cambiare identità.

## Tenant

Termine architetturale equivalente a workspace. Si usa nelle componenti tecniche quando è necessario descrivere isolamento e tenancy; nella UI si usa workspace.

## Membro

Utente che appartiene a un workspace con un ruolo. L'identità dell'utente è globale, mentre ruolo e accessi sono specifici del workspace.

## Owner

Unico proprietario di un workspace. Può trasferire esplicitamente la proprietà a un membro verificato, diventando Admin. Non esiste successione automatica. Se elimina il proprio account senza trasferimento, avvia la cancellazione completa del workspace e di tutte le risorse possedute dopo un periodo di 30 giorni.

## Admin

Membro che gestisce operatività, membri, clienti, progetti, file, consegne e portfolio del workspace. Non può trasferire la proprietà, eliminare il workspace, modificare il billing o accedere all'Audit workspace completo. Vede soltanto la Cronologia attività delle risorse autorizzate.

## Audit workspace

Registro immutabile degli eventi sensibili e amministrativi del workspace. È consultabile ed esportabile esclusivamente dall'Owner mediante API dedicate; non è una vista più ampia della Cronologia attività. Conserva gli eventi per 24 mesi mobili.

## Cronologia attività

Vista operativa filtrata per ruolo e ACL. Mostra soltanto eventi utili sulle risorse autorizzate e non include sicurezza, billing, gestione membri, cancellazioni, legal hold o amministrazione riservata. Conserva gli eventi per 12 mesi mobili.

## Retention dedicata

Conservazione separata di un insieme minimo di record per una finalità specifica, come obbligo fiscale, prova di consenso, indagine di sicurezza, prova di cancellazione o legal hold. Non estende automaticamente la retention della Cronologia attività o dell'Audit workspace.

## Quarantena cancellazione

Stato reversibile di 30 giorni avviato quando l'Owner elimina l'account senza trasferire la proprietà. Revoca sessioni, blocca membri e accessi pubblici e congela i dati. Soltanto l'Owner, tramite email verificata e riautenticazione, può annullarlo prima che inizi la purge.

## Tombstone di cancellazione

Record tecnico minimo e non reversibile che identifica dati già purgati. Viene riapplicato durante ogni restore affinché un backup precedente non possa riportare online contenuti cancellati.

## Certificato di cancellazione

Prova pseudonimizzata della purge contenente tempi, categorie eliminate, eccezioni con relativa base, versione della procedura e correlation ID, senza nomi file o contenuti. Viene conservata per 24 mesi e inviata all'ex Owner.

## Evento auditabile

Azione di dominio o accesso sensibile che modifica stato, autorizzazioni, disponibilità, proprietà, billing, sicurezza o prova di una consegna. Navigazione ordinaria e telemetria tecnica non sono eventi auditabili e restano nei log operativi.

## Ticket di supporto

Richiesta persistente aperta da un membro autenticato e associata a un solo workspace. È una conversazione bidirezionale ordinata tra workspace e staff, con messaggi persistenti e aggiornamento realtime via SSE. Apertura e nuovi messaggi dell’utente generano una notifica nel backoffice e un’email transazionale agli operatori Admin e Support attivi; ogni risposta staff genera una notifica nell’app e un’email transazionale all’utente che ha aperto il ticket. Gli invii email sono accodati e idempotenti per evento e destinatario. Contiene oggetto, categoria, priorità e stato operativo; non deve includere password, token o dati di pagamento. Lo staff la gestisce dal Support Desk e risposte o cambi di stato entrano nell’Audit staff.

## Piano manuale

Entitlement Free, Pro o Unlimited assegnato da un Admin a un workspace senza Checkout e senza pagamento. Richiede una motivazione, ha effetto immediato e genera un evento auditabile. Non può sovrascrivere un abbonamento Stripe attivo, che resta governato esclusivamente dai webhook verificati.

## Verifica manuale account

Attivazione eccezionale di un account pending effettuata da un Admin senza consumo del link email. Invalida i token di verifica ancora aperti, richiede una motivazione e viene registrata nell'Audit staff.

## Editor

Membro che crea e modifica contenuti, progetti, file e consegne esclusivamente negli scope assegnati. Non gestisce team, billing o sicurezza.

## Uploader

Membro che aggiunge file e cartelle negli scope assegnati. Non elimina contenuti altrui e non genera consegne.

## Viewer

Membro con sola visualizzazione e download negli scope assegnati.

## Guest

Collaboratore esterno autenticato, limitato a un progetto o una cartella. Non accede alla navigazione globale, ai clienti, al team o alle impostazioni del workspace e non coincide con il Cliente.

## ACL

Regole che restringono a workspace, progetto, cartella o file le capacità massime definite dal ruolo. L'accesso si eredita verso i discendenti e un divieto esplicito prevale su una concessione ereditata.

## Progetto

Contenitore di lavoro appartenente a un workspace e associabile a clienti e collaboratori. Può essere Attivo o Archiviato; revisione, approvazione e consegna appartengono ad altri concetti.

## File

Identità logica stabile interna a un progetto. Mantiene una sequenza di versioni immutabili e punta a una versione corrente per il lavoro interno.

## Versione file

Contenuto immutabile di un File in un momento preciso. Commenti, approvazioni e consegne si riferiscono a questa identità e non genericamente al File.

## Sessione di upload

Operazione tus temporanea autorizzata da NestJS e gestita dal gateway PHP, con dimensione, offset e scadenza persistenti per un singolo file. Può essere ripresa dopo refresh senza creare una seconda versione file; quando il browser perde il riferimento locale richiede la riselezione dello stesso file. Scade 12 ore dopo l'ultimo chunk, liberando file parziale e quota riservata. Produce soltanto un esito terminale Completato o Fallito; preview e thumbnail non ne modificano l'esito.

## Consegna

Fotografia immutabile di versioni file, cartelle o una combinazione dei due che un workspace rende disponibili a un cliente tramite un link di consegna. Una cartella conserva la gerarchia al momento della pubblicazione e consente download dei singoli file o dell'insieme come ZIP.

## Portfolio

Sito pubblico appartenente a un workspace, disponibile nell'MVP su un sottodominio PortfolioHub. Pubblica atomicamente soltanto versioni file selezionate e comprende Hero, Progetti o Gallery, Profilo e Contatti. La bozza e l'ultima pubblicazione sono separate.

## Tema Basic

Configurazione controllata del Portfolio basata su token e componenti accessibili. Personalizza identità, colore, tipografia, sezioni e gallery, ma non permette CSS, script, blocchi arbitrari o page builder.

## Trial Pro

Periodo gratuito di 30 giorni senza carta, disponibile una sola volta sul primo workspace creato da un utente. Alla scadenza passa a Free se non viene acquistato Pro e non cancella automaticamente dati.

## Quota storage

Limite dei byte persistenti dei File logici originali posseduti dal workspace. Nel Free è 50 GB ed è distinta dalla quota traffico. Thumbnail, poster, proxy, PDF di anteprima e altri derivati tecnici sono costo interno della piattaforma e non consumano questa quota.

## Piano Free

Piano permanente con 50 GB storage, 50 GB traffico mensile, un progetto, un workspace posseduto e massimo tre membri. Il singolo file non può superare 50 GB né la quota residua.

## Piano Pro

Piano da €24,90 mensili o €249 annuali con 1 TB storage, 3 TB traffico mensile, progetti/clienti/consegne illimitati, massimo dieci membri e funzioni avanzate di consegna, collaborazione e sicurezza. Limite tecnico 100 GB per file.

## Piano Unlimited

Piano da €159,90 mensili o €1.599 annuali senza limiti numerici prefissati per storage, traffico, progetti, clienti, consegne e membri, soggetto a fair-use trasparente. Limite tecnico 100 GB per file.

## Quota traffico

Limite mensile del traffico generato dai contenuti serviti tramite download e delivery, azzerato nella data di attivazione del workspace. Nel Free è 50 GB. Un download completato addebita la dimensione originale del file; uno ZIP la somma delle dimensioni originali; un download interrotto non conta. Streaming video e preview addebitano i byte realmente serviti e ogni nuova visione conta. Inviare o aprire il link senza caricare contenuti non consuma quota.

## Utilizzo aggregato

Somma in byte interi di storage o traffico del workspace. La UI e il confronto con quote espresse in GB usano GB decimali e arrotondano per eccesso soltanto il totale aggregato, mai il singolo file o evento.

## Storage tecnico derivati

Byte occupati dagli oggetti generati dai worker preview. Non sono mostrati né addebitati come quota storage del workspace, ma vengono misurati separatamente per capacity planning. Quando un derivato viene servito al browser, i byte trasferiti consumano la quota traffico.

## Sospensione fair-use

Blocco immediato dell'account per una causa prevista dalla fair-use policy, come abuso, frode, illegalità, rischio di sicurezza, rivendita o violazione sostanziale. Dopo 7 giorni consecutivi conduce alla cancellazione, salvo dati soggetti a legal hold o obblighi di conservazione.

## Legal hold

Conservazione isolata e ad accesso ristretto dei soli dati necessari a soddisfare un obbligo legale, fiscale, una richiesta valida dell'autorità o la difesa di un diritto. Prevale temporaneamente sulla cancellazione ordinaria e viene rimossa quando cessa la base giuridica.

## Limite download

Contatore configurabile per una singola consegna. Un file completato vale una unità e uno ZIP completo vale una unità; preview, streaming, retry e Range della stessa sessione non contano. Gli avvii concorrenti riservano slot atomicamente e i trasferimenti interrotti li rilasciano.

## Cestino

Area di conservazione temporanea per progetti, cartelle e file eliminati. Per 30 giorni mantiene struttura, versioni e permessi ripristinabili; allo scadere avvia l'eliminazione definitiva asincrona e auditabile.

## Cliente dello workspace

Record privato con cui un workspace rappresenta un destinatario delle proprie consegne. Non rivela al workspace eventuali rapporti dello stesso destinatario con altri professionisti o studi presenti sulla piattaforma.

## Identità cliente

Identità globale autenticata che consente alla stessa persona di unificare più link personali ricevuti e consultare in una vista aggregata i progetti consegnati da workspace diversi. Non rende condivisi tra i fornitori dati, relazioni o lavori.

## Identità utente

Account globale verificato usato dai membri dei workspace. Può autenticarsi con email/password, Google o magic link e mantiene sessioni revocabili. Ruoli e permessi non appartengono all'identità globale ma alle sue membership nei workspace.

## Link personale cliente

Link emesso da un workspace per dare a un cliente accesso ai lavori che quello specifico workspace gli ha consegnato. Può essere protetto e può essere collegato, dopo autenticazione, a un'identità cliente globale.

## Link di consegna

Link esterno con cui un workspace consegna uno o più progetti o file a un cliente. Appartiene al dominio cliente, può essere protetto, può consentire azioni come visualizzazione, download, commento e approvazione, e può essere associato tramite merge a un'identità cliente.

## Link one-shot

Policy speciale di un link di consegna che permette un solo riscatto. Una pagina neutra precede il consumo, che avviene atomicamente solo con l'azione esplicita Apri consegna, così anteprime automatiche e crawler non possono bruciarlo. Il riscatto crea una sessione di pagina valida fino a 4 ore che non sopravvive a refresh o chiusura. Non entra nel link personale, nel merge o nello storico consultabile dal cliente e resta soltanto nell'audit privato del mittente. Il proprietario vede data e stato Utilizzato, ma deve generare un nuovo link per concedere altro accesso.

## Link di collaborazione

Invito personale con cui un workspace concede a un collaboratore un ruolo operativo su uno scope interno: workspace, progetto o cartella. Richiede autenticazione, scade se non accettato, viene consumato all'accettazione e genera un accesso legato all'account, revocabile e auditabile. Non è una consegna, non alimenta l'area cliente e non può essere unito a link di consegna.

## Merge delle consegne

Operazione autenticata con cui il cliente dimostra il possesso di più link personali e li associa alla propria identità cliente. Il merge amplia soltanto la vista del cliente e non i permessi dei workspace fornitori.

## Profilo freelance

Utente primario dell'MVP che opera individualmente. Ha la stessa priorità di prodotto del profilo studio, pur seguendo un percorso iniziale distinto.

## Profilo studio

Utente primario dell'MVP che opera con un piccolo gruppo di collaboratori. Ha la stessa priorità di prodotto del profilo freelance, pur seguendo un percorso iniziale distinto.

## Primo risultato utile

Traguardo dell'onboarding comune ai profili freelance e studio: un progetto creato, almeno un file caricato e un link cliente pronto da inviare.

## MVP verticale completo

Primo rilascio in cui ogni capacità inclusa attraversa UI, autorizzazione, persistenza, infrastruttura e feedback all'utente fino a un esito verificabile. Non ammette mock permanenti, placeholder funzionali, controlli inattivi, schermate orfane o percorsi interrotti.

## Tour guidato

Esperienza simulata e facoltativa che insegna l'interfaccia con dati dimostrativi effimeri. Non è un flusso di configurazione, non crea risorse reali e può essere saltata senza limitare il prodotto.

## Storage provider

Interfaccia esclusiva usata dall'applicazione per operare sullo storage. Nasconde il provider concreto e impedisce alla logica di business di dipendere da Aruba, Local, S3, Cloudflare R2 o Minio.

Il contratto espone soltanto avvio/ispezione/commit di una scrittura, concessione temporanea di lettura, ispezione tecnica di un oggetto e cancellazione fisica idempotente. Rename, Move e Copy sono operazioni del modello applicativo, non dello storage.

## Riferimento storage

Identificatore opaco (`objectRef`) restituito da `StorageProvider` e persistito dall'applicazione. Non contiene semantica di dominio e nessun caller può interpretarlo come path o URL.

## Grant storage

Credenziale tecnica temporanea e limitata a una sessione di scrittura oppure a una modalità di lettura già autorizzata. Non trasferisce decisioni su utenti, ACL, piani o quote al provider.

## Oggetto storage

Sequenza immutabile di byte identificata da una chiave opaca del provider. Può essere riferita da più File logici, versioni, consegne o pubblicazioni e viene eliminata fisicamente soltanto quando nessun riferimento o vincolo di conservazione rimane.

## Gateway storage

Componente PHP stateless ospitato su Aruba. Gestisce filesystem, upload, download, streaming, trasferimento di originali e derivati e callback, ma non genera preview e non conosce utenti, ruoli o piani.

## Derivato preview

Oggetto immutabile prodotto sulla VPS da un worker a partire da una versione file originale: thumbnail, immagine raster, PDF, poster o proxy media. Viene letto e scritto tramite `StorageProvider`; il worker non conosce path Aruba. Il suo stato non modifica l'esito dell'upload originale.

## Coordinatore preview

Consumer dell'evento di versione completata che sceglie la classe di elaborazione e crea un job BullMQ idempotente. Non converte byte e non gira nel processo API.

## Worker preview

Processo isolato sulla VPS per una sola classe di carico: immagini, documenti, media o archivi. Dispone di risorse limitate, usa backpressure e può essere fermato senza interrompere API, upload o download.

## Profilo preview conservativo

Budget condiviso dall'intero pool preview: massimo 30% CPU e 25% RAM della VPS, una elaborazione pesante e due leggere. Nessun nuovo job parte quando CPU o RAM complessive raggiungono il 75%; la ripresa automatica usa isteresi. Un job di costo incerto è sempre pesante.

## Sandbox di conversione

Ambiente effimero specifico per immagini, documenti, media o archivi. Gira non-root, senza rete, con filesystem di base in sola lettura, input read-only, spazio temporaneo isolato e risorse limitate. Non contiene credenziali persistenti e non può contattare direttamente storage o servizi applicativi.

## Capability manifest preview

Documento versionato prodotto insieme a ciascuna immagine worker. Elenca tool, codec e formati realmente verificati dal corpus di contract test. È la fonte usata dall'applicazione per dichiarare una preview supportata; la semplice presenza di un convertitore non è sufficiente.

## Data Encryption Key

Chiave casuale indipendente usata per cifrare un singolo oggetto storage. È conservata soltanto in forma cifrata mediante una Key Encryption Key separata dai dati.

## Key Provider

Interfaccia esclusiva per generare, avvolgere, aprire e ruotare chiavi tramite un vault o KMS in UE. Impedisce ai moduli applicativi di dipendere dal prodotto concreto di key management.

## Key Broker

Servizio sulla VPS che, dopo aver verificato un grant limitato, fornisce al gateway una chiave in memoria per la sola operazione autorizzata. Non salva oggetti e non concede accesso senza scope.

## Cifratura chunked

Formato versionato che cifra e autentica porzioni indipendenti di un oggetto, permettendo upload resumable e letture Range senza decifrare l'intero file. Richiede revisione crittografica indipendente prima del lancio.

## Support Session

Accesso temporaneo read-only concesso esplicitamente dall'Owner a un operatore Support per uno scope preciso, massimo 30 minuti. Non permette download, mutazioni, billing, sicurezza, team o audit ed è visibile e revocabile.

## Break-glass

Elevazione eccezionale di massimo 15 minuti per sicurezza, urgenza o richiesta legale valida. Richiede case, doppia approvazione, scope nominato, audit append-only e review entro 24 ore.

## Audit staff

Registro append-only separato dall'Audit workspace che traccia ricerche, viste sensibili, support session, break-glass, approvazioni e mutazioni degli operatori di piattaforma. Retention ordinaria 24 mesi.

## Content Provider

Interfaccia con cui il sito acquisisce contenuti editoriali pubblici da Sanity senza rendere il CMS una dipendenza della logica applicativa.

## Policy Publisher

Flusso controllato che trasforma una bozza legale in uno snapshot pubblico immutabile, versionato e hashato in PostgreSQL e attiva le eventuali richieste di presa visione o accettazione.

## Policy Restricted

Modalita applicata dopo l'efficacia di una policy materiale non accettata. Consente soltanto lettura/accettazione documenti, export, billing/cancellazione e supporto; sospende nuove attivita, portfolio e link senza cancellare dati.

## Statement of reasons

Comunicazione che spiega una restrizione o sospensione con categoria, fatti essenziali, base, durata, eventuale automazione e modalita di ricorso, salvo limiti legali o investigativi documentati.

## Slug portfolio

Nome case-insensitive usato per `{slug}.portfoliohub.com`. Identifica un Portfolio pubblicato e non puo usare nomi tecnici riservati o confondibili con servizi PortfolioHub.

## Backup Provider

Interfaccia per replicare e riconciliare ciphertext e backup senza legare il dominio a S3. L'adapter MVP usa Amazon S3 in regione Milano e non diventa storage primario salvo failover esplicito.

## Disaster copy

Replica cifrata e verificata di un oggetto attivo su un provider separato da Aruba. Puo essere promossa read-only durante un disastro; non sostituisce lo stato autorevole PostgreSQL.

## Migrazione expand-contract

Strategia in cui lo schema viene prima ampliato in modo compatibile, poi usato dal nuovo codice e soltanto in una release successiva ripulito dai campi precedenti. Consente convivenza e rollback N/N-1.

## SLO

Obiettivo misurabile di affidabilita o prestazione osservato dal punto di vista dell'utente. Guida error budget e rilascio ma non è uno SLA commerciale salvo accordo separato.

## Error budget

Quota di fallimento tollerata dallo SLO nella finestra mensile. Quando viene consumata, i release funzionali cedono priorita ad affidabilita, sicurezza e compliance.

## Preview non supportata

Esito esplicito per un file correttamente caricato ma non visualizzabile nell'MVP. La UI mostra metadata, icona e download; non presenta un errore di upload né una falsa anteprima.

## Capability probe

Controllo automatico eseguito nell'immagine/container dei worker di staging per verificare binari, decoder, codec, limiti e formati effettivamente elaborabili. Una capability non verificata non può essere promessa o abilitata in produzione.

## Share

Risorsa PortfolioHub identificata da `shareId` che concede accesso controllato a contenuti senza esporre un URL diretto dello storage.

## Token temporaneo storage

Credenziale firmata generata da NestJS dopo una decisione di autorizzazione e verificata dal gateway PHP per una specifica operazione sui file.

## Token di playback

Credenziale firmata ottenuta al play mediante un token di avvio valido 5 minuti. È limitata a una versione video e alle operazioni HEAD, GET e Range necessarie a buffer e seek. Dura quanto il video più 30 minuti, con massimo assoluto di 4 ore. Vive nella pagina corrente; dopo un refresh Angular richiede una nuova autorizzazione. La revoca non interrompe una sessione già emessa ma impedisce di crearne altre.
