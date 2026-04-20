# Checklist verifica email e automazioni (Clerk, ngrok, Resend, Inngest)

Guida passo-passo per verificare in locale (o in staging) che webhook, Resend e job Inngest siano collegati correttamente. Complementare a [`EMAIL_LIFECYCLE.md`](EMAIL_LIFECYCLE.md) e al [`MASTER_TESTING_CHECKLIST.md`](MASTER_TESTING_CHECKLIST.md).

**Directory di lavoro:** sempre `easytrip-saas/` per i comandi `npm` e `npx prisma`.

---

## Prerequisiti comuni

| Cosa | Perché |
|------|--------|
| `npm run dev` | App Next su `http://localhost:3000` |
| `ngrok http 3000` (tunnel attivo) | Clerk deve raggiungere `https://TUO-DOMINIO.ngrok-free.app/api/webhooks/clerk` |
| Endpoint Clerk = URL ngrok + `/api/webhooks/clerk` | Vedi [Clerk Webhooks](https://dashboard.clerk.com) |
| `CLERK_WEBHOOK_SIGNING_SECRET` in `.env` | Stesso secret dell’endpoint in Clerk; riavvia `npm run dev` dopo modifiche |

---

## 1. Verifica consegna Clerk (HTTP 200 verso ngrok)

**Obiettivo:** confermare che Clerk invii davvero il payload alla tua app e che la risposta sia di successo.

1. Apri **Clerk Dashboard** → **Webhooks** → tab **Logs** (o **Message Logs**).
2. Clicca sull’evento **`user.created`** più recente (dopo una nuova iscrizione di test).
3. Cerca la sezione **Delivery**, **Attempts** o **HTTP** (nome dipende dalla UI):
   - **Risposta attesa:** codice **200** verso il tuo URL `https://....ngrok-free.app/api/webhooks/clerk`.
   - **503:** spesso `CLERK_WEBHOOK_SIGNING_SECRET` mancante o errato (vedi [`src/app/api/webhooks/clerk/route.ts`](../src/app/api/webhooks/clerk/route.ts)).
   - **400:** verifica firma webhook o body.

**Fatto:** segna completato quando vedi almeno un tentativo con **200**.

---

## 2. Verifica Resend (email reali, non solo log)

**Obiettivo:** le email partono da Resend e arrivano alla casella del cliente, non solo messaggi in console.

1. Apri il file **`.env`** nella cartella `easytrip-saas/` (non committare mai le chiavi).
2. Verifica che siano presenti e non commentate:
   - `RESEND_API_KEY=...`
   - `EMAIL_FROM=...` (formato tipo `Nome <email@dominioverificato.resend.dev>` — il dominio mittente deve essere consentito in [Resend Domains](https://resend.com/domains)).
3. Salva il file e **riavvia** `npm run dev`.
4. Esegui una **nuova registrazione** utente (o un utente mai visto dal webhook) per far scattare di nuovo `user.created`.
5. Controlla:
   - **Casella email** del cliente (anche cartella **Spam**).
   - **Dashboard Resend** → **Emails** / **Logs**: stato *delivered* o eventuali errori API.

**Senza** `RESEND_API_KEY` / `EMAIL_FROM`, in sviluppo l’app **logga** solo un messaggio tipo “Email transazionale (mock)” (vedi [`transactional.ts`](../src/lib/email/transactional.ts)) e **non** invia posta reale.

**Fatto:** segna completato quando ricevi almeno una email di benvenuto reale o vedi l’invio accettato in Resend.

---

## 3. Verifica database (WebhookDelivery e benvenuto)

**Obiettivo:** confermare che il backend abbia registrato l’evento e l’invio benvenuto.

1. Da `easytrip-saas/` esegui: `npx prisma studio` (si apre il browser, di solito `http://localhost:5555`).
2. Tabella **`WebhookDelivery`**:
   - Dopo un `user.created` processato con successo, cerca una riga con **`provider`** = `clerk` e un **`external_id`** (id univoco della consegna, es. header `svix-id`).
3. Tabella **`User`**, utente di test (es. email `tonypis0@libero.it`):
   - Campo **`welcome_email_sent_at`**: deve avere una **data/ora** dopo il primo invio benvenuto riuscito.

Se **`WebhookDelivery` è vuoto** ma i Log Clerk mostrano 200, controlla che **Prisma Studio** punti allo **stesso** database del `DATABASE_URL` usato da `npm run dev`.

**Fatto:** segna completato quando vedi almeno una riga `clerk` e `welcome_email_sent_at` valorizzato (dopo flusso reale).

---

## 4. Inngest Dev Server (itinerario, cron, nurture)

**Obiettivo:** job come generazione itinerario, promemoria pre-viaggio, post-trip, nurture, ecc. **non** girano solo con Next: serve il dev server Inngest collegato alla route `/api/inngest`.

1. Lascia **aperto** il terminale con `npm run dev`.
2. Apri un **secondo terminale** nella cartella `easytrip-saas/` ed esegui:

   ```bash
   npm run inngest:dev
   ```

   Equivale a: `npx inngest-cli@latest dev -u http://localhost:3000/api/inngest`.

3. Apri la dashboard Inngest locale (di solito **http://localhost:8288**) e verifica che le funzioni siano sincronizzate.

**Senza** questo comando, dopo il pagamento l’evento `trip/generate.requested` può restare in coda senza esecuzione locale.

**Fatto:** segna completato quando hai avviato almeno una volta `npm run inngest:dev` durante i test di itinerario/cron.

---

## 5. Percorso “come cliente” (es. tonypis0@libero.it)

**Obiettivo:** simulare un utente reale sulla stessa casella email per ricevere le stesse notifiche.

Esegui in ordine (con **ngrok** + **Clerk** configurati; **Resend** attivo per email vere; **Inngest dev** per itinerario e cron):

| Passo | Azione | Email / effetto atteso (vedi [`EMAIL_LIFECYCLE.md`](EMAIL_LIFECYCLE.md)) |
|-------|--------|------------------------------------------------------------------------|
| A | Registrazione con **tonypis0@libero.it** (account nuovo) | Benvenuto (webhook Clerk) |
| B | Crea un viaggio e completa **checkout Stripe** (test) | Pagamento ricevuto |
| C | Con Inngest dev attivo, attendi generazione | Itinerario pronto |
| D | **Privacy** → attiva opt-in **email marketing** | Abilita nurture D+3 / D+7 (richiede giorni e condizioni DB) |
| E | Test avanzati (opzionale) | Checkout scaduto (Stripe), pre-trip/post-trip/crediti (date e cron), referral, gruppo |

Controlla sempre **posta in arrivo e spam** su Libero.

**Fatto:** segna completato quando hai completato almeno i passi A–C per quella casella email (o documentato cosa manca, es. nurture in attesa di giorni).

---

## Riepilogo rapido

| Controllo | Dove |
|-----------|------|
| HTTP 200 su `user.created` | Clerk → Webhooks → Logs → dettaglio messaggio |
| Email inviate | Resend dashboard + inbox utente |
| Idempotenza Clerk | Prisma → `WebhookDelivery` (`provider` = `clerk`) |
| Benvenuto inviato | Prisma → `User.welcome_email_sent_at` |
| Job Inngest | Terminale `npm run inngest:dev` + dashboard `localhost:8288` |

Per Stripe in locale ricorda anche: `stripe listen --forward-to localhost:3000/api/webhooks/stripe` e `STRIPE_WEBHOOK_SECRET` allineato al `whsec_` della CLI (vedi [`MASTER_TESTING_CHECKLIST.md`](MASTER_TESTING_CHECKLIST.md)).
