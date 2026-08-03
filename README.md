# PortfolioHub

Piattaforma multi-tenant per collaborazione su file, consegne professionali ai clienti e Portfolio Basic.

## Documentazione

PRD, decisioni, contratti e linee guida sono indicizzati in [docs/README.md](./docs/README.md).

## Comandi di qualita

- `npm run check`: verifica formattazione e regole Biome su TypeScript, JavaScript, JSON e CSS.
- `npm run check:fix`: applica le correzioni sicure di Biome.
- `npm run format:check`: verifica anche template Angular e SCSS con Prettier.
- `npm run quality`: esegue Biome, typecheck e test.
- `npm run quality:ci`: variante CI senza scritture.

## UI approvata

Il prototipo visuale di riferimento è in [prototype-ui/index.html](./prototype-ui/index.html). È materiale di design, non codice di produzione.

## Avvio locale

Il backoffice e disponibile su `http://localhost:8081` con l'account di prova `admin@portfoliohub.test` e la password `change-this-local-admin-password`. Il gateway PHP da caricare su Aruba e le istruzioni di collegamento sono in [Deploy gateway PHP Aruba](./docs/ARUBA_GATEWAY_DEPLOYMENT.md).
