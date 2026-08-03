# PortfolioHub Aruba Storage Gateway

Applicazione PHP senza dipendenze Composer da caricare su hosting Aruba. Riceve esclusivamente oggetti gia cifrati dalla VPS e li espone alla VPS con autenticazione HMAC, checksum SHA-256, letture HTTP Range e cancellazione batch firmata.

Requisiti: PHP 8.1 o superiore, HTTPS e Apache con `mod_rewrite`/`.htaccess` abilitato.

La procedura completa e in [`../../docs/ARUBA_GATEWAY_DEPLOYMENT.md`](../../docs/ARUBA_GATEWAY_DEPLOYMENT.md).
