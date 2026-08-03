# Strategia di test e criteri di accettazione MVP

Stato: approvato il 31 luglio 2026.

## Principi

1. PostgreSQL è fonte di verita: i test verificano stato persistito, non soltanto risposta HTTP o coda.
2. Ogni porta sostituibile ha una suite contrattuale comune eseguita contro tutti gli adapter.
3. I flussi critici attraversano UI, API, autorizzazione, database, eventi, worker e provider fino all'esito osservabile.
4. Clock, ID e casualita sono controllabili nei test senza branch di produzione non verificati.
5. Retry, duplicati, timeout, callback fuori ordine e crash sono casi normali.
6. Nessun mock permanente, bottone inattivo o risposta finta è ammesso nel percorso MVP.

## Unit e domain test

- state machine di workspace, account, progetto, File/versione, upload, consegna, one-shot, portfolio, subscription, quota, email e cancellazione;
- RBAC + ACL, inheritance, deny esplicito e tenant isolation;
- byte interi, arrotondamento aggregato, traffico, download limit e prenotazioni concorrenti;
- token, trial, grace period, quarantena, trash e legal hold con clock fittizio;
- idempotency key, sequence aggregate e transizioni invalide;
- property-based test per Range/chunk, quote, gerarchie e combinazioni ruolo/scope.

## Contract test

Suite comune per:

- `StorageProvider`: Local, Aruba PHP e futuri S3/R2/Minio;
- `KeyProvider`: fake locale controllato e AWS KMS;
- `BackupProvider`: locale e S3;
- `EmailProvider`: capture/test e Resend;
- `BillingProvider`: Stripe test mode;
- `ContentProvider`: fixture e Sanity;
- provider auth/webhook verifier;
- immagini worker preview tramite capability manifest.

I contratti coprono successo, idempotenza, timeout, error mapping, retryability, scadenza, firma, duplicati, payload malformati e capability mancanti.

## Integration test

Stack reale effimero PostgreSQL, Redis e RabbitMQ:

- transazione + Outbox e publish at-least-once;
- consumer inbox/deduplica e replay DLQ;
- BullMQ ricostruibile da PostgreSQL;
- lock concorrenti per quota, download limit, one-shot e ownership;
- migrazioni su database vuoto e snapshot N-1;
- cleanup, trash, quarantena, tombstone e legal hold;
- cifratura chunked, corruzione tag, resume e mapping Range;
- backup/restore e riconciliazione storage.

## Component e UI test

- stati loading/empty/error/success/blocked per ogni pagina/dialog;
- sidebar, dark/light, responsive e navigazione tastiera;
- form, focus, annunci screen reader e re-auth;
- upload resumable dopo refresh/riselezione;
- client link, delivery, one-shot, ZIP, player, commento e approvazione;
- gating piano coerente con backend, senza controlli orfani;
- visual regression per shell, delivery, portfolio e temi approvati.

## End-to-end

Browser reale contro stack integrato. Scenari minimi:

1. signup/verifica, freelance o studio, skip tour e primo progetto/file/link;
2. invito collaboratore account-bound, ruolo/scope e revoca;
3. upload tus interrotto, refresh, resume, commit unico, preview e download;
4. cartella/versioni, consegna snapshot, file singoli e ZIP;
5. password/scadenza/view-only/download, limite concorrente e revoca;
6. video play, token start/playback, Range/seek e refresh;
7. one-shot non consumato da crawler, consumo atomico e sessione persa al refresh;
8. due link cliente di workspace diversi, merge autenticato senza leakage;
9. commento/approvazione di versione e notifiche;
10. Portfolio draft, preview, publish atomico, SEO/contatti e rollback;
11. Trial, checkout, webhook duplicato/fuori ordine, upgrade/downgrade/insoluto/Portal;
12. Free oltre quota, blocco totale, pagamento o wipe;
13. Owner transfer e cancellazione, quarantena, recovery e purge;
14. Support Session read-only, revoca e break-glass doppia approvazione;
15. privacy request, policy/acceptance, suppression email e legal hold.

