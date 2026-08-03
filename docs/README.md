# Documentazione PortfolioHub

- [Linee guida del codice](./CODE_GUIDELINES.md)

Indice canonico dei requisiti, delle decisioni e dei contratti di implementazione.

## Prodotto e pianificazione

- [PRD completo](./PRD.md)
- [Mappa delle decisioni](./DECISION_MAP.md)
- [Linguaggio di dominio](./CONTEXT.md)
- [Task di implementazione](./IMPLEMENTATION_TASKS.md)
- [Piano di rilascio](./RELEASE_PLAN.md)

## Contratti tecnici

- [Matrice RBAC e ACL](./RBAC_MATRIX.md)
- [StorageProvider](./STORAGE_PROVIDER_CONTRACT.md)
- [Sicurezza e privacy](./SECURITY_ARCHITECTURE.md)
- [Admin globale](./ADMIN_OPERATIONS.md)
- [CMS e domini](./CONTENT_BOUNDARIES.md)
- [Email](./EMAIL_OPERATIONS.md)
- [Deploy e disaster recovery](./DEPLOYMENT_AND_RECOVERY.md)
- [Deploy gateway PHP Aruba](./ARUBA_GATEWAY_DEPLOYMENT.md)
- [SLO, accessibilita e compatibilita](./QUALITY_SLOS.md)
- [Test e criteri di accettazione](./TEST_STRATEGY.md)
- [Policy governance](./POLICY_GOVERNANCE.md)

Le decisioni chiuse sono trasformate in task verticali. Se un contratto cambia, vanno aggiornati nello stesso lavoro il PRD, la decision map e i test di accettazione interessati.

## Regole automatiche

Biome governa TypeScript, JavaScript, JSON e CSS; Prettier copre soltanto template Angular e SCSS. La regola Biome `useImportType` resta disabilitata perché le classi iniettate tramite decorator NestJS devono esistere anche a runtime.
