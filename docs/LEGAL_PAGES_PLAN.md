# Piano pagine Termini e Privacy

Stato: bozze italiane complete integrate nell’app il 3 agosto 2026; revisione professionale e dati societari completi ancora necessari prima della pubblicazione efficace.

Questo piano traduce `POLICY_GOVERNANCE.md`, `PRD.md` e `SECURITY_ARCHITECTURE.md` nelle due prime pagine pubbliche del centro legale. I testi sono implementati in `apps/web/src/app/pages/legal-content.ts` e vengono mostrati quando il Policy Publisher non restituisce ancora una versione efficace. Non sostituiscono la revisione di un professionista legale e fiscale.

## Termini e condizioni

La pagina `/legal/terms` dovrà coprire:

1. identità del fornitore, destinatari e ambito del servizio;
2. account, workspace, ruoli e responsabilità degli utenti;
3. prova Pro di 30 giorni senza carta, disponibile una volta sul primo workspace, con passaggio a Free senza cancellazione automatica dei dati;
4. catalogo piani, rinnovi, upgrade, downgrade, cancellazione e rimborsi;
5. proprietà dei contenuti, licenze tecniche necessarie all’erogazione e consegne pubbliche;
6. acceptable/fair use, sospensione per cause definite, motivazione e ricorso;
7. disponibilità, responsabilità, recesso, legge applicabile e foro da definire in base ai mercati effettivi.

L’accettazione deve essere esplicita alla registrazione e nuovamente richiesta per modifiche materiali. Trial e checkout richiedono una prova separata delle condizioni di abbonamento.

## Privacy Policy

La pagina `/legal/privacy` dovrà coprire:

1. titolare, contatti privacy e ruoli titolare/responsabile per i dati dei workspace;
2. categorie di interessati e dati trattati;
3. finalità e basi giuridiche, distinguendo servizio, sicurezza, billing e marketing facoltativo;
4. destinatari, subprocessori, regioni e trasferimenti;
5. retention ordinarie, cestino e quarantena di 30 giorni, backup e conservazioni dedicate;
6. misure di sicurezza e gestione incidenti;
7. diritti, verifica dell’identità, export e termine ordinario massimo di un mese;
8. cookie strettamente necessari e rinvio al centro preferenze per categorie non essenziali.

La Privacy Policy è un’informativa: non va trasformata in un consenso generale. Marketing e cookie non necessari richiedono scelte separate, facoltative e inizialmente disattivate.

## Pubblicazione

Prima del lancio:

1. completare dati societari, mercati serviti, contatti legali/privacy, subprocessori e trasferimenti;
2. far redigere e revisionare i testi a un professionista;
3. confrontare ogni clausola con il comportamento reale del prodotto;
4. pubblicare snapshot immutabili con tipo, locale, versione, hash e data di efficacia;
5. testare link, accessibilità, storico versioni e prova di accettazione;
6. mantenere visibile lo stato “in revisione” finché il Policy Publisher non restituisce una versione efficace.
