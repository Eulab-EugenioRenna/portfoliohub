# Confini CMS, applicazione e domini pubblici

Stato: approvato per MVP il 31 luglio 2026.

## Sanity CMS

Sanity contiene esclusivamente contenuti editoriali pubblici creati da PortfolioHub:

- homepage e pagine marketing;
- FAQ e documentazione utente;
- testi informativi dei piani, senza prezzi o entitlement autorevoli;
- release notes e comunicazioni prodotto pubbliche;
- bozze editoriali delle pagine legali prima della pubblicazione controllata.

Blog, marketplace temi e CMS avanzato sono post-MVP. Nessun dato di workspace, membro, cliente, progetto, file, consegna, commento, approvazione, portfolio utente, fattura, consenso o audit vive in Sanity.

## PostgreSQL applicativo

PostgreSQL è fonte di verità per identita, workspace, ruoli, ACL, clienti, progetti, File/versioni, consegne, Portfolio, catalogo piani, entitlement, quote, stato Stripe, notifiche, audit, consensi, policy pubblicate, riferimenti storage e lifecycle.

La UI non decide prezzo o capacita leggendo contenuti Sanity. Le pagine marketing interrogano il catalogo pubblico del backend per mostrare prezzi e limiti correnti.

## Policy Publisher

Le policy possono essere redatte in Sanity, ma la pubblicazione attraversa un flusso dedicato:

1. validazione di campi obbligatori, locale, versione, effective date e tipo di accettazione;
2. anteprima e approvazione da operatore autorizzato;
3. creazione atomica di uno snapshot HTML/testo immutabile in PostgreSQL con hash;
4. pubblicazione dello snapshot su pagina pubblica;
5. creazione delle richieste di presa visione o nuova accettazione quando necessarie;
6. conservazione delle versioni precedenti e delle relative prove.

Sanity non modifica retroattivamente uno snapshot pubblicato. Un aggiornamento crea una nuova versione. Se Sanity non è disponibile, le policy pubblicate continuano a essere servite da PostgreSQL/cache.

## Portfolio utente

Il Portfolio Basic è rendering applicativo di uno snapshot pubblicato dal workspace. Layout, tema, sezioni, progetti e versioni file selezionate appartengono al dominio Portfolio e non sono documenti Sanity. La pubblicazione è atomica e revocabile dall'app.

## Domini e isolamento

- `portfoliohub.com` e `www.portfoliohub.com`: marketing, FAQ, documentazione e policy pubbliche;
- `app.portfoliohub.com`: applicazione autenticata workspace/cliente;
- `api.portfoliohub.com`: API applicativa;
- `admin.portfoliohub.com`: Admin globale con autenticazione staff separata;
- `delivery.portfoliohub.com`: consegne e link pubblici/cliente;
- `{slug}.portfoliohub.com`: Portfolio Basic del workspace;
- domini tecnici dedicati per asset, status, auth ed email secondo necessita.

Slug riservati includono almeno `www`, `app`, `api`, `admin`, `delivery`, `auth`, `assets`, `static`, `status`, `help`, `docs`, `mail`, `updates`, `support`, `billing` e varianti di sistema. La validazione è case-insensitive e impedisce omografi/confusione dove tecnicamente possibile.

Cookie di sessione sono host-only con prefisso `__Host-` e non vengono condivisi con portfolio o delivery. Mutazioni richiedono CSRF token anche tra sottodomini same-site. Portfolio e contenuti utente applicano CSP separata e non possono eseguire script arbitrari.

## Dipendenze e cache

- contenuti Sanity acquisiti tramite adapter `ContentProvider` e pubblicati in cache/versione locale;
- rendering pubblico dalla piu recente versione valida, senza interrogare Sanity per ogni richiesta;
- webhook Sanity firmati con invalidazione idempotente;
- un errore CMS non impedisce auth, app, upload, download, delivery, billing o portfolio gia pubblicati;
- preview draft CMS accessibile soltanto agli operatori autorizzati e senza cookie condivisi con l'app cliente.
