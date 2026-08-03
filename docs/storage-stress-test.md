# Stress test storage

## Scopo

Il test riproduce in loop un ciclo completo e mutante su un account e un progetto tecnici isolati:

1. apertura della sessione di upload;
2. invio dei byte e attesa della finalizzazione asincrona;
3. download a freddo e a caldo, con confronto byte-per-byte;
4. rinomina;
5. spostamento nel cestino;
6. svuotamento del cestino al termine di ogni ondata;
7. controllo di salute, connessioni PostgreSQL, CPU e memoria dei container.

Il progetto viene svuotato prima e dopo il test. Il report JSON è scritto nella directory temporanea del sistema con permessi `0600`.

## Sicurezza ed esecuzione

Il comando rifiuta per default sia le mutazioni sia i target remoti:

```bash
STRESS_ALLOW_MUTATIONS=true npm run stress:storage
```

Configurazione disponibile:

| Variabile | Default | Significato |
| --- | ---: | --- |
| `STRESS_LEVELS` | `1,2,4,8,16,32` | Ondate di concorrenza |
| `STRESS_ITERATIONS` | `1` | Cicli per utente virtuale |
| `STRESS_FILE_BYTES` | `262144` | Dimensione di ogni file |
| `STRESS_FINALIZE_TIMEOUT_MS` | `43200000` | Timeout finalizzazione (12 ore) |
| `STRESS_READ_P95_MS` | `120000` per file >= 100 MiB | Soglia lettura p95 |
| `STRESS_STOP_ON_FAIL` | `true` | Ferma la rampa alla prima soglia fallita |
| `STRESS_MONITOR_DOCKER` | `true` in locale | Campiona i container |
| `STRESS_REPORT_PATH` | directory temporanea | Percorso del report JSON |
| `STRESS_ALLOW_REMOTE` | `false` | Deve essere esplicito per un target non locale |

Un target remoto deve essere uno staging dedicato. Il test cancella realmente i file creati e non deve essere puntato al workspace di un cliente.

## Soglie

- lettura p95: massimo 2 secondi;
- mutazioni metadata p95: massimo 1,5 secondi;
- finalizzazione upload p95: massimo 5 secondi;
- svuotamento p95: massimo 5 secondi;
- zero errori e readiness sempre operativa.

Lo svuotamento è misurato separatamente dalle rinomine e dalle altre mutazioni: è un'operazione batch e non deve falsare la latenza delle normali API metadata.

## Baseline locale del 2 agosto 2026

Ambiente: stack Docker locale, file casuali da 256 KiB, un ciclo per connessione, monitor risorse attivo.

| Connessioni | Esito soglie | Read p95 | Metadata p95 | Finalizzazione p95 | Svuota p95 | Errori |
| ---: | :---: | ---: | ---: | ---: | ---: | ---: |
| 16 | sì | 784 ms | 63 ms | 4,01 s | 1,36 s | 0 |
| 32 | no | 483 ms | 103 ms | 5,39 s | 2,91 s | 0 |
| 64 | no | 658 ms | 214 ms | 18,21 s | 6,32 s | 0 |
| 128 | no | 512 ms | 346 ms | 23,88 s | 13,62 s | 0 |

Conclusione: la capacità nominale osservata è **16 cicli storage simultanei**. Il sistema ha accettato almeno 128 cicli senza errori e mantenendo la readiness, ma oltre 16 la latenza della finalizzazione non rispetta l'obiettivo. Questo non equivale a 16 utenti collegati: un utente che naviga senza trasferire file genera un carico molto inferiore.

Picchi osservati:

| Servizio | 16 connessioni | 128 connessioni |
| --- | ---: | ---: |
| API CPU | 56% | 121% |
| API memoria | 114 MiB | 165 MiB |
| PostgreSQL CPU | 8% | 39% |
| Redis CPU | 1% | 2% |
| RabbitMQ CPU | 1% | 95% |
| Worker anteprime CPU | <1% | 1% |

PostgreSQL, Redis e worker anteprime non sono il primo limite. Il collo principale è la finalizzazione, eseguita nell'API con concorrenza BullMQ pari a 1; ad alto carico emerge anche la pressione degli eventi su RabbitMQ. Lo svuotamento cresce quasi linearmente perché elimina le radici in sequenza e risponde solo al termine.

Le risposte download non espongono `Cache-Control`, `Age` o `X-Cache`. La lettura calda non mostra un vantaggio stabile, quindi non è presente una cache HTTP misurabile. Per i file cifrati e autenticati è preferibile non memorizzare plaintext in cache condivise; eventuali ottimizzazioni devono agire sullo storage cifrato, sui range e sui metadata.

