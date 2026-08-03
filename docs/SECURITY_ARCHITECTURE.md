# Architettura di sicurezza e privacy

Stato: contratto MVP approvato il 31 luglio 2026. I testi legali e il formato crittografico richiedono revisione professionale prima del lancio.

## Obiettivi e confini

PortfolioHub protegge identità, metadata, originali, derivati, consegne e dati di billing contro accesso non autorizzato, alterazione, perdita e abuso. Nessun singolo controllo è considerato sufficiente: autorizzazione, cifratura, isolamento, logging, backup e procedure operative si sovrappongono.

L'MVP non esegue antivirus e non dichiara mai che un file sia sicuro. I convertitori trattano ogni upload come non fidato e girano nelle sandbox definite dal PRD.

## Residenza e minimizzazione

- PostgreSQL, Redis, RabbitMQ, worker, backup applicativi e key service primario devono essere collocati nello Spazio Economico Europeo; per VPS e storage si preferisce l'Italia.
- Aruba Hosting conserva lo spazio web nei propri data center italiani.
- Email, pagamenti, error tracking e altri subprocessori possono trattare metadata strettamente necessari secondo DPA, elenco subprocessori, base di trasferimento e valutazione applicabile.
- Corpi file, URL temporanei, password, token, chiavi e contenuto di commenti non entrano in email, code, analytics o log tecnici.
- PortfolioHub è titolare per account, sicurezza, billing e comunicazioni proprie; per contenuti e clienti caricati dal workspace opera secondo i ruoli descritti nel DPA, da validare legalmente.

## Cifratura degli oggetti su Aruba

La documentazione pubblica dell'hosting non viene interpretata come garanzia di cifratura a riposo. Originali e derivati vengono quindi cifrati a livello applicativo prima della persistenza.

### Envelope encryption

- ogni oggetto fisico riceve una Data Encryption Key casuale indipendente da 256 bit;
- i byte sono cifrati con una modalità AEAD standard basata su AES-256-GCM o equivalente approvata;
- la DEK viene cifrata da una Key Encryption Key custodita mediante `KeyProvider` e il blob cifrato può essere salvato con i metadata;
- chiavi in chiaro non vengono persistite su Aruba, PostgreSQL, log, code o immagini container;
- la rotazione ordinaria sostituisce la KEK riavvolgendo le DEK, senza riscrivere tutti i file; compromissione o cambio di algoritmo può richiedere re-encryption pianificata;
- la cancellazione definitiva elimina oggetto, DEK cifrata e riferimenti; la distruzione della DEK rende il ciphertext non recuperabile.

### Formato chunked e Range

Gli oggetti sono suddivisi in chunk autenticati indipendenti per consentire resume e richieste HTTP Range. Ogni chunk usa nonce univoco generato con CSPRNG e Additional Authenticated Data che lega almeno versione formato, object reference, indice chunk e lunghezza. Il gateway traduce il range plaintext nei chunk cifrati necessari, ne verifica il tag e restituisce soltanto i byte richiesti.

Non è ammesso progettare primitive o nonce ad hoc. Dimensione chunk, header, nonce, tag, recovery dopo upload interrotto e limiti crittografici devono essere definiti in una specifica versionata, implementati con librerie mature e approvati mediante review crittografica indipendente, vector test, test di corruzione e benchmark su file fino al limite di piano. Questo è un gate bloccante per il lancio.

### Key broker

Il gateway PHP resta stateless. Per upload o lettura presenta al Key Broker un grant firmato, a vita breve e limitato a oggetto, operazione e sessione. Il broker verifica grant e stato di revoca, usa `KeyProvider` e restituisce la chiave soltanto tramite canale autenticato; il gateway la conserva in memoria per la durata strettamente necessaria e la scarta a fine richiesta/sessione.

Il `KeyProvider` è un'interfaccia sostituibile. La produzione richiede un vault/KMS collocato in UE, controllo accessi machine-to-machine, audit, rotazione e recovery testato. Le chiavi non possono essere semplici variabili d'ambiente permanenti. Local development usa chiavi effimere non condivise con staging o produzione.

