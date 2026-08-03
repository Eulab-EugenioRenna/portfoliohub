export interface LegalSection {
  id: string;
  heading: string;
  body: string;
}

export interface LegalDocument {
  kind: 'terms' | 'privacy';
  version: string;
  updatedAt: string;
  status: 'draft-review';
  content: {
    title: string;
    summary: string;
    audience: string;
    sections: LegalSection[];
  };
}

const contact = 'eulabconsult@gmail.com';

export const LEGAL_DOCUMENTS: Record<'terms' | 'privacy', LegalDocument> = {
  terms: {
    kind: 'terms',
    version: 'Bozza 1.0',
    updatedAt: '2026-08-03',
    status: 'draft-review',
    content: {
      title: 'Termini e condizioni di PortfolioHub',
      summary:
        'Le regole per creare un workspace, collaborare, consegnare file, usare il trial Pro e gestire un abbonamento PortfolioHub.',
      audience:
        'Utenti, Owner, membri dei workspace, collaboratori e clienti che usano accessi dedicati.',
      sections: [
        {
          id: 'servizio-gestore',
          heading: '1. Servizio e gestore',
          body: `PortfolioHub è un servizio digitale gestito da Eulab per organizzare progetti, archiviare e versionare file, collaborare con un team, pubblicare portfolio e creare consegne protette per i clienti. Il servizio è disponibile tramite portfoliohub.eulab.cloud e le applicazioni collegate.\n\nPer assistenza, comunicazioni contrattuali, privacy e segnalazioni è disponibile ${contact}. I dati societari e fiscali completi del gestore devono essere aggiunti e verificati prima che questa bozza diventi una versione efficace.`,
        },
        {
          id: 'destinatari-account',
          heading: '2. Destinatari, account e sicurezza',
          body: `PortfolioHub è rivolto a professionisti maggiorenni, freelance, studi e organizzazioni. Chi registra un account dichiara di avere la capacità di concludere il contratto e, quando agisce per un’organizzazione, di essere autorizzato a rappresentarla.\n\nL’utente deve fornire dati corretti, verificare l’indirizzo email, custodire password e dispositivi e comunicare senza ritardo accessi sospetti. Gli account sono personali. Ruoli e permessi del workspace non possono essere aggirati condividendo sessioni, credenziali o link riservati. PortfolioHub può revocare sessioni compromesse e richiedere una nuova autenticazione per operazioni sensibili.`,
        },
        {
          id: 'workspace-ruoli',
          heading: '3. Workspace, proprietà e ruoli',
          body: `Ogni workspace ha un solo Owner. L’Owner controlla piano, membri, clienti, progetti, consegne, portfolio e cancellazione e può trasferire volontariamente la proprietà a un membro verificato. Admin, Editor, Uploader, Viewer e Guest operano entro i permessi e gli ambiti assegnati.\n\nIl link cliente serve a consultare o scaricare una consegna e non attribuisce accesso al workspace. Il link collaboratore richiede autenticazione e assegna soltanto il ruolo e l’ambito indicati nell’invito. L’Owner è responsabile delle persone invitate e della liceità delle istruzioni impartite tramite il workspace.`,
        },
        {
          id: 'trial-piani',
          heading: '4. Trial Pro e piani',
          body: `Il primo workspace creato da un utente beneficia una sola volta di 30 giorni gratuiti del piano Pro, senza carta. Alla scadenza, se non viene acquistato un piano, il workspace passa a Free; i dati non vengono cancellati automaticamente.\n\nFree include 50 GB di storage, 50 GB di traffico mensile, un progetto e fino a 3 membri. Pro costa €24,90 al mese o €249 l’anno e include 1 TB di storage, 3 TB di traffico mensile, progetti, clienti e consegne illimitati e fino a 10 membri. Unlimited costa €159,90 al mese o €1.599 l’anno e non applica limiti numerici prefissati alle risorse indicate nel catalogo, restando soggetto a fair use.\n\nUn singolo file può occupare al massimo 50 GB su Free e 100 GB su Pro o Unlimited, sempre entro la quota disponibile. Un GB commerciale equivale a 1.000.000.000 byte.`,
        },
        {
          id: 'pagamenti-rinnovi',
          heading: '5. Pagamenti, rinnovi e cancellazione del piano',
          body: `Pagamenti, fatture e strumenti di pagamento sono gestiti tramite Stripe. PortfolioHub non conserva i dati completi della carta. Il backend aggiorna il piano soltanto dopo eventi Stripe verificati; il semplice ritorno dalla pagina di pagamento non prova l’avvenuto pagamento.\n\nL’upgrade è applicato dopo conferma del pagamento e può includere prorata. Downgrade, passaggio mensile/annuale e cancellazione hanno effetto alla fine del periodo pagato, salvo un upgrade immediato. La gestione avviene dal portale di fatturazione collegato nell’app.\n\nIn caso di pagamento fallito è prevista una tolleranza di 7 giorni. Se il pagamento non viene regolarizzato, il workspace passa a Free. Se supera le quote Free, resta disponibile soltanto il percorso previsto per ripristinare il piano o svuotare consapevolmente il workspace. I diritti inderogabili del consumatore, quando applicabili, restano invariati, incluso l’eventuale diritto di recesso previsto dalla legge.`,
        },
        {
          id: 'contenuti-licenza',
          heading: '6. Proprietà dei contenuti e licenza tecnica',
          body: `Utenti e workspace conservano la titolarità dei file, testi, immagini, commenti e altri contenuti caricati. Caricando un contenuto, il workspace concede a PortfolioHub la sola autorizzazione tecnica necessaria per conservarlo, cifrarlo, replicarlo per backup, generare anteprime, distribuirlo ai destinatari autorizzati e cancellarlo secondo le istruzioni ricevute.\n\nIl workspace garantisce di avere diritti e basi giuridiche sufficienti per caricare, condividere e pubblicare i contenuti e per trattare i dati di membri, clienti e destinatari. PortfolioHub non acquisisce diritti di sfruttamento commerciale sui contenuti e non li usa per finalità pubblicitarie proprie.`,
        },
        {
          id: 'consegne-link',
          heading: '7. Consegne, portfolio e link pubblici',
          body: `Chi crea un link decide destinatari, contenuti, durata, password, permessi di download, commento e approvazione ed eventuale modalità one-shot. I link possono essere inoltrati da chi li riceve: password, scadenza e revoca devono essere configurate in modo proporzionato alla sensibilità del materiale.\n\nUn link one-shot si considera consumato al primo accesso valido. Una revoca o una scadenza rende il contenuto indisponibile, ma non elimina copie già scaricate legittimamente dal destinatario. Il workspace è responsabile di quanto pubblicato nel proprio portfolio e delle informazioni rese visibili a visitatori e clienti.`,
        },
        {
          id: 'uso-accettabile',
          heading: '8. Uso accettabile e fair use',
          body: `È vietato usare PortfolioHub per attività illecite, frode, violazione di diritti di terzi, diffusione consapevole di malware, elusione dei controlli di sicurezza, abuso di identità o credenziali, spam, rivendita non autorizzata di storage o CDN, backup estraneo allo scopo professionale del servizio o carichi che compromettano la piattaforma.\n\nIl piano Unlimited non autorizza un consumo irragionevole o incompatibile con un servizio condiviso. Limiti tecnici e misure temporanee possono essere applicati per sicurezza, continuità e tutela degli altri workspace. Salvo urgenza o divieto, PortfolioHub comunica motivo, durata, dati coinvolti e modalità di ricorso.`,
        },
        {
          id: 'sicurezza-file',
          heading: '9. Sicurezza e file non fidati',
          body: `PortfolioHub applica isolamento tra workspace, controlli server-side, cifratura dei file prima dello storage, token a vita breve, logging selettivo e backup cifrati. Queste misure riducono i rischi ma non garantiscono disponibilità assoluta o assenza di vulnerabilità.\n\nIl servizio genera anteprime in ambienti limitati e tratta ogni file come non fidato, ma l’MVP non include una scansione antivirus e non certifica che un file sia sicuro. L’utente deve mantenere proprie copie dei materiali essenziali e verificare i file prima di aprirli o distribuirli.`,
        },
        {
          id: 'sospensione-ricorso',
          heading: '10. Sospensione e ricorso',
          body: `PortfolioHub può limitare immediatamente account, link o workspace in caso di abuso, frode, illegalità, rischio concreto per la sicurezza, violazione sostanziale dei presenti Termini o obbligo valido dell’autorità. Quando possibile, la comunicazione indica fatti essenziali, base della misura, durata e canale di ricorso.\n\nUna sospensione confermata per 7 giorni consecutivi può avviare la cancellazione, salvo ricorso in corso, obblighi di conservazione o legal hold. Il ricorso sospende il conto alla rovescia di cancellazione, ma non necessariamente la misura protettiva quando permane un rischio.`,
        },
        {
          id: 'cancellazione-dati',
          heading: '11. Cancellazione, esportazione e fine del rapporto',
          body: `L’Owner può richiedere l’esportazione dei dati e programmare la cancellazione dell’account. Se non trasferisce la proprietà, account e workspace posseduti entrano in quarantena per 30 giorni: sessioni e link vengono disabilitati e i dati restano congelati. Entro il termine l’Owner può annullare la richiesta dopo verifica e riautenticazione.\n\nScaduti i 30 giorni, parte la cancellazione definitiva asincrona. Copie cifrate non accessibili possono restare nei backup fino alla naturale sovrascrittura, comunque entro la finestra massima prevista, salvo record soggetti a obbligo legale o legal hold. La cancellazione del piano a pagamento non equivale alla cancellazione dell’account: alla fine del periodo il workspace passa a Free.`,
        },
        {
          id: 'disponibilita-responsabilita',
          heading: '12. Disponibilità, responsabilità e assistenza',
          body: `PortfolioHub può eseguire manutenzioni, aggiornamenti e interventi urgenti. In caso di indisponibilità imputabile al servizio, eventuali rimedi o rimborsi proporzionali sono valutati secondo il piano, la causa, la durata e i diritti inderogabili applicabili.\n\nNei limiti consentiti dalla legge, PortfolioHub non risponde di danni causati da credenziali condivise, configurazioni dei link scelte dal workspace, contenuti illeciti o difettosi, copie già scaricate, servizi di terzi fuori dal proprio controllo o mancata conservazione di una copia essenziale da parte dell’utente. Nessuna clausola limita responsabilità che non possono essere escluse per legge.`,
        },
        {
          id: 'modifiche-legge',
          heading: '13. Modifiche, legge applicabile e contatti',
          body: `Le modifiche materiali a prezzo, rinnovo, diritti, uso dei dati, sospensione, cancellazione o responsabilità sono comunicate normalmente con almeno 30 giorni di preavviso e richiedono una nuova accettazione quando previsto. Le modifiche urgenti imposte da sicurezza o legge sono motivate e comunicate appena possibile. Le versioni precedenti restano archiviate.\n\nI Termini sono regolati dalla legge italiana. Per i consumatori restano ferme le competenze territoriali e le tutele inderogabili previste dalla normativa applicabile; per gli utenti professionali il foro deve essere completato nella versione sottoposta a revisione legale. Comunicazioni e ricorsi possono essere inviati a ${contact}.`,
        },
      ],
    },
  },
  privacy: {
    kind: 'privacy',
    version: 'Bozza 1.0',
    updatedAt: '2026-08-03',
    status: 'draft-review',
    content: {
      title: 'Privacy Policy di PortfolioHub',
      summary:
        'Come PortfolioHub tratta dati di account, workspace, clienti, collaboratori, consegne, portfolio, supporto e fatturazione.',
      audience:
        'Utenti registrati, membri, clienti, destinatari di link, visitatori dei portfolio e persone che contattano il supporto.',
      sections: [
        {
          id: 'titolare-contatti',
          heading: '1. Titolare e contatti',
          body: `Per i trattamenti relativi ad account PortfolioHub, sicurezza, fatturazione, assistenza e comunicazioni proprie, il titolare è Eulab, gestore di PortfolioHub. Il contatto privacy è ${contact}. I dati societari, fiscali e di sede completi devono essere integrati prima della pubblicazione della versione efficace.\n\nÈ possibile usare lo stesso indirizzo per esercitare i diritti, segnalare un incidente privacy o chiedere chiarimenti. Le richieste possono richiedere una verifica proporzionata dell’identità per evitare che dati personali siano comunicati alla persona sbagliata.`,
        },
        {
          id: 'ruoli-privacy',
          heading: '2. Ruoli di PortfolioHub e del workspace',
          body: `PortfolioHub è titolare autonomo per registrazione, sicurezza, gestione del contratto, billing, prevenzione abusi, supporto e comunicazioni della piattaforma.\n\nQuando un workspace carica file, crea clienti, invita collaboratori o condivide consegne per finalità decise dal workspace, il workspace opera normalmente come titolare e PortfolioHub tratta tali dati come responsabile tecnico secondo le istruzioni ricevute. Un Data Processing Agreement deve disciplinare in dettaglio questo rapporto prima del lancio. Il workspace deve fornire agli interessati le proprie informative e disporre di una base giuridica valida.`,
        },
        {
          id: 'dati-raccolti',
          heading: '3. Dati trattati',
          body: `PortfolioHub può trattare:\n\n• dati di account: nome, email verificata, credenziali protette, preferenze e stato account;\n• dati del workspace: nome, tipo, ruoli, membri, permessi, clienti e progetti;\n• contenuti e metadati: file, versioni, cartelle, dimensioni, formati, anteprime, commenti, approvazioni e percorsi;\n• dati di condivisione: destinatari, link, scadenze, accessi, download, password memorizzate solo come hash e token temporanei memorizzati solo come hash;\n• dati di portfolio e contatto resi pubblici dal workspace;\n• dati tecnici e di sicurezza: IP minimizzati quando previsto, user agent, sessioni, eventi audit, tentativi falliti e indicatori di abuso;\n• billing: piano, stato abbonamento, identificativi Stripe, fatture e risultati dei pagamenti, non i dati completi della carta;\n• supporto e comunicazioni: ticket, conversazioni, preferenze email, stato di consegna, bounce e complaint.`,
        },
        {
          id: 'finalita-basi',
          heading: '4. Finalità e basi giuridiche',
          body: `I dati sono trattati per:\n\n• eseguire il contratto e fornire account, workspace, storage, collaborazione, consegne, portfolio, supporto e billing;\n• adempiere obblighi legali, fiscali, contabili, privacy e richieste valide delle autorità;\n• perseguire il legittimo interesse alla sicurezza, prevenzione frodi, difesa dei diritti, continuità, misurazione delle quote e miglioramento tecnico proporzionato;\n• gestire comunicazioni operative indispensabili, come verifica email, sicurezza, fatture, ticket e cambi contrattuali;\n• inviare marketing o attivare cookie non necessari soltanto sulla base di una scelta separata, facoltativa e revocabile.\n\nQuando PortfolioHub opera come responsabile, la base giuridica del trattamento dei contenuti è determinata dal workspace titolare.`,
        },
        {
          id: 'infrastruttura-sicurezza',
          heading: '5. Infrastruttura, cifratura e minimizzazione',
          body: `Il progetto prevede che database, code, worker, backup applicativi e servizio chiavi primario siano collocati nello Spazio Economico Europeo, preferendo l’Italia per VPS e storage. Aruba conserva gli oggetti nei propri data center italiani. I file vengono cifrati a chunk con cifratura autenticata prima della persistenza; le chiavi in chiaro non sono memorizzate su Aruba, nel database, nelle code o nei log.\n\nPassword, token e grant temporanei non sono inviati in chiaro nei log. Corpi dei file, URL temporanei, password e contenuti dei commenti non devono entrare in email, analytics o log tecnici. Le consegne private non sono indicizzate e, per impostazione predefinita, delivery e portfolio non usano tracking non essenziale.`,
        },
        {
          id: 'fornitori-trasferimenti',
          heading: '6. Fornitori e trasferimenti',
          body: `PortfolioHub utilizza fornitori tecnici limitatamente alle funzioni necessarie. Nell’architettura attuale rientrano Aruba per storage e infrastruttura collegata, Stripe per pagamenti e fatturazione e Resend per l’invio email. PostgreSQL, Redis e RabbitMQ supportano persistenza, sessioni, code e attività asincrone nella piattaforma.\n\nOgni fornitore deve essere disciplinato da accordi adeguati, misure di sicurezza e un elenco subprocessori aggiornato con finalità, regione e data di ingresso. Se un dato viene trasferito fuori dallo SEE, PortfolioHub applica il meccanismo previsto dal GDPR e valuta le misure supplementari necessarie. Il contenuto dei file non viene trasmesso a Stripe o Resend.`,
        },
        {
          id: 'conservazione',
          heading: '7. Tempi di conservazione',
          body: `I dati sono conservati per il tempo necessario alla finalità e secondo queste regole di prodotto:\n\n• account e contenuti: per la durata del rapporto, poi quarantena di cancellazione di 30 giorni e purge;\n• cestino di file e cartelle: 30 giorni prima della cancellazione definitiva;\n• Cronologia attività: 12 mesi mobili; Audit workspace: 24 mesi mobili;\n• metadata delle email operative: 12 mesi; token hash: eliminati entro 24 ore dalla scadenza;\n• certificato pseudonimizzato di cancellazione: 24 mesi;\n• backup cifrati: finestra mobile massima di 30 giorni; dopo la purge i dati possono restare non accessibili fino alla sovrascrittura, comunque entro tale finestra;\n• fatture, consensi, suppression email, eventi di sicurezza, contenzioso e legal hold: per il periodo imposto dalla legge o strettamente necessario alla finalità dedicata.\n\nUna conservazione speciale riguarda soltanto i record necessari e non prolunga automaticamente tutti i dati del workspace.`,
        },
        {
          id: 'condivisioni-pubbliche',
          heading: '8. Clienti, consegne e portfolio pubblici',
          body: `Il workspace decide quali dati di clienti e collaboratori inserire e quali file rendere accessibili tramite consegna, link personale o portfolio. I destinatari vedono soltanto lo scope autorizzato; non possono consultare altri progetti o workspace.\n\nGli accessi a consegne, download, commenti e approvazioni possono essere registrati per sicurezza, quota, audit e prova delle operazioni. Un link pubblico può rivelare titolo, nome della cartella, numero di elementi, data, scadenza e protezioni configurate. Il workspace deve evitare titoli o nomi file che espongano dati non necessari e deve scegliere password e scadenze adeguate.`,
        },
        {
          id: 'email-supporto',
          heading: '9. Email, notifiche e supporto',
          body: `PortfolioHub invia email operative per verifica account, sicurezza, inviti, consegne, ticket, trial, billing, quota, sospensione, cancellazione e modifiche materiali. Le comunicazioni indispensabili al servizio non contengono marketing. Le preferenze configurabili si gestiscono nell’app; marketing e aggiornamenti promozionali sono disattivati finché non viene espresso un consenso separato.\n\nI ticket conservano oggetto, conversazione, stato, priorità, autore e timestamp per gestire la richiesta e documentare l’assistenza. Aperture e risposte possono essere inviate alla casella operativa del supporto e all’indirizzo verificato dell’utente. Bounce e segnalazioni possono inserire l’indirizzo in una suppression list tecnica.`,
        },
        {
          id: 'cookie-preferenze',
          heading: '10. Cookie e tecnologie locali',
          body: `Prima di una scelta vengono utilizzati soltanto cookie o tecnologie strettamente necessarie per sessione, sicurezza, CSRF, preferenze essenziali e funzionamento dell’app. Tema, stato della sidebar e completamento del tutorial possono essere memorizzati localmente nel browser.\n\nAnalytics, marketing e altri strumenti non necessari non devono essere attivati senza una scelta granulare. Quando introdotti, il centro preferenze offrirà Accetta tutti, Rifiuta non necessari e Personalizza con pari evidenza e consentirà la revoca in ogni momento.`,
        },
        {
          id: 'diritti',
          heading: '11. Diritti delle persone',
          body: `Nei casi previsti dal GDPR è possibile chiedere accesso, rettifica, cancellazione, limitazione, portabilità e opposizione, nonché revocare un consenso senza pregiudicare i trattamenti già effettuati. Nell’app l’utente può avviare un’esportazione dei dati e programmare la cancellazione dell’account.\n\nLe richieste ricevono verifica dell’identità, ticket e audit e sono gestite senza ritardo ingiustificato, normalmente entro un mese salvo estensione legalmente ammessa e comunicata. L’export non include dati di altri workspace o persone non necessari alla richiesta. Per esercitare i diritti: ${contact}. È inoltre possibile proporre reclamo al Garante per la protezione dei dati personali.`,
        },
        {
          id: 'decisioni-autorita',
          heading: '12. Automazioni, abusi e richieste delle autorità',
          body: `Quote, rate limit, scadenze, pagamenti, one-shot e segnali di sicurezza possono produrre limitazioni automatiche previste dal servizio. Le misure per abuso o contenuti illeciti devono avere una base definita, una motivazione e un canale di ricorso; quando possibile la revisione è effettuata da una persona diversa dal decisore iniziale.\n\nPortfolioHub comunica dati alle autorità soltanto a fronte di una richiesta valida, verificata, proporzionata e auditata. La divulgazione è limitata allo scope necessario e, quando consentito, l’interessato viene informato. Ogni legal hold ha motivazione, responsabile, scadenza e riesame.`,
        },
        {
          id: 'minori-modifiche',
          heading: '13. Minori, modifiche e riferimenti',
          body: `PortfolioHub è rivolto a professionisti maggiorenni e non è progettato per raccogliere consapevolmente dati di minori come servizio dedicato. Se un workspace tratta immagini o dati di minori nei propri contenuti, deve disporre delle autorizzazioni e delle garanzie richieste.\n\nLe modifiche sostanziali dell’informativa sono comunicate con evidenza, data, versione e sintesi. Le versioni pubblicate non vengono riscritte retroattivamente. I principi e i diritti descritti fanno riferimento al Regolamento (UE) 2016/679; maggiori informazioni sono disponibili su eur-lex.europa.eu e garanteprivacy.it.`,
        },
      ],
    },
  },
};
