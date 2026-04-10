# Clerk — impostazioni consigliate (least privilege & sessioni)

Questa app usa [`src/middleware.ts`](../src/middleware.ts) per proteggere `/app` e le API verificano l’utente lato server (`AuthService` / `currentUser()`). Le opzioni sotto si configurano nella **dashboard Clerk** (sicurezza, sessioni, MFA).

## Sessioni

- Impostare una **durata sessione** adeguata al rischio (più breve per account con dati sensibili).
- Abilitare **rotazione token** dove offerto da Clerk.
- Per ambienti condivisi, valutare timeout aggressivo o logout esplicito in UI.

## Least privilege (accesso minimo)

- Limitare i **permessi OAuth** dei provider social al minimo necessario.
- Se in futuro si usano **organizzazioni / ruoli Clerk**, mappare i ruoli alle azioni nel codice (organizzatore trip vs membro) e non esporre capability extra nel JWT.

## MFA

- Raccomandare o richiedere **MFA** per account con pagamenti o dati di viaggio, in linea con la valutazione del rischio aziendale.

## Allineamento con il codice

- Gli eventi Inngest per la generazione itinerario inviano solo `tripId` (nessun ID utente nel payload verso Inngest).
- Cancellazione account: [`POST /api/user/delete-account`](../src/app/api/user/delete-account/route.ts) dopo conferma; l’account Clerk viene rimosso al termine della catena Stripe → database.

Aggiornare questo documento quando cambiano provider di login o policy di sessione.
