# Ambienti, deployment e disaster recovery

Stato: approvato per MVP il 31 luglio 2026.

## Ambienti

### Local development

- Docker Compose locale con PostgreSQL, Redis, RabbitMQ e provider filesystem locale.
- Stripe test mode, provider email sandbox/capture e Sanity dataset di sviluppo.
- Chiavi effimere generate per sviluppatore; nessun accesso a secret o dati reali.
- Fixture sintetiche riproducibili e contract test degli adapter.

### CI effimera

- Ambiente creato per commit/PR, isolato e distrutto a fine job.
- Esegue lint, typecheck, unit, integration, contract, migration e security test.
- Non riceve credenziali di produzione; i test end-to-end usano emulatori o account test dedicati.

### Staging

- VPS distinta dalla produzione, anche di taglia inferiore, con stack equivalente.
- Database, Redis, RabbitMQ, domini, chiavi KMS, bucket S3, dataset Sanity, Stripe e Resend separati.
- Root/account Aruba separato o namespace con credenziali che non possono leggere produzione.
- Nessuna copia di produzione; soltanto dati sintetici o anonimizzati con procedura approvata.
- Stesse immagini e migrazioni destinate alla produzione.

### Produzione

- VPS e credenziali dedicate, raggiungibili soltanto dagli operatori autorizzati.
- Aruba Hosting come storage primario/gateway; AWS KMS e S3 in regione `eu-south-1` come key service e disaster copy.
- Nessuna condivisione di secret, rete applicativa, database, cache, queue o bucket con altri ambienti.

Staging non viene eseguito sulla VPS di produzione. Se l'ambiente separato non è disponibile, il rilascio di produzione è bloccato: non si crea uno staging parziale accanto ai dati reali.

## Componenti produzione

Container principali sulla VPS:

- reverse proxy/TLS;
- frontend app e Admin;
- API NestJS con almeno due repliche durante il deploy;
- Outbox Relay, scheduler e coordinatori;
- Email, Notification, Analytics, Cleanup e Storage Reconciliation Worker;
- quattro pool Preview separati;
- Key Broker;
- PostgreSQL e connection pooler;
- Redis e RabbitMQ;
- metriche, log, alert e health monitoring.

Sanity, Stripe, Resend, AWS KMS/S3 e Aruba sono dipendenze esterne dietro interfacce applicative. La topologia non cambia i confini di dominio.

## Artefatti

- ogni release deriva da un commit identificabile;
- immagini container immutabili referenziate per digest, non tag mobile;
- dipendenze e tool di conversione bloccati da lockfile/versione;
- SBOM, provenance, vulnerability scan e secret scan prodotti in CI;
- configurazione per ambiente separata dall'immagine e validata all'avvio;
- manifest unico elenca versioni app, schema, gateway PHP, worker, capability e policy compatibili;
- artefatti promossi da staging a produzione senza rebuild.

## Pipeline di rilascio VPS

1. gate CI e revisione completati;
2. deploy della release candidata in staging;
3. migrazione staging, smoke e scenari verticali;
4. verifica backup recente, capacità, code e stato dipendenze produzione;
5. migrazioni PostgreSQL `expand`, compatibili con release corrente e precedente;
6. avvio nuove repliche API e health/readiness check;
7. switch graduale del traffico e drain delle vecchie repliche;
8. rollout worker uno per volta con drain dei job attivi;
9. deploy frontend e smoke auth/upload/share/billing senza presumere esiti esterni;
10. osservazione metriche e error budget;
11. migrazioni `contract` distruttive soltanto in una release successiva, dopo che nessun codice precedente usa i campi.

Un deploy fallito torna al digest precedente. Non si usa rollback distruttivo del database: schema e codice devono consentire convivenza N/N-1. Feature flag server-side disattivano capacità incomplete senza lasciare controlli UI orfani.

## Gateway PHP Aruba

- release in directory versionate, separate da oggetti e sessioni tus;
- health check e capability probe prima dello switch atomico del router/entrypoint;
- protocollo e token versionati; gateway N e N-1 compatibili durante il drain;
- sessioni tus iniziate continuano o riprendono senza essere legate alla directory di release;
- rollback all'entrypoint precedente senza spostare file;
- nessuna modifica manuale in-place ai file della release attiva;
- verifica obbligatoria in staging di HEAD, PATCH, Range, header, timeout, OPcache e limiti PHP del piano Aruba.

## Key management

