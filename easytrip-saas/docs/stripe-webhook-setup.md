# Stripe + webhook EasyTrip — guida passo passo

Questo progetto **ha già il codice** per checkout e webhook. Devi solo configurare Stripe e le variabili d’ambiente.

## Mappa file (cosa fa cosa)

| File                                            | Ruolo                                                                                 |
| ----------------------------------------------- | ------------------------------------------------------------------------------------- |
| `src/app/api/billing/checkout/route.ts`         | `POST` → crea una **Stripe Checkout Session** (pagina pagamento Stripe).              |
| `src/app/api/webhooks/stripe/route.ts`          | `POST` → endpoint che **Stripe chiama** dopo il pagamento (firma verificata).         |
| `src/server/controllers/BillingController.ts`   | Legge body/headers e delega al servizio.                                              |
| `src/server/services/billing/billingService.ts` | Logica: `createCheckoutSession` + `handleStripeWebhook` (pagamento, DB, **Inngest**). |
| `src/lib/billing/stripe.ts`                     | Istanza SDK Stripe con la secret key.                                                 |
| `src/config/unifiedConfig.ts`                   | Legge `STRIPE_*`, `APP_BASE_URL` da `process.env`.                                    |

### Flusso dopo un pagamento riuscito

1. L’utente paga su Stripe Checkout.
2. Stripe invia l’evento `checkout.session.completed` al tuo URL webhook.
3. `handleStripeWebhook` verifica la firma (`STRIPE_WEBHOOK_SECRET`).
4. Scrive una riga in **Payment**, aggiorna il **Trip** (`paymentId`, `amountPaid`).
5. Invia l’evento **`trip/generate.requested`** a **Inngest** (come il pulsante dev).
6. La funzione `generate-itinerary` genera versione + giorni (stub o AI).

---

## 1. Variabili d’ambiente (`.env`)

In `easytrip-saas/.env` servono almeno:

```env
APP_BASE_URL="http://localhost:3000"

STRIPE_SECRET_KEY="sk_test_..."
STRIPE_WEBHOOK_SECRET="whsec_..."
```

- **`APP_BASE_URL`**: base URL dell’app (dopo il pagamento Stripe reindirizza qui). In locale: `http://localhost:3000`. In produzione (Vercel attuale): `https://easytripsaas.vercel.app`. Con dominio proprio: vedi [CUSTOM_DOMAIN.md](./CUSTOM_DOMAIN.md).

- **`STRIPE_SECRET_KEY`**: Dashboard Stripe → **Developers → API keys** → _Secret key_ (test o live).

- **`STRIPE_WEBHOOK_SECRET`**: dipende da come ricevi i webhook (vedi sotto: CLI locale vs Dashboard produzione).

Opzionali (già in `unifiedConfig`):

- `STRIPE_PRICE_SOLO_COUPLE_CENTS` (default `999`)
- `STRIPE_PRICE_GROUP_CENTS` (default `1499`)

`NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` è utile se un giorno usi Stripe.js in pagina; per il redirect a Checkout non è obbligatoria per questo flusso.

---

## 2. Test in locale con Stripe CLI (consigliato)

Stripe non può raggiungere `localhost` senza un tunnel. Il metodo ufficiale è **Stripe CLI**.

1. Installa [Stripe CLI](https://stripe.com/docs/stripe-cli).
2. Login: `stripe login`
3. In un **terzo** terminale (oltre a `npm run dev` e opzionalmente `npm run inngest:dev`):

   ```bash
   stripe listen --forward-to localhost:3000/api/webhooks/stripe
   ```

4. Il comando stampa un **webhook signing secret** tipo `whsec_...`. Copialo in `.env` come **`STRIPE_WEBHOOK_SECRET`** (è diverso dal secret creato a mano nel Dashboard per un URL pubblico).

5. Avvia l’app: `npm run dev`.

6. In app: apri un viaggio → **Vai al pagamento** → usa una [carta di test](https://stripe.com/docs/testing) (es. `4242 4242 4242 4242`).

7. Dopo il pagamento, nel terminale di `stripe listen` vedi l’evento; nel DB il trip risulta pagato e Inngest riceve `trip/generate.requested` (se hai Inngest dev attivo, parte la generazione).

---

## 3. Produzione (Deploy)

1. Deploy dell’app (es. Vercel) con URL pubblico `https://easytripsaas.vercel.app` (o il dominio collegato in Vercel).
2. Imposta `APP_BASE_URL` e `STRIPE_SECRET_KEY` (live se vai in produzione).
3. Stripe Dashboard → **Developers → Webhooks** → **Add endpoint**
   - URL: `https://easytripsaas.vercel.app/api/webhooks/stripe` (aggiorna se usi un dominio personalizzato; vedi [CUSTOM_DOMAIN.md](./CUSTOM_DOMAIN.md))
   - Evento da ascoltare: **`checkout.session.completed`**
4. Copia il **Signing secret** dell’endpoint e mettilo in `STRIPE_WEBHOOK_SECRET` sul hosting (non usare il secret del `stripe listen` di test).

---

## 4. Cose da controllare se “non succede nulla”

| Problema                                                  | Cosa verificare                                                                                                                                                                                                                                                          |
| --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 401 / firma non valida                                    | `STRIPE_WEBHOOK_SECRET` deve corrispondere a **questo** ambiente (CLI `listen` vs Dashboard endpoint).                                                                                                                                                                   |
| Metadata mancanti                                         | Il checkout è creato solo da `createCheckoutSession` (include `tripId`, `appUserId` nei metadata).                                                                                                                                                                       |
| Pagamento ok ma niente generazione                        | Inngest: in locale serve `npm run inngest:dev`; in cloud l’app deve essere collegata a Inngest con lo stesso evento.                                                                                                                                                     |
| Redirect sbagliato dopo pagamento                         | `APP_BASE_URL` errato o non impostato.                                                                                                                                                                                                                                   |
| Stripe Checkout: _«token di conferma» / rifare login CLI_ | La sessione **Stripe CLI** è scaduta. Chiudi `stripe listen`, esegui di nuovo `stripe login` (o `stripe login --interactive`), poi rilancia `stripe listen --forward-to ...`. Aggiorna `STRIPE_WEBHOOK_SECRET` se `listen` stampa un `whsec_` nuovo.                     |
| Inngest run **Failed** dopo ~2 min (Claude)               | Di solito **timeout** sulla singola richiesta verso Next: assicurati di avere l’ultima `generate-itinerary` con **`step.run`** e `timeouts.finish` lunghi; riavvia `npm run dev` e `npm run inngest:dev`. In alternativa imposta `ANTHROPIC_MODEL` esplicito nel `.env`. |

---

## 5. Sicurezza

- Non committare `.env`.
- Il webhook **non** usa Clerk: l’autenticità è la **firma Stripe** (`stripe-signature` + `STRIPE_WEBHOOK_SECRET`).
- I metadata (`tripId`, `appUserId`) sono stati impostati dal **tuo** server al momento della creazione sessione → considerali attendibili solo dopo `constructEvent` riuscito.
