# Matrice RBAC + ACL

Stato: approvato per MVP il 31 luglio 2026.

## Regole di valutazione

1. Ogni richiesta ha soggetto, workspace, azione e risorsa.
2. Il ruolo definisce il massimo teorico; l'ACL restringe lo scope effettivo.
3. Default deny: cio che non è concesso esplicitamente è negato.
4. Scope: workspace, progetto, cartella o File; eredita verso i discendenti.
5. Un deny esplicito piu specifico prevale su grant ed eredita.
6. Nessun ACL puo elevare oltre il ruolo.
7. Client e operatori staff non sono ruoli workspace e usano policy separate.
8. Il backend decide sempre; route nascoste e bottoni disabilitati non sono autorizzazione.

## Ruoli

### Owner

- unico per workspace e controllo completo;
- billing, piano, export Audit workspace, policy/DPA e impostazioni sicurezza;
- nomina/rimuove Admin e ogni ruolo inferiore;
- trasferisce ownership a membro verificato con riautenticazione;
- cancella workspace/account, avvia wipe e autorizza purge irreversibile;
- pubblica/revoca portfolio e consegne;
- crea Support Session.

### Admin

- gestisce clienti, progetti, cartelle, File, versioni, consegne, portfolio draft e operativita;
- invita, modifica e rimuove Editor, Uploader, Viewer e Guest;
- assegna ACL entro il workspace ma non puo concedere Admin/Owner;
- pubblica/revoca consegne e Portfolio;
- elimina risorse nel cestino e le ripristina, ma non forza purge irreversibile;
- non accede a billing, ownership, cancellazione workspace, Audit workspace, legal hold o Support Session.

### Editor

- su scope workspace puo creare progetti; su scope inferiore opera soltanto nei progetti assegnati;
- crea/modifica/sposta cartelle, File, metadata e versioni;
- elimina nel cestino e ripristina contenuti nel proprio scope, senza purge;
- crea/modifica consegne e portfolio draft usando contenuti autorizzati;
- non pubblica/revoca portfolio, non gestisce team/ACL/billing/audit;
- puo attivare/revocare le proprie consegne soltanto se una capability esplicita di progetto lo consente; per default serve Owner/Admin.

### Uploader

- crea cartelle, carica nuovi File e nuove versioni nello scope;
- legge e scarica i contenuti necessari nello scope;
- rinomina/sposta/elimina soltanto elementi creati da lui finche non sono in una consegna o pubblicati;
- non crea consegne, non approva, non gestisce clienti, ACL, team o Portfolio;
- non elimina o sostituisce contenuti altrui.

### Viewer

- elenca, apre, visualizza preview e scarica originali nello scope;
- vede la Cronologia attivita non riservata dello scope;
- non crea, commenta, approva, modifica o condivide.

### Guest

- collaboratore esterno autenticato, limitato a progetto/cartella e senza navigazione globale;
- vede preview e, se la capability dello scope lo permette, scarica;
- puo commentare nel contesto collaborativo assegnato;
- non vede clienti, team, billing, portfolio globale o altri progetti;
- non carica o modifica salvo assegnazione del ruolo Uploader al posto di Guest.

## Matrice sintetica

| Capacita | Owner | Admin | Editor | Uploader | Viewer | Guest |
|---|---:|---:|---:|---:|---:|---:|
| Billing/piano | Si | No | No | No | No | No |
| Audit workspace | Si | No | No | No | No | No |
| Trasferire/cancellare workspace | Si | No | No | No | No | No |
| Gestire Admin | Si | No | No | No | No | No |
| Gestire ruoli inferiori | Si | Si | No | No | No | No |
| Gestire ACL | Si | Si | No | No | No | No |
| Creare progetto | Si | Si | Si se scope workspace | No | No | No |
| Modificare contenuti nello scope | Si | Si | Si | Solo propri | No | No |
| Caricare/versionare | Si | Si | Si | Si | No | No |
| Leggere/scaricare | Si | Si | Si | Si | Si | Per capability |
| Commentare interno | Si | Si | Si | No | No | Si nello scope |
| Creare/modificare delivery draft | Si | Si | Si | No | No | No |
| Attivare/revocare delivery | Si | Si | Capability esplicita | No | No | No |
| Modificare Portfolio draft | Si | Si | Si nello scope | No | No | No |
| Pubblicare Portfolio | Si | Si | No | No | No | No |
| Trash/restore | Si | Si | Si nello scope | Solo propri non pubblicati | No | No |
| Purge irreversibile anticipata | Si | No | No | No | No | No |

## Capability contestuali

Le capability contestuali consentite nell'MVP sono soltanto restrizioni/abilitazioni nominate, non permessi arbitrari:

- `delivery.publish` per Editor su un progetto;
- `file.download` per Guest;
- `delivery.comment` e `delivery.approve` per Client nella singola consegna;
- `portfolio.contribute` per Editor, senza publish;
- `activity.read` nello scope.

Owner/Admin possono revocarle. Nessuna capability abilita billing, audit, ownership, gestione ruoli o purge.

## Ownership

- vincolo database: esattamente un membership Owner attivo per workspace;
- trasferimento in transazione serializzata: verifica destinatario, riautenticazione, promozione nuovo Owner e downgrade precedente a Admin nello stesso commit;
- impossibile rimuovere/degradare l'ultimo Owner senza trasferimento o avvio esplicito della cancellazione account/workspace;
- inviti non possono promettere Owner; la proprietà si trasferisce soltanto a un membro gia verificato;
- nessuna successione automatica per inattivita, ultimo Admin o fatturazione.

## Mutazioni autorizzative

- un operatore non puo elevare se stesso;
- Admin non puo modificare ruolo/scope di Owner o altri Admin;
- rimozione membro revoca sessioni workspace, inviti e grant futuri, senza alterare audit storico;
- cambio ruolo invalida cache autorizzazioni immediatamente e genera audit;
- operazioni bulk valutano ogni target e falliscono atomicamente oppure restituiscono esiti per-item espliciti, mai successo parziale nascosto.

## Test obbligatori

- matrice positiva e negativa per ogni cella;
- accesso cross-workspace e IDOR negato;
- inheritance, deny e cache invalidation;
- race trasferimento/rimozione ultimo Owner;
- link client/collaboration incapaci di diventare membership oltre scope;
- Admin incapace di audit, billing, owner e purge anche chiamando direttamente API.
