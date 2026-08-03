# Regole operative email

Stato: approvato per MVP il 31 luglio 2026.

Il catalogo piani limita risorse prodotto, non autorizza campagne. I workspace possono inviare tramite PortfolioHub soltanto messaggi operativi relativi ad accesso, inviti, collaborazione, consegne, commenti, approvazioni e lifecycle. Marketing e newsletter del workspace non sono consentiti.

## Rate limit anti-abuso

Baseline iniziale per workspace su finestra mobile 24 ore:

- Free: massimo 100 destinatari operativi unici;
- Pro: massimo 1.000 destinatari operativi unici;
- Unlimited: massimo 5.000 destinatari operativi unici, soggetto a fair use;
- massimo 10 messaggi operativi allo stesso destinatario dallo stesso workspace;
- reinvio manuale dello stesso invito o consegna non prima di 5 minuti;
- massimo 30 richieste di invio al minuto per utente;
- bounce, complaint, indirizzi soppressi e tentativi duplicati non possono essere aggirati cambiando template.

Sono limiti di sicurezza/reputazione, non quote commerciali pubblicizzate. Possono essere ridotti per abuso o aumentati dopo review del caso, con motivo e audit. Il workspace puo sempre copiare un link gia creato se l'invio email è rate-limited; la creazione della consegna non viene annullata.

La UI mostra `Invio limitato`, il momento stimato di sblocco e l'azione Copia link. Non dichiara `Inviata` finche EmailProvider non ha accettato il messaggio.

## Massive PortfolioHub

Le comunicazioni PortfolioHub verso i propri utenti usano una pipeline separata da email transazionali e workspace:

1. segmento e base giuridica documentati;
2. template/versione/locali e link preferenze verificati;
3. test interno e rendering/accessibilita;
4. conteggio destinatari, stima suppression e approvazione di due operatori per invii oltre 1.000 destinatari;
5. canary all'1%, poi 5%, con osservazione bounce/complaint;
6. batch configurabili e kill switch;
7. stop automatico oltre soglie reputazionali definite con il provider;
8. report finale e audit.

Una comunicazione non puo essere marcata transazionale per aggirare consenso o unsubscribe. Marketing resta opt-in e inizialmente disattivato. Sicurezza, billing, cancellazione e modifiche contrattuali sostanziali usano la base appropriata e non contengono promozioni.

## Contenuto minimo

- identita PortfolioHub e workspace quando mittente operativo;
- motivo concreto del messaggio;
- CTA e URL sul dominio previsto, mai URL storage;
- scadenza quando esiste un token;
- contatto/supporto e preferenze dove applicabili;
- nessun corpo file, commento sensibile, password, token in chiaro persistito o dato di altri workspace.

## Deliverability e incidenti

- domini auth/mail/updates separati e allineamento SPF, DKIM e DMARC;
- suppression globale tecnica per hard bounce/complaint e feedback visibile;
- warm-up e aumento progressivo dei volumi;
- alert su accepted/delivered/bounce/complaint/failed per categoria;
- kill switch indipendente per workspace, massive e template compromesso;
- incidenti di phishing/token leakage revocano link, template e sessioni pertinenti.
