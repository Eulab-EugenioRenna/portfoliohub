# Piano di implementazione e rilascio per vertical slice

Stato: approvato il 31 luglio 2026.

## Regole di avanzamento

- Ogni slice attraversa UI, API, dominio, autorizzazione, database, eventi/worker, audit, osservabilita e test.
- Una route o azione viene esposta soltanto quando il percorso ha un esito reale; feature flag server-side nascondono le slice incomplete.
- Ogni slice ha una demo ripetibile e una evidenza di accettazione.
- La slice successiva puo iniziare soltanto quando i contratti da cui dipende sono stabili; bug critici della slice corrente hanno precedenza.
- Local adapter consentiti in sviluppo, ma la slice non è pronta per MVP finche i contract test dell'adapter reale previsto non passano in staging.
- Il lancio pubblico avviene dopo l'intero MVP verticale, non dopo una singola slice.

## Slice 0 — Fondazione eseguibile

Consegna:

- monorepo Angular/NestJS, convenzioni moduli e design tokens;
- Docker Compose locale con PostgreSQL, Redis e RabbitMQ;
- migration framework, Outbox/Inbox, structured logging e correlation ID;
- shell app approvata: sidebar collassabile, dark/light, responsive, stati standard;
- CI con lint, typecheck, unit/integration e security scan;
- adapter Local per storage/key/backup/email/content/billing test.

Demo: avvio da repository pulito, health dashboard, shell responsive e un evento Outbox consumato idempotentemente.

Exit: setup documentato, migrazione vuota, nessun secret committato, test base verdi.

## Slice 1 — Identita e workspace

Consegna:

- signup email/password, verifica, login/logout, reset e session rotation;
- Google e magic link dietro provider auth;
- creazione workspace freelance/studio con un solo Owner;
- workspace switcher multi-membership;
- onboarding fake, dati effimeri, skip e riavvio da Aiuto;
- impostazioni account/sessioni e shell navigabile senza pagine orfane.

Demo: nuovo utente verificato crea entrambi i tipi di workspace, salta il tour e cambia workspace senza leakage.

Exit: auth/session/CSRF/tenant isolation E2E, email capture e audit sicurezza.

## Slice 2 — Primo valore: progetto, file, link

Consegna:

- progetto attivo, cartella root e File/versione minima;
- `StorageProvider`, tus gateway, quota riservata, resume e commit idempotente;
- cifratura chunked + Key Broker/KeyProvider;
- download autorizzato e share di consegna base;
- UI upload con progress, refresh/riselezione, Completato/Fallito;
- primo risultato utile: progetto + file + link cliente pronto.

Demo: upload reale interrotto/ripreso su Aruba, oggetto cifrato, link aperto e download corretto.

Exit: contract Aruba/KMS, Range/checksum, quota e anti-IDOR verdi.

## Slice 3 — Team e collaborazione

Consegna:

- membri, inviti account-bound, scadenza/accettazione/revoca;
- Owner/Admin/Editor/Uploader/Viewer/Guest;
- ACL workspace/progetto/cartella, inheritance e deny;
- link di collaborazione distinto da delivery;
- trasferimento Owner verificato;
- Cronologia attivita scoped.

Demo: studio invita collaboratore su cartella, prova accessi consentiti/negati e trasferisce ownership.

Exit: matrice RBAC/ACL e test cross-tenant completi.

## Slice 4 — Gestione file completa

Consegna:

- gerarchia cartelle, rename/move metadata, copy logico;
- versioni immutabili e selezione versione corrente;
- bulk selection e metadata essenziali;
- cestino 30 giorni, restore e purge asincrona;
- object reference counting, backup replica e reconciliation.

Demo: nuova versione, copy senza copia fisica, move, trash/restore e purge senza eliminare riferimenti attivi.

Exit: property test gerarchie/refcount e prova tombstone.

## Slice 5 — Preview e media

Consegna:

- coordinatore e quattro code/container preview;
- toolchain, capability manifest e sandbox;
- immagini/PSD/RAW, Office/PDF, ZIP, audio/video;
- player Range, token start/playback e poster/proxy;
- stati preview e fallback download;
- limiti conservativi CPU/RAM, backpressure e metriche.

Demo: corpus misto produce derivati; video seek funziona; zip bomb/parser timeout non degrada API.

Exit: contract immagini, failure/capacity e SLO preview verdi.

## Slice 6 — Consegna professionale

Consegna:

