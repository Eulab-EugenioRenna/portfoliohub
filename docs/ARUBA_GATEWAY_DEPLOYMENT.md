# Deploy del gateway storage PHP su Aruba

Il gateway pronto da caricare si trova in `apps/aruba-gateway`. Non usa Composer o database e richiede PHP 8.1+, HTTPS e supporto `.htaccess`/`mod_rewrite`.

## 1. Preparare il pacchetto

Nel repository eseguire:

```sh
npm run package:aruba
```

Viene creato `artifacts/portfoliohub-aruba-gateway.zip`. Estrarlo via File Manager o FTP in una directory dedicata del dominio, per esempio `public_html/portfoliohub-storage`.

## 2. Configurare Aruba

1. Duplicare `config.example.php` come `config.php`.
2. Generare un secret casuale di almeno 32 caratteri, per esempio con `openssl rand -hex 32` sulla VPS.
3. Impostare lo stesso `key_id` e secret che verranno configurati sulla VPS.
4. Impostare `storage_path` a una directory scrivibile, preferibilmente fuori da `public_html`. Se il piano non lo consente, usare una directory protetta da regole Apache e verificare che una richiesta HTTP diretta riceva `403`.
5. Assegnare alla directory storage i permessi minimi che consentono al processo PHP di scrivere; evitare `0777`.

Esempio `config.php`:

```php
<?php
return [
    'key_id' => 'portfoliohub-vps',
    'secret' => 'SECRET_CASUALE_CONDIVISO_CON_LA_VPS',
    'storage_path' => '/home/ACCOUNT/portfoliohub-private',
    'max_object_bytes' => 107374182400,
    'clock_skew_seconds' => 300,
    'max_batch_items' => 250,
];
```

`config.php` non deve essere caricato nel repository. Il `.htaccess` incluso ne blocca comunque l'accesso web e disabilita l'indice directory.
Su server che consentono variabili d'ambiente, `PORTFOLIOHUB_GATEWAY_CONFIG` può indicare un file di configurazione esterno alla directory pubblica.

## 3. Collegare la VPS

Nel file `.env` usato da Docker Compose impostare:

```dotenv
STORAGE_PROVIDER=aruba
ARUBA_GATEWAY_URL=https://files.example.it/portfoliohub-storage/
ARUBA_GATEWAY_KEY_ID=portfoliohub-vps
ARUBA_GATEWAY_SECRET=LO_STESSO_SECRET_DI_CONFIG_PHP
STORAGE_DELETE_BATCH_SIZE=250
STORAGE_WORKER_REPLICAS=2
FILE_FINALIZE_CONCURRENCY=4
COOKIE_SECURE=true
```

Quindi ricreare API e worker, perché entrambi usano `StorageProvider`:

```sh
docker compose up -d --build api preview-worker storage-worker
docker compose logs --tail=100 api preview-worker storage-worker
```

Il browser continua a usare gli endpoint resumable della VPS. Al completamento, un job in coda cifra il file sulla VPS e il provider selezionato trasferisce l'oggetto cifrato ad Aruba. Download e video vengono letti a intervalli tramite HTTP Range; Aruba non riceve chiavi di cifratura né credenziali utente.

## 4. Vincoli del piano Aruba

Prima della produzione verificare con un file grande che il piano consenta la dimensione richiesta per una singola richiesta `PUT`, il tempo massimo di esecuzione PHP e lo spazio disponibile. Il timeout applicativo VPS è 12 ore, ma un limite inferiore imposto dal piano o dal web server Aruba non può essere superato dal codice PHP. Se questi limiti interrompono il trasferimento, mantenere `STORAGE_PROVIDER=local` finché non viene abilitato un piano Aruba compatibile o un adapter a oggetti con multipart nativo.

Le scritture sono immutabili e idempotenti: ritentare lo stesso oggetto con stesso checksum è sicuro; una chiave già associata a byte differenti restituisce conflitto. La cancellazione batch usa `POST /v1/objects/batch-delete`, accetta al massimo `max_batch_items` riferimenti opachi ed è idempotente anche quando un oggetto è già assente. Le richieste firmate scadono dopo cinque minuti e ogni nonce può essere usato una sola volta.

## Credenziali backoffice locale

Con i valori predefiniti di Docker Compose:

```text
URL: http://localhost:8081
Email: admin@portfoliohub.test
Password: change-this-local-admin-password
```

Le credenziali sono soltanto per prova locale. In produzione impostare valori diversi in `.env`, usare HTTPS e lasciare `COOKIE_SECURE=true`.