Ogni scenario controlla audit, notifiche, quota, isolamento tenant e assenza di segreti nei log.

## Provider reali in staging

- Aruba: HEAD/PATCH tus, resume, timeout 12 ore, callback duplicata, Range, cifratura, file grandi e gateway N/N-1;
- AWS KMS: generate/decrypt/rewrap, encryption context, deny policy e key disabled;
- S3: replica, checksum, versioning, lifecycle, tombstone e failover read-only;
- Stripe: Checkout/Portal e webhook lifecycle, firma, duplicati e ordine invertito;
- Resend: domini, webhook, bounce/complaint/suppression e retry;
- Sanity: webhook, cache, outage e Policy Publisher.

Account e dataset staging sono separati e non contengono dati reali.

## Failure test

- kill API/worker durante commit, callback, ZIP, preview, email e purge;
- perdita temporanea di Postgres, Redis, RabbitMQ, Aruba, KMS, S3 e DNS;
- messaggi duplicati, ritardati, corrotti e fuori ordine;
- disco/temp pieno, soglie CPU/RAM e backpressure;
- file corrotto, checksum errato, zip bomb, parser hang e media ostile;
- clock skew, token appena scaduto e revoca durante sessione;
- restore da backup precedente con tombstone successivo;
- chiave disabilitata/ruotata e tag AEAD alterato.

Il sistema fallisce chiuso su autorizzazione e chiavi, preservando stato e feedback senza successo prematuro.

## Sicurezza, accessibilita e browser

- test anti-IDOR su ogni route con workspace/resource ID;
- CSRF, CORS, CSP, cookie, session fixation/reuse e open redirect;
- brute force/rate limit e anti-enumeration;
- secret/dependency/container/SAST scan, DAST e penetration test;
- verifica minimizzazione log, eventi, email e analytics;
- export/cancellazione/retention/legal hold senza leakage;
- axe senza critical/serious, keyboard/focus, VoiceOver/Safari e NVDA/Firefox;
- zoom/reflow, dark/light, reduced motion, contrasto e browser matrix;
- player, upload progress, tree, drag/drop e tabelle accessibili.

## Prestazioni e capacity

- load test separato per API, portfolio, delivery, auth e webhook;
- soak test 8 ore e burst su link/callback/aperture;
- upload/download 1 GB, 10 GB e prova dedicata fino a 100 GB;
- preview entro 30% CPU/25% RAM senza violare SLO interattivi;
- query plan/indici su dataset multi-tenant rappresentativo;
- growth test audit, notifiche, outbox, inbox e analytics.

## Migrazioni e release

- forward da N-1, nuova e vecchia app sullo schema expand;
- rollback digest senza rollback DB;
- migrazioni idempotenti dove previsto;
- backfill restartable, osservabile e rate-limited;
- restore backup e migrazione fino alla release target.

## Gate pull request

- lint/format/typecheck;
- unit/domain e contract;
- integration e migration test;
- scan secret/dipendenze/container;
- component test delle aree modificate;
- nessun test ignorato senza issue, owner e scadenza.

## Gate release candidate

- E2E critici e provider reali staging verdi;
- fault/security/WCAG/browser/load completati;
- backup/restore/failover provati;
- nessuna vulnerabilita Critical o High; Medium solo con risk acceptance e scadenza;
- zero migrazioni distruttive incompatibili;
- runbook, dashboard, alert, policy e rollback pronti;
- approvazione Standards, Spec, Security e Operations.

## Prova di completamento

Ogni requisito MVP mappa a requisito sorgente, scenario, test o procedura ripetibile, evidenza, owner e stato `Pass`, `Fail` o `Blocked`. L'implementazione senza evidenza non vale `Done`.
