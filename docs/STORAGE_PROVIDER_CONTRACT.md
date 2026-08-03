# Contratto StorageProvider

Stato: approvato per MVP il 31 luglio 2026.

## Responsabilita del modulo

`StorageProvider` e l'unico confine attraverso cui l'applicazione accede ai byte. Nasconde filesystem, protocollo tus, path, URL e credenziali del provider. La logica di dominio conserva soltanto riferimenti opachi e non distingue Aruba, Local o adapter futuri.

Il provider gestisce:

- sessioni di scrittura resumable;
- verifica e consolidamento di un upload completato;
- accessi temporanei a download, preview e playback con Range;
- verifica tecnica degli oggetti;
- cancellazione fisica idempotente.

Il provider non decide autorizzazioni, quote, piani, ownership, retention o legal hold. Queste decisioni appartengono ai moduli applicativi e devono essere gia concluse prima della chiamata al provider.

## Invarianti

1. Un oggetto fisico e una sequenza immutabile di byte identificata da un `objectRef` opaco.
2. Nessun caller puo costruire, interpretare o persistere path e URL interni del provider.
3. Rename e Move sono modifiche dei metadata PostgreSQL e non fanno parte dell'interfaccia.
4. Copy crea un nuovo File logico che puo riferire lo stesso oggetto fisico; non esiste una copia storage.
5. Ogni nuova versione completata produce un nuovo oggetto fisico.
6. Il riuso dell'oggetto non riduce la quota commerciale: ogni File logico conta per la propria dimensione intera.
7. La cancellazione fisica viene richiesta solo dopo che il dominio ha escluso riferimenti attivi, consegne, portfolio pubblicati, cestino e legal hold.
8. Tutte le operazioni mutanti accettano una chiave di idempotenza e producono lo stesso esito se ripetute con lo stesso input.
9. Dimensione e checksum sono verificati al commit; un upload non verificato non diventa una versione disponibile.
10. Il browser usa esclusivamente grant temporanei emessi per una singola operazione e non riceve URL durevoli dello storage.

## Interfaccia minima

I nomi seguenti descrivono il contratto logico; la forma TypeScript definitiva verra fissata durante l'implementazione NestJS.

### `beginWrite(input): WriteGrant`

Avvia o recupera in modo idempotente una sessione di upload.

Input minimo:

- `workspaceId` e `uploadId` interni;
- dimensione attesa in byte interi;
- checksum e algoritmo attesi quando disponibili prima dell'upload;
- media type dichiarato e nome tecnico normalizzato;
- chiave di idempotenza;
- scadenza richiesta, massimo 12 ore dall'ultimo chunk.

Output minimo:

- `writeSessionRef` opaco;
- grant o endpoint temporaneo del gateway;
- offset corrente;
- scadenza;
- capability necessarie al client tus.

L'attivita su un chunk rinnova la scadenza. Il grant non implica che l'upload sia completato.

### `inspectWrite(writeSessionRef): WriteState`

Riconcilia lo stato tecnico dopo refresh, callback duplicata o errore di rete.

Restituisce almeno `Open`, `Uploaded`, `Committed`, `Failed` o `Expired`, offset ricevuto, dimensione attesa e scadenza. Gli stati intermedi restano tecnici: per l'utente l'upload termina soltanto in `Completato` o `Fallito`.

### `commitWrite(input): StoredObject`

Consolida una sessione completamente ricevuta e restituisce l'oggetto immutabile.

Il provider verifica sessione, dimensione esatta e checksum. Il commit e idempotente: callback e retry non possono creare piu oggetti per lo stesso upload. Il risultato contiene soltanto:

- `objectRef` opaco;
- dimensione esatta in byte;
- checksum verificato e algoritmo;
- media type tecnico rilevato o confermato;
- timestamp di consolidamento.

Un mismatch di integrita fallisce il commit e non rende il file disponibile.

### `grantRead(input): ReadGrant`

Crea un accesso temporaneo e ristretto a un oggetto gia autorizzato dall'applicazione.

L'input specifica `objectRef`, modalita (`Download`, `Preview`, `Playback`), metodi consentiti, eventuale filename di risposta, scadenza e chiave di idempotenza. Per playback sono ammessi `HEAD`, `GET` e `Range`; il grant resta vincolato alla stessa versione.

L'output e una credenziale o un endpoint temporaneo non durevole. Il provider non amplia scope e durata richiesti. Le durate applicative restano quelle definite nel PRD: 2 minuti per iniziare un download, 5 minuti per scambiare l'avvio video e playback pari alla durata del video piu 30 minuti, massimo 4 ore.

### `inspectObject(objectRef): ObjectStat`

Verifica l'esistenza e i metadata tecnici di un oggetto per riconciliazione, audit operativo e controlli di integrita. Restituisce dimensione e checksum reali senza esporre path o URL. Non viene usato per elencare gli oggetti del provider.

### `deleteObjects(input): DeletionReceipt`

Elimina fisicamente uno o piu oggetti dopo la decisione del dominio.

La cancellazione e batch, idempotente e considera gia eliminato un oggetto assente. La ricevuta distingue oggetti eliminati, gia assenti e falliti temporaneamente, cosi il worker puo ritentare soltanto i fallimenti. Il provider non esegue autonomamente garbage collection basata sui riferimenti di dominio.

## Capability obbligatorie e opzionali

Ogni adapter supporta le capability MVP:

- `ResumableWrite`;
- `RangedRead`;
- `ObjectStat`;
- `IdempotentDelete`.

Le capability vengono dichiarate all'avvio dell'applicazione. Se manca una capability obbligatoria, l'ambiente non e pronto e il servizio non accetta traffico. Multipart nativo, checksum calcolato dal provider, accelerazione CDN e lifecycle nativo sono ottimizzazioni opzionali interne all'adapter: non modificano il contratto del dominio.

## Errori normalizzati

L'interfaccia restituisce una tassonomia indipendente dal provider:

- `StorageUnavailable`: provider o gateway temporaneamente non disponibile;
- `StorageNotFound`: sessione o oggetto inesistente;
- `StorageExpired`: grant o sessione scaduti;
- `StorageConflict`: stessa idempotenza con input incompatibile o stato non valido;
- `StorageIntegrityMismatch`: dimensione o checksum non corrispondenti;
- `StorageCapacityExceeded`: limite fisico del provider, distinto dalla quota commerciale;
- `StorageUnauthorized`: credenziale tecnica assente o non valida;
- `StoragePermanentFailure`: errore non ritentabile non classificabile sopra.

Gli adapter conservano il dettaglio tecnico nei log strutturati, senza esporre path, segreti o risposte grezze del provider alla UI.

## Adapter

- `ArubaPhpProvider`: adapter di produzione MVP verso il gateway PHP/tus.
- `LocalProvider`: adapter filesystem per sviluppo e test contrattuali.
- `S3Provider`, `CloudflareR2Provider`, `MinioProvider`: adapter futuri, sostituibili senza cambiare i caller.

Tutti gli adapter devono superare la stessa suite di contract test. Un adapter puo implementare internamente operazioni differenti, purche preservi invarianti, risultati, idempotenza ed errori normalizzati.

## Flussi asincroni

Il commit applicativo registra in PostgreSQL la versione e il riferimento opaco; gli eventi successivi avviano preview e altre elaborazioni. La cancellazione fisica e affidata a un worker tramite Outbox, RabbitMQ e BullMQ, con retry e DLQ. PostgreSQL resta la fonte di verita; ne callback del gateway ne stato della coda rendono da soli disponibile o eliminato un File logico.