## Trasporto

- TLS 1.2 o superiore su browser, API, gateway e webhook; TLS 1.3 preferito.
- Redirect HTTP verso HTTPS e HSTS dopo verifica completa dei sottodomini.
- mTLS o credenziali workload a vita breve tra VPS, Key Broker e gateway Aruba.
- Nessuna disattivazione della verifica certificati.
- URL e grant temporanei non vengono scritti nei log.

## Identita e sessioni

- password con Argon2id, salt univoco e parametri almeno pari alla baseline OWASP; calibrazione periodica sul server senza superare una latenza di login accettabile;
- password mai cifrate reversibilmente, mai loggate e mai inviate via email;
- token reset, magic link, invito, recupero e one-shot generati con CSPRNG e persistiti soltanto come hash;
- cookie di sessione `__Host-`, `Secure`, `HttpOnly`, `SameSite=Lax`, senza attributo Domain e con Path `/`;
- refresh token ruotati, rilevamento reuse, revoca della famiglia e lista dispositivi;
- rigenerazione sessione dopo login, cambio privilegio, recupero e 2FA;
- riautenticazione per ownership, billing, export audit, wipe, cancellazione account e cambio credenziali;
- TOTP e recovery code nel Pro; recovery code hashati e mostrati una sola volta.

## CSRF, CORS e browser

- ogni mutazione usa metodo non-GET e token CSRF cookie-to-header verificato dal backend;
- SameSite e Fetch Metadata sono difese aggiuntive, non sostituiscono il token CSRF;
- verifica Origin/Referer per operazioni mutanti e fallback controllato per client compatibili;
- CORS allowlist esatta per ambiente, mai wildcard con credenziali;
- CSP restrittiva con nonce/hash, `frame-ancestors`, MIME sniffing disabilitato, Referrer-Policy e Permissions-Policy;
- contenuti SVG/HTML caricati non vengono serviti inline sul dominio applicativo;
- portfolio pubblico e contenuti utente usano un origin isolato dalla sessione dell'app.

## Rate limit e anti-enumeration

I limiti sono token bucket Redis configurabili e combinano IP, identita, workspace e risorsa. Le risposte di recupero non rivelano se l'account esiste.

Baseline MVP:

- login falliti: 5 ogni 15 minuti per coppia account/IP e 30 ogni 15 minuti per IP, con backoff progressivo e senza lock permanente sfruttabile per denial of service;
- magic link e reset password: 3 per ora per indirizzo e 20 per ora per IP;
- verifica password di una consegna: 10 tentativi ogni 15 minuti per link/IP;
- mutazioni API ordinarie: 120 al minuto per utente, con limiti specifici piu bassi sulle operazioni costose;
- lettura metadata link pubblico: 120 al minuto per IP;
- avvio download o playback: 30 al minuto per combinazione link/IP, oltre ai limiti di consegna e traffico;
- creazione sessioni upload: 20 per ora per utente; chunk di una sessione valida non consumano il limite richieste ma rispettano concorrenza e banda;
- eventi che superano ripetutamente i limiti alimentano il rilevamento abuso senza bloccare automaticamente account legittimi in modo permanente.

Risposte `429` includono un retry coerente; i limiti possono essere stretti in emergenza mediante configurazione auditata. Nessun aumento di limite aggira quote o ACL.

## File non fidati

- identificazione tramite magic bytes e parser, mai solo estensione o MIME dichiarato;
- nome file normalizzato e mai usato come path storage;
- protezione da path traversal, symlink, zip slip, archive bomb e decompression ratio anomalo;
- ZIP ispezionato senza estrazione persistente e con limiti su entry, profondita, dimensione dichiarata e rapporto di compressione;
- convertitori non-root, senza rete, con filesystem read-only, input read-only, seccomp/capability ridotte, cgroup, timeout e cleanup;
- originali non vengono eseguiti, inclusi macro Office, script PDF, SVG, HTML e media metadata;
- preview fallita o non supportata non dichiara il file sicuro e non modifica l'esito upload.

