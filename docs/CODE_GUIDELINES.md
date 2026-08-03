# Linee guida del codice

Stato: operative dal 31 luglio 2026.

## Principi

- Il backend è organizzato per dominio NestJS. Controller sottili, regole nei service, persistenza dietro repository o adapter.
- I confini esterni usano i contratti in `apps/api/src/adapters/contracts.ts`; provider locali e cloud non devono cambiare il dominio.
- Ogni mutazione autenticata usa CSRF, validazione DTO e controllo esplicito di tenant/ruolo/ACL.
- Importi monetari e contatori commerciali non usano floating point per il calcolo. Storage e traffico sono registrati in byte interi; i GB mostrati sono il totale arrotondato per eccesso.
- Token pubblici e sessioni non vengono salvati in chiaro. Le risposte non espongono hash, chiavi, password o dettagli di altri workspace.
- File e versioni sono distinti: il File mantiene l'identità, ogni revisione crea una Versione immutabile.
- Link di consegna e inviti collaboratore sono flussi e autorizzazioni differenti.
- Nessun endpoint amministrativo impersona silenziosamente un utente. Le azioni staff richiedono ruolo, motivazione e audit separato.

## Frontend

- Angular standalone, stato condiviso limitato agli store `core`; stato di pagina vicino al componente.
- Ogni azione visibile deve avere un esito reale, uno stato loading/error e un percorso utilizzabile da tastiera.
- Dark e light mode usano gli stessi token; non introdurre colori isolati quando esiste una variabile globale.
- La shell resta responsive e la sidebar richiudibile. Le superfici pubbliche cliente/consegna non dipendono dalla shell autenticata.

## Formattazione e controlli automatici

Biome è la fonte di verità per TypeScript, JSON e regole statiche; Prettier completa HTML e SCSS Angular.

```sh
npm run check
npm run check:fix
npm run format:check
npm run typecheck
```

Gli script root coprono API, web e admin. `check:fix` applica soltanto correzioni meccaniche; una modifica di comportamento richiede sempre revisione esplicita.

## Definition of done

1. Il flusso parte da UI o API e raggiunge un risultato persistito.
2. Tenant isolation, ruolo, stato workspace e quote sono verificati lato server.
3. Retry e webhook sono idempotenti dove possono ripetersi.
4. Errori esterni diventano stati applicativi comprensibili e non falsi successi.
5. Le decisioni che cambiano contratto vengono aggiornate in `docs/`.
6. A fine blocco: Biome/Prettier, build delle tre app, build Docker e smoke health.

## Vincoli di dipendenza

- `identity`, `workspaces`, `projects`, `files`, `deliveries`, `client-portal`, `billing` e `lifecycle` sono domini; non importano componenti UI.
- `adapters` implementa provider sostituibili e non contiene regole di prodotto.
- `platform` contiene Redis/BullMQ e primitive infrastrutturali, non decisioni di autorizzazione.
- Il worker preview è un processo separato con concorrenza e rate limit propri; l'API non esegue conversioni pesanti.
- Le migration sono append-only dopo il rilascio. Non usare `synchronize` in alcun ambiente.
