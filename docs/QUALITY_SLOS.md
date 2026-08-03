# SLO, prestazioni, accessibilita e compatibilita

Stato: approvato per MVP il 31 luglio 2026.

Gli SLO sono obiettivi operativi interni e non diventano SLA contrattuali salvo documento commerciale separato. Sono misurati per ambiente e percorso utente; una media globale non puo nascondere il fallimento di delivery o upload.

## Disponibilita mensile

- app autenticata e API core: 99,5%;
- apertura delivery e link cliente: 99,5%;
- download/streaming autorizzato: 99,5%;
- portfolio pubblici: 99,5%;
- upload: 99,0%, esclusi rifiuti corretti per quota, permessi, scadenza o input invalido;
- Admin globale: 99,0%.

La misura usa probe esterni e telemetria applicativa. Gli errori di dipendenze esterne contano nell'esperienza utente e vengono attribuiti separatamente, non rimossi dalla metrica. Manutenzioni programmate sono mostrate nello status ma consumano comunque error budget.

Quando un percorso esaurisce il 50% del proprio error budget a meta finestra, i release non urgenti che lo interessano vengono sospesi; a budget esaurito sono ammessi soltanto fix di affidabilita, sicurezza e compliance.

## API e pagine

Su richieste valide, cache calda e rete europea normale:

- API read p95 <= 300 ms e p99 <= 800 ms, escluso trasferimento byte;
- API mutation p95 <= 700 ms e p99 <= 1,5 s, esclusi job asincroni e provider esterni;
- autenticazione p95 <= 1 s dopo ricezione credenziali/provider callback;
- TTFB pagine pubbliche p75 <= 800 ms;
- Core Web Vitals p75: LCP <= 2,5 s, INP <= 200 ms, CLS <= 0,1;
- cambio route gia caricata p95 <= 500 ms;
- operazioni asincrone rispondono con stato/job entro 1 s e non tengono aperta la richiesta fino al completamento.

## Upload, download e playback

- creazione sessione upload p95 <= 1 s;
- callback/commit visibile in UI entro 5 s p95 dall'ultimo byte ricevuto;
- resume tus riparte dall'offset confermato senza duplicare la versione nel 99,9% dei test di fault controllati;
- overhead del gateway rispetto alla banda disponibile <= 20% nel benchmark di riferimento, salvo cifratura/latency documentata;
- grant download/playback p95 <= 500 ms;
- first byte download p95 <= 2 s dopo grant, con oggetto online;
- start playback p95 <= 3 s e seek p95 <= 2 s su rete adeguata al bitrate;
- Range restituisce esattamente i byte richiesti e non addebita sessioni multiple per segmenti dello stesso playback.

I benchmark includono file piccoli, 1 GB, 10 GB e il massimo tecnicamente praticabile in staging; prima del lancio deve essere provato il limite piano fino a 100 GB mediante test dedicato.

## Preview

I tempi partono dal commit del file e includono attesa coda:

- immagine/thumbnail p95 <= 2 minuti;
- PDF e Office <= 100 pagine p95 <= 5 minuti;
- poster audio/video p95 <= 5 minuti;
- proxy media p95 <= il maggiore tra 15 minuti e il 50% della durata del contenuto, finche il pool resta nel profilo conservativo;
- aggiornamento UI dello stato entro 5 secondi dalla transizione persistita.

Se le soglie di protezione VPS bloccano i worker, lo stato resta `In coda` con messaggio esplicito; API, upload e download mantengono i propri SLO. Formati corrotti/non supportati sono esiti di prodotto, non errori di disponibilita.

## Email e notifiche

- evento persistito e job email creato entro 5 secondi p95;
- messaggio critico accettato da Resend entro 60 secondi p95 quando il provider è disponibile;
- notifica in-app visibile entro 10 secondi p95;
- webhook provider elaborato entro 60 secondi p95;
- duplicati visibili per stessa idempotency key: zero nei test e target operativo.

## Accessibilita

Target: WCAG 2.2 livello AA per marketing, app, onboarding, area cliente, delivery, portfolio, checkout handoff e Admin.

Requisiti:

- HTML semantico, landmark, heading e nomi accessibili;
- tutte le funzioni disponibili da tastiera, focus visibile e non nascosto;
- skip link, ordine focus coerente e focus restituito dopo dialog/drawer;
- contrasto testo almeno 4,5:1 e componenti/grafica almeno 3:1 dove richiesto;
- zoom testo 200% e reflow a 400% senza perdita funzionale;
- target minimi WCAG da 24 CSS px; controlli principali/touch progettati a 44 CSS px;
- light e dark mode entrambi verificati, senza comunicare stato soltanto col colore;
- `prefers-reduced-motion`, animazioni non essenziali disattivabili e nessun flash pericoloso;
- errori form associati ai campi, summary, suggerimento di correzione e stato annunciato;
- tabelle, menu, tree, upload progress, player e drag/drop con alternativa tastiera;
- autenticazione compatibile con password manager, paste e metodi senza test cognitivi;
- player accessibile e supporto a tracce caption fornite; PortfolioHub non promette generazione automatica di sottotitoli ai file cliente;
- PDF legali/documentali pubblicati anche come HTML accessibile.

Test: axe automatizzato senza violazioni critical/serious, Lighthouse come segnale, screen reader manuale VoiceOver+Safari e NVDA+Firefox sui flussi critici, keyboard-only e zoom/reflow. L'automazione non sostituisce il test manuale.

## Responsive e compatibilita

- viewport supportati da 320 CSS px a 2560 px;
- nessuno scroll orizzontale di pagina a 320 px salvo componenti intrinsecamente bidimensionali con contenitore accessibile;
- sidebar collassabile desktop e drawer mobile; stato non impedisce navigazione;
- touch, mouse, tastiera e screen reader supportati;
- ultime due major stabili di Chrome, Edge, Firefox e Safari;
- ultime due major di iOS/iPadOS Safari e Chrome Android;
- nessun supporto Internet Explorer o browser embedded obsoleti; fallback chiaro per codec/media non supportati.

## Capacity e degradazione

- VPS mantiene almeno 20% CPU e 20% RAM di headroom nel carico sostenuto di lancio;
- database pool, queue, file descriptor e spazio disco hanno soglie warning/critical;
- preview e analytics vengono messi in pausa prima dei flussi interattivi;
- email non critica puo ritardare; sicurezza, cancellazione e billing hanno priorita;
- in failover storage read-only, consultazione e download continuano mentre upload e mutazioni mostrano indisponibilita esplicita;
- nessun piano a pagamento riceve artificialmente prestazioni inferiori; i limiti commerciali non alterano integrita o sicurezza.

## Gate di rilascio

- dashboard SLI per ogni percorso e alert testati;
- load test sul profilo di traffico previsto con 30% margine;
- fault test su DB, Redis, RabbitMQ, Aruba, S3, KMS, Stripe e Resend;
- Core Web Vitals misurati su device mobile medio e rete simulata;
- audit WCAG automatico e manuale dei flussi critici;
- browser matrix completata;
- nessun rilascio con error budget esaurito salvo eccezioni definite sopra.