## Secret e key management

- secret esclusi da repository, immagini, frontend, log e database applicativo;
- secret distinti per sviluppo, staging e produzione e per singolo servizio;
- accesso minimo, auditato e revocabile; nessun secret globale condiviso da tutti i container;
- rotazione ordinaria almeno ogni 90 giorni per credenziali statiche residue e immediata su sospetta compromissione;
- webhook secret accettano per una breve finestra la versione corrente e precedente durante la rotazione;
- recovery di key vault e backup chiavi testato almeno trimestralmente con procedura a doppio controllo;
- scansione automatica secret su commit e immagini.

## Privacy e diritti

- registro trattamenti, data map, DPA, subprocessori e basi giuridiche mantenuti e versionati;
- privacy by default: campi opzionali vuoti, analytics minimizzati, marketing disattivato e nessuna indicizzazione di consegne private;
- richieste accesso, rettifica, portabilita, opposizione e cancellazione ricevono ticket, verifica identita, scadenza e audit;
- risposta senza ritardo ingiustificato e comunque entro un mese, salvo estensione legalmente ammessa e comunicata;
- export in formato interoperabile contiene dati dell'interessato senza rivelare dati di altri workspace o clienti;
- legal hold e obblighi di conservazione sospendono soltanto la cancellazione dei record necessari;
- prodotto rivolto a professionisti maggiorenni; non raccoglie consapevolmente dati di minori come servizio dedicato.

## Abuse handling e autorita

- canale pubblico per segnalazioni abuso, sicurezza e contenuti illeciti;
- triage con categoria, severita, evidenza minima, workspace interessato, decisione, reviewer e scadenza;
- sospensione immediata soltanto per cause definite nella Fair Use/AUP o rischio urgente; motivazione comunicata salvo divieto legale o rischio investigativo;
- ricorso separato dal decisore iniziale quando possibile e countdown cancellazione sospeso durante la revisione;
- accesso o divulgazione di contenuti per autorita richiede richiesta valida verificata, base giuridica, minimizzazione e approvazione di due persone autorizzate tra Legal/Privacy e Security/Operations;
- urgenze documentate possono usare break-glass con review successiva entro 24 ore;
- l'interessato viene informato prima della divulgazione quando consentito, altrimenti appena cessa il divieto;
- ogni legal hold ha scope, motivazione, approvatore, data di revisione e scadenza; non puo essere indefinito senza riesame.

## Incident response

- runbook per compromissione account, perdita chiavi, data breach, abuso storage, indisponibilita e corruzione backup;
- Security Lead coordina contenimento; Privacy/Legal valuta obblighi e comunicazioni;
- registro incidenti con timeline, decisioni, impatto, evidenze e azioni correttive;
- valutazione breach immediata e notifica all'autorita entro 72 ore quando richiesta; interessati avvisati senza ritardo quando esiste rischio elevato;
- rotazione credenziali e revoca sessioni disponibili senza deploy applicativo;
- postmortem per incidenti severi, con azioni tracciate fino alla chiusura.

## Gate di lancio

Prima della produzione devono risultare superati:

1. threat model e data-flow review;
2. review crittografica indipendente del formato chunked e del key lifecycle;
3. test di autorizzazione tenant/ACL e anti-IDOR;
4. test CSRF, CORS, session fixation, token reuse e rate limit;
5. corpus file ostili e test sandbox/zip bomb/parser timeout;
6. dependency, container, secret e vulnerability scan senza criticita aperte;
7. penetration test sul perimetro auth, upload, share, admin e billing;
8. restore completo e prova tombstone;
9. esercitazione perdita/rotazione chiavi e incident response;
10. revisione legale di DPA, privacy, AUP, retention, subprocessori e trasferimenti.