## Verifica Aruba e file da 300 MB del 2 agosto 2026

Ambiente: stack Docker locale collegato al gateway PHP Aruba reale, due worker storage,
concorrenza di finalizzazione complessiva pari a 8, cache VPS limitata a 40 GiB contenente
soltanto oggetti gia cifrati.

| Cicli simultanei | Cicli completi | Read p95 | Metadata p95 | Finalizzazione p95 | Svuota p95 | Esito |
| ---: | ---: | ---: | ---: | ---: | ---: | :---: |
| 1 | 1/1 | 1,56 s | 13 ms | 20,27 s | 7 ms | Pass |
| 10 | 10/10 | 3,43 s | 136 ms | 123,88 s | 4 ms | Pass |
| 100 | 99/100 | 6,48 s | 1,27 s | 955,23 s | 7 ms | Bloccato dal limite slot |

Nell'ondata 100, tutti i 99 cicli ammessi hanno completato upload da 300 MB, due download
integrali con verifica SHA-256, rename, cestino e cancellazione batch. L'unico ciclo non
ammesso ha ricevuto `429`: l'account tecnico aveva gia una sessione `pending` valida e
riprendibile, quindi dei 100 slot configurati ne restavano 99. Il runner in precedenza
riportava due errori per lo stesso evento (richiesta e ciclo); ora espone separatamente
`errors` e `failedRequests`.

La prova esatta 100/100 deve essere ripetuta con un account tecnico pulito. Il secondo run
era pronto, ma non e partito per il blocco delle autorizzazioni locali; non ha trasferito
byte e non costituisce evidenza di carico.

Picchi misurati nell'ondata 99×300 MB effettiva:

| Servizio | CPU massima | Memoria massima |
| --- | ---: | ---: |
| API | 214% | 355 MiB |
| Storage worker 1 | 208% | 323 MiB |
| Storage worker 2 | 188% | 372 MiB |
| PostgreSQL | 12% | 55 MiB |
| Redis | 2% | 8 MiB |
| RabbitMQ | 120% | 118 MiB |

La readiness finale ha risposto in 2 ms e PostgreSQL usava 5 connessioni. Non sono emersi
colli di bottiglia di memoria, pool DB o Redis. Il limite dominante e la banda esterna di
finalizzazione verso Aruba; viene assorbito dalla coda senza occupare le connessioni DB.

Prima della cache cifrata, il singolo file da 300 MB richiedeva circa 105 s alla prima
lettura e 159 s alla seconda. Dopo la cache, la stessa prova richiede circa 1,5 s. La cache
non conserva plaintext, usa letture Range a frame da 8 MiB, applica backpressure HTTP e
rimuove l'oggetto quando il file viene eliminato.

## Miglioramenti implementati

1. Finalizzazione spostata su due worker dedicati, separati dall'API, con concorrenza totale 8.
2. Coda PostgreSQL con lease, retry finiti, recovery e assegnazione per minor carico account;
   a parita usa ordine FIFO e `SKIP LOCKED`.
3. Limiti atomici e configurabili per account e IP; le sessioni scadute non consumano slot.
4. `Svuota cestino` asincrono e cancellazione storage batch tramite gateway PHP.
5. Cache LRU limitata di soli oggetti cifrati sul volume VPS condiviso da API e worker.
6. Proxy Nginx configurabile a 101 GiB e timeout read/send di 12 ore.
7. Download e video a Range con decifratura AEAD a frame da 8 MiB e backpressure.

## Miglioramenti prioritari storici

I punti 1, 2 e 5 della lista originaria sono stati implementati. Restano:

3. Aggiungere metriche per profondità/tempo in coda, durata cifratura, storage put/read/delete, lag outbox/RabbitMQ, pool PostgreSQL e codici HTTP. Applicare backpressure prima del timeout.
4. Accorpare gli eventi ripetitivi prodotti dai batch e dimensionare RabbitMQ: a 128 cicli raggiunge il 95% CPU, pur non essendo il primo limite a carico nominale.
6. Ripetere lo stesso test su staging con gateway Aruba, dimensioni rappresentative e una prova soak. I risultati locali da 256 KiB non stimano upload da 50/100 GB, latenza WAN o capacità del provider.

## Regressione funzionale trovata dal test

La prima esecuzione ha rilevato un `500` sul cestino: gli ID custom BullMQ contenevano il separatore riservato `:` dopo che il database era già stato aggiornato. Gli ID di job sono ora generati da un unico contratto colon-free e riutilizzati sia in `add` sia in `remove`, inclusi cestino, anteprime, privacy e cancellazione account.