Provider MVP: AWS KMS nella regione Milano `eu-south-1`, dietro `KeyProvider`.

- una KMS key per ambiente, policy least privilege e encryption context non sensibile;
- API/Key Broker possono generare/aprire data key, non amministrare o cancellare la master key;
- amministrazione chiavi separata dal runtime e soggetta a doppia approvazione;
- rotazione abilitata e procedura di rewrap testata;
- audit KMS acquisito nell'audit staff/security;
- disabilitazione o cancellazione chiave con finestra di sicurezza, alert e runbook;
- nessun fallback silenzioso a chiave locale in produzione.

## Backup dati applicativi

Backup provider MVP: Amazon S3 privato in `eu-south-1`, dietro `BackupProvider`, block-public-access, TLS obbligatorio, versioning e policy least privilege.

PostgreSQL:

- full backup cifrato giornaliero;
- archiviazione WAL almeno ogni 15 minuti;
- retention mobile massima 30 giorni;
- backup catalogato con checksum, schema version e test di leggibilità;
- restore mensile automatico in ambiente isolato e restore completo trimestrale assistito.

Oggetti:

- dopo `commitWrite`, un job replica il ciphertext Aruba su S3 e verifica size/checksum;
- obiettivo RPO replica oggetti: massimo 1 ora;
- la replica corrente resta finché l'oggetto sorgente è attivo;
- versioni/snapshot di backup precedenti sono conservati al massimo 30 giorni;
- dopo purge, il tombstone pianifica la rimozione di tutte le copie entro 30 giorni, salvo legal hold;
- derivati rigenerabili possono avere priorità inferiore agli originali ma seguono lo stesso controllo di integrità quando replicati;
- Object Lock in governance per una finestra breve protegge da cancellazioni accidentali/ransomware senza superare la retention promessa;
- inventario giornaliero riconcilia PostgreSQL, Aruba e S3.

Le copie S3 contengono ciphertext applicativo; AWS non riceve DEK plaintext. Backup chiavi e dati hanno accessi e responsabilità separate.

## Failover e recovery

Obiettivi iniziali:

- RPO database: 15 minuti;
- RPO oggetti: 1 ora;
- RTO API/app per perdita VPS: 4 ore;
- RTO lettura/download da replica S3: 4 ore;
- RTO completo con upload nuovamente disponibile: 24 ore.

In indisponibilità Aruba, `StorageProvider` può usare la replica S3 in modalità read-only dopo un comando di failover con doppia approvazione. Nuovi upload e mutazioni storage restano sospesi finché non esiste un primario scrivibile; la UI comunica lo stato senza dichiarare upload riusciti.

Recovery da perdita VPS:

1. nuova VPS da infrastruttura/configurazione versionata;
2. ripristino secret/workload identity e accesso KMS;
3. restore PostgreSQL + WAL e verifica schema;
4. avvio queue/cache vuote e ricostruzione sicura da Outbox/PostgreSQL;
5. riconciliazione oggetti/tombstone;
6. smoke auth, autorizzazione, share, decrypt Range e billing webhook;
7. riapertura progressiva del traffico.

Redis e BullMQ non vengono ripristinati come fonte di verità. Job mancanti vengono ricostruiti da stato PostgreSQL; duplicati restano sicuri grazie all'idempotenza.

## Responsabilità operative

- Release Manager approva promozione e rollback applicativo.
- Database Operator approva migrazioni e restore.
- Security Operations amministra workload identity e coordina chiavi, senza accesso unilaterale a contenuti.
- Platform Operations gestisce VPS, Aruba, code, backup e riconciliazione.
- doppia approvazione per restore produzione, failover storage, chiavi master e modifiche retention.

Anche quando una sola persona ricopre piu funzioni nella fase iniziale, le azioni a doppio controllo non possono essere auto-approvate: richiedono un secondo account autorizzato.

## Gate di capacita e lancio

- staging separato operativo;
- benchmark VPS con API e worker preview entro i budget concordati;
- test upload tus 100 GB o limite massimo disponibile nell'ambiente di prova;
- test Range su oggetto cifrato e failover read-only S3;
- restore DB point-in-time e restore totale entro RTO;
- perdita simulata di Redis/RabbitMQ senza perdita di stato dominio;
- deploy N/N-1 e rollback gateway/API senza interrompere sessioni compatibili;
- verifica cancellazione/tombstone su Aruba, S3 e backup;
- monitoraggio costi S3/KMS e alert crescita anomala.
