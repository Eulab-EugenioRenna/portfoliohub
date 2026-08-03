# Task di implementazione

Aggiornato: 31 luglio 2026.

Stati: `[ ]` da iniziare, `[-]` in corso, `[x]` completato e verificato.

## Slice 0 — Fondazione

- [x] Inizializzare workspace Angular + NestJS e comandi root.
- [x] Configurare formattazione, lint, typecheck e test.
- [ ] Creare Docker Compose locale PostgreSQL/Redis/RabbitMQ.
- [ ] Definire config tipizzata e ambienti senza secret committati.
- [ ] Creare migration framework, Outbox/Inbox e correlation ID.
- [ ] Implementare adapter Local per storage/key/backup/email/content/billing.
- [ ] Trasformare il prototipo in shell Angular responsive e accessibile.
- [ ] Aggiungere stati loading/empty/error/blocked condivisi.
- [ ] Verificare avvio pulito, health e smoke UI.

## Slice 1 — Identita e workspace

- [ ] Auth email/password, verifica, login/logout e reset.
- [ ] Magic link e Google provider.
- [ ] Session rotation, device list e revoca.
- [ ] Workspace freelance/studio e switcher multi-workspace.
- [ ] Owner invariant e impostazioni account.
- [ ] Tour fake skippabile e riavviabile.
- [ ] E2E auth, CSRF e tenant isolation.

## Slice 2 — Primo progetto/file/link

- [ ] Progetto/cartella/File/versione base.
- [ ] Quota reservation e ledger byte interi.
- [ ] StorageProvider + gateway tus Aruba.
- [ ] Cifratura chunked, Key Broker e AWS KMS adapter.
- [ ] Resume refresh/riselezione e commit idempotente.
- [ ] Download/Range autorizzato.
- [ ] Delivery base e link pronto.
- [ ] E2E primo risultato utile su Aruba staging.

## Slice 3 — Team e ACL

- [ ] Membri/inviti/collaboration link.
- [ ] Ruoli e ACL gerarchici con deny.
- [ ] Trasferimento Owner serializzato.
- [ ] Cronologia attivita scoped.
- [ ] Matrice autorizzazioni e anti-IDOR.

## Slice 4 — File completi

- [ ] Gerarchia, rename/move e copy logico.
- [ ] Versioni immutabili e metadata.
- [ ] Bulk actions.
- [ ] Trash/restore/purge 30 giorni.
- [ ] Refcount, S3 backup e reconciliation.

## Slice 5 — Preview e media

- [ ] Coordinatore e quattro code BullMQ.
- [ ] Quattro immagini worker sandboxate.
- [ ] Capability manifest e corpus.
- [ ] Preview immagini/documenti/archivi/media.
- [ ] Player token/Range/seek.
- [ ] Backpressure e budget VPS.

## Slice 6 — Delivery professionale

- [ ] Snapshot file/cartelle/versioni.
- [ ] Lifecycle e policy delivery.
- [ ] ZIP gerarchico.
- [ ] Download limit atomico.
- [ ] Commenti/approvazioni versione.
- [ ] Email e notifiche delivery.

## Slice 7 — Cliente e link avanzati

- [ ] Identita cliente e link personale.
- [ ] Merge autenticato cross-provider.
- [ ] Vista aggregata isolata.
- [ ] One-shot e sessione pagina.

## Slice 8 — Portfolio Basic

- [ ] Editor tema/sezioni.
- [ ] Draft, preview e publish snapshot.
- [ ] Slug/domains/CSP.
- [ ] SEO, contatti e analytics base.
- [ ] Branding per piano.

## Slice 9 — Billing e quote

- [ ] Catalogo e entitlement.
- [ ] Trial e accounting traffico/storage.
- [ ] Stripe Checkout/Portal/webhook.
- [ ] Upgrade/downgrade/insoluto.
- [ ] Blocco Free oltre quota e wipe.
- [ ] Fair use e ricorso.

## Slice 10 — Comunicazioni e audit

- [ ] EmailProvider Resend completo.
- [ ] Preferenze, suppression e massive.
- [ ] Notification center.
- [ ] Audit Owner-only e cronologia.
- [ ] Retention/export/rate limit.

## Slice 11 — Lifecycle, privacy e Admin

- [ ] Quarantena, recovery e purge Owner.
- [ ] Tombstone e certificato cancellazione.
- [ ] Privacy requests e legal hold.
- [ ] Abuse/sospensione/ricorso.
- [ ] Admin globale e staff RBAC.
- [ ] Support Session e break-glass.

## Slice 12 — Readiness

- [ ] Sanity ContentProvider e Policy Publisher.
- [ ] Domini pubblici e pagine legali.
- [ ] CI/CD staging/production immutable.
- [ ] SLO, dashboard, alert e runbook.
- [ ] Security/WCAG/browser/load/DR gate.
- [ ] Revisione legale/fiscale finale.
- [ ] Beta privata 14 giorni e lancio.