- snapshot immutabile file/cartelle/versioni;
- Draft/Active/Expired/Revoked;
- password, expiry, view-only/download e revoca;
- file singoli e ZIP gerarchico;
- limite download atomico con prenotazioni;
- commenti e approvazioni per versione;
- email invio/reinvio e notifiche essenziali.

Demo: consegna cartella, download singoli/ZIP, limite concorrente, commento/approvazione e revoca.

Exit: snapshot immutabile, contatori e retry/ZIP E2E.

## Slice 7 — Cliente globale e link avanzati

Consegna:

- record cliente per workspace e link personale stabile;
- identita cliente magic link/password;
- prova possesso e merge di link di provider differenti;
- vista aggregata senza leakage verso i workspace;
- one-shot con landing neutra e riscatto atomico;
- sessione one-shot 4 ore non persistente al refresh.

Demo: cliente unisce due studi, entrambi restano isolati; crawler non brucia one-shot e refresh chiude accesso.

Exit: privacy/tenant test e race one-shot/merge verdi.

## Slice 8 — Portfolio Basic

Consegna:

- editor tema Basic e sezioni previste;
- draft autosave, preview desktop/mobile e publish atomico;
- selezione esplicita versioni file senza duplicazione;
- `{slug}.portfoliohub.com`, reserved slug e CSP isolata;
- SEO, sitemap, social image e contatto antispam;
- statistiche essenziali e branding per piano.

Demo: workspace pubblica, aggiorna e ritira un portfolio; delivery/private files non selezionati restano invisibili.

Exit: snapshot/SEO/accessibilita/origin isolation verdi.

## Slice 9 — Piani, quote e Stripe

Consegna:

- catalogo Free/Pro/Unlimited e Trial 30 giorni;
- storage/traffic accounting e limiti file/progetto/membri;
- Checkout, coupon e Customer Portal;
- webhook firmati/idempotenti fonte di verita;
- upgrade/downgrade/cancel, grace insoluto e notifiche;
- blocco oltre Free, pagamento o wipe irreversibile;
- fair-use state e ricorso.

Demo: ciclo completo Stripe test con webhook duplicati/fuori ordine, quote immediate soltanto dopo evento valido e wipe confermato.

Exit: billing state machine, ledger quote e scenari E2E verdi.

## Slice 10 — Comunicazioni e audit

Consegna:

- EmailProvider Resend, template/versioni/locali, queue/retry/DLQ;
- mittenti separati, preference, unsubscribe, suppression e webhook;
- notification center in-app;
- Audit workspace Owner-only, Cronologia scoped e retention cleanup;
- export audit e rate limit comunicazioni.

Demo: invito/consegna/billing/security email con bounce/complaint; Admin non apre audit Owner.

Exit: idempotenza/suppression/retention e provider staging verdi.

## Slice 11 — Lifecycle, privacy e support

Consegna:

- quarantena Owner 30 giorni, reminder, recovery e purge;
- backup/tombstone/certificato cancellazione;
- privacy request ed export isolato;
- legal hold, abuse report, sospensione 7 giorni e ricorso;
- Admin globale, staff roles, Support Session e break-glass;
- audit staff e doppia approvazione.

Demo: cancellazione/ripristino/purge, richiesta privacy e support session read-only con revoca.

Exit: security/legal workflow, restore tombstone e double-control verdi.

## Slice 12 — Marketing, policy e readiness

Consegna:

- ContentProvider Sanity, cache e domini pubblici;
- Policy Publisher, versioni/acceptance e pagine legali;
- staging separato, CI/CD immutable, AWS KMS/S3 backup;
- dashboard SLO, alert, runbook, status e incident workflow;
- accessibility/browser/load/fault/penetration test;
- restore/failover e gateway rollback;
- revisione legale/fiscale e subprocessori.

Demo: release candidate promossa da staging, outage CMS innocuo, failover read-only, restore entro RTO e policy aggiornata con nuova prova.

Exit: tutti i gate di `TEST_STRATEGY.md`, `SECURITY_ARCHITECTURE.md`, `QUALITY_SLOS.md` e `DEPLOYMENT_AND_RECOVERY.md` in Pass.

## Lancio

1. beta privata con workspace selezionati e limiti controllati;
2. osservazione minima 14 giorni senza Critical/High e con error budget sano;
3. correzione blocker e nuova release candidate completa;
4. apertura pubblica Free/Trial/Pro/Unlimited;
5. review giornaliera prima settimana e settimanale primo mese.

Rollback di una feature usa flag soltanto se preserva dati e percorsi esistenti; billing, cancellazione, policy e security non vengono disattivati senza runbook e approvazione.
