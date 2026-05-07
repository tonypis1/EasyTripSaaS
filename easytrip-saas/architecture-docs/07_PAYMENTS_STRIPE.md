# 07 — Pagamenti: Stripe

| Documento | Percorso                                           |
| --------- | -------------------------------------------------- |
| Indice    | [README_00.md](../README_00.md)                    |
| API       | [04_API_SPECIFICATION.md](04_API_SPECIFICATION.md) |
| Deploy    | [12_DEPLOYMENT.md](12_DEPLOYMENT.md)               |

## 1. Libreria e configurazione

- SDK: `stripe` (package.json).
- Chiavi e prezzi: `src/config/unifiedConfig.ts` + variabili d’ambiente (vedi sezione 4).

## 2. Flussi Checkout

Implementazione in `src/server/services/billing/billingService.ts`:

| Flusso                | Endpoint API                            | Metadata tipici                                     |
| --------------------- | --------------------------------------- | --------------------------------------------------- |
| Acquisto viaggio      | `POST /api/billing/checkout`            | `tripId`, `appUserId`, importi, crediti applicabili |
| Rigenerazione extra   | `POST /api/billing/regen-checkout`      | `paymentType: regen`                                |
| Riattivazione accesso | `POST /api/billing/reactivate-checkout` | `paymentType: reactivate`                           |

Le sessioni usano `stripe.checkout.sessions.create` (modalità e line_items secondo implementazione corrente).

## 3. Webhook

- **Route**: `POST /api/webhooks/stripe`
- **Handler**: `BillingController.handleStripeWebhook` → `BillingService.handleStripeWebhook`
- **Body**: raw string (firma HMAC); `dynamic = "force-dynamic"`, `runtime = "nodejs"`.

### Eventi gestiti

| Evento Stripe                   | Azione                                                                                                                                                                                                                                                                         |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `checkout.session.completed`    | Idempotenza su `stripePaymentId`; ramo `purchase` (registra pagamento, `markAsPaid`, email, `trip/generate.requested` Inngest); ramo `regen` (pagamento + evento generazione); ramo `reactivate` (estensione accesso +30 giorni); applicazione crediti da metadata se presente |
| `customer.subscription.updated` | `syncSubscriptionPlanFromStripe`                                                                                                                                                                                                                                               |
| `customer.subscription.deleted` | `syncSubscriptionPlanFromStripe`                                                                                                                                                                                                                                               |

### Subscription opzionale

- Se `STRIPE_SUBSCRIPTION_PRICE_ID` è impostato e il prezzo del webhook corrisponde, il piano utente (`planType` / `subExpiresAt`) viene sincronizzato.

## 4. Variabili d’ambiente (billing)

| Variabile                        | Ruolo                                        | Default attuale |
| -------------------------------- | -------------------------------------------- | --------------- |
| `STRIPE_SECRET_KEY`              | API server                                   | —               |
| `STRIPE_WEBHOOK_SECRET`          | Verifica firma webhook                       | —               |
| `STRIPE_PRICE_SOLO_COUPLE_CENTS` | Prezzo base solo/coppia (centesimi) — €3,99  | `399`           |
| `STRIPE_PRICE_GROUP_CENTS`       | Prezzo gruppo (3–5 persone) — €6,99          | `699`           |
| `STRIPE_PRICE_REGEN_CENTS`       | Rigenerazione itinerario — €1,99             | `199`           |
| `STRIPE_PRICE_REACTIVATE_CENTS`  | Riattivazione accesso post-trip — €2,90      | `290`           |
| `STRIPE_PRICE_LOCALPASS_CENTS`   | Add-on LocalPass (per città) — €3,99         | `399`           |
| `STRIPE_SUBSCRIPTION_PRICE_ID`   | Opzionale — Viaggiatore Frequente €6,99/mese | —               |

> Nota subscription: il piano "Viaggiatore Frequente" (€6,99/mese) richiede la creazione manuale di un **Product + Price ricorrente** sulla Dashboard Stripe (Catalogo prodotti → Aggiungi prodotto, prezzo `6,99 EUR`, periodo `Mensile`). L'ID generato (`price_…`) va impostato in `STRIPE_SUBSCRIPTION_PRICE_ID`. Solo/Coppia e Gruppo, invece, usano `price_data` dinamico — niente da creare in Dashboard.

## 5. Modello dati

- `Payment`: collegamento a `User`, `Trip` opzionale, `type` (`purchase` | `regen` | `reactivate`), `stripePaymentId`.
- `Trip`: `paymentId`, `amountPaid`, stato `TripStatus`.

## 6. Referral post-acquisto

- Dopo `purchase` confermato, `referralService.tryGrantReward` (non bloccante).
- Reward attuale: **€3,99** in credito (= 1 trip Solo/Coppia gratis). Costante `REWARD_EUROS` in [`src/server/services/referral/referralService.ts`](../src/server/services/referral/referralService.ts). Mantenere allineata al prezzo base di un Trip Solo/Coppia.

## 7. Runbook — aggiornare i prezzi

### 7.1 Solo/Coppia e Gruppo (one-shot, `price_data` dinamico)

Nessuna creazione in Stripe Dashboard. Aggiornare:

1. Default in [`src/config/unifiedConfig.ts`](../src/config/unifiedConfig.ts) (righe `STRIPE_PRICE_*`).
2. `.env` locale e `.env.example`.
3. Variabili su Vercel → Settings → Environment Variables (per Production / Preview / Development):
   - `STRIPE_PRICE_SOLO_COUPLE_CENTS=399`
   - `STRIPE_PRICE_GROUP_CENTS=699`
4. Stringhe `priceDisplay` in `messages/{it,en,fr,de,es}.json` (chiavi `home.pricing.plans.solo|group|frequent.priceDisplay`).
5. Eventuali documenti markdown / HTML che citano default.
6. Redeploy.

### 7.2 Viaggiatore Frequente (subscription, `price_id` Stripe)

1. **Stripe Dashboard** → _Catalogo prodotti_ → _+ Aggiungi prodotto_.
2. Compilare:
   - **Nome**: `EasyTrip — Viaggiatore Frequente`
   - **Descrizione**: `Trip illimitati Solo/Coppia, fatturazione mensile`
3. Sezione _Prezzi_:
   - **Modello**: `Tariffa fissa standard`
   - **Prezzo**: `6,99 EUR`
   - **Periodo di fatturazione**: `Mensile`
4. Salvare. Copiare l'ID generato (formato `price_1ABC...xyz`).
5. Aggiornare `STRIPE_SUBSCRIPTION_PRICE_ID` su Vercel (e `.env` locale).
6. L'endpoint `POST /api/billing/subscribe` è abilitato automaticamente quando questa env è valorizzata: l'utente può abbonarsi dalla home (CTA "Viaggiatore Frequente"). Vedi sezione 9.

### 7.3 Verifica post-cambio

- `npm run typecheck` (no errori type).
- `npm run test:unit -- billing` (idempotenza webhook intatta).
- Test manuale Stripe test mode:
  1. Carta `4242 4242 4242 4242`, qualsiasi data futura, qualsiasi CVC.
  2. Verificare `Payment.amount` e `Trip.amountPaid` riflettano i nuovi importi.
  3. Verificare email transazionale di conferma e l'evento Inngest `trip/generate.requested`.
- Stripe Dashboard → _Developers_ → _Webhooks_ → _Send test webhook_ `checkout.session.completed`: deve restituire 2xx e creare un `Payment` (idempotente per `stripePaymentId`).

## 8. Promotion Code: sconto 20% "Nuovo viaggio"

### 8.1 Idea

L'utente che ha **appena completato un viaggio** (entro 7 giorni dalla data di fine) e torna sull'app per crearne un altro, vede uno sconto del **20% direttamente in checkout Stripe**. È una leva di retention basata sulla _peak-end rule_: il piacere del viaggio appena finito è ancora vivo, e uno sconto immediato spinge alla riprogettazione.

### 8.2 Eligibility (server-side, anti-manipolazione)

Implementata in [`billingService.ts`](../src/server/services/billing/billingService.ts) → `isEligibleForNewTripDiscount(userId, excludingTripId)`:

> L'utente ha **almeno un trip pagato** (`amountPaid != null`) il cui `endDate` cade nella finestra `[oggi − 7 giorni; oggi]` (e diverso dal trip attualmente in checkout).

Conseguenze:

- Trip finito ieri → sconto applicato.
- Trip finito 7 giorni fa → sconto applicato.
- Trip finito 8 giorni fa o più → **niente sconto**.
- Trip ancora in corso (`endDate > oggi`) o futuro → niente sconto (l'utente non ha ancora "vissuto" l'esperienza).
- Primo viaggio in assoluto → niente sconto.

Il check è **interamente server-side**: nessun parametro URL o cookie può forzare lo sconto.

### 8.3 Setup Stripe

1. **Stripe Dashboard** → _Catalogo prodotti_ → _Coupons_ → _+ Nuovo coupon_.
   - **Nome interno**: `easytrip-new-trip-20`
   - **Tipo**: `Percentuale di sconto`
   - **Sconto**: `20%`
   - **Durata**: `Una volta` (one-off)
2. Salvare → poi _Promotion codes_ → _+ Nuovo codice promozionale_ legato al coupon.
   - **Codice**: scegli quello che vuoi mostrare al cliente (es. `RITORNO20`).
   - **Limit per customer**: `Nessun limite` (l'eligibility è gestita da noi).
   - **Active**: `Sì`.
3. Copiare l'**ID del Promotion Code** (formato `promo_1ABC...xyz`, **non** il codice human-readable).
4. Inserire `STRIPE_PROMO_CODE_NEW_TRIP_ID=promo_...` su Vercel (Production + Preview) e `.env` locale.

### 8.4 Comportamento

- Quando `STRIPE_PROMO_CODE_NEW_TRIP_ID` è valorizzato e l'utente è eligible, l'app passa `discounts: [{ promotion_code: '<id>' }]` a `stripe.checkout.sessions.create`.
- Stripe applica il -20% sul `price_data.unit_amount`: l'utente vede il prezzo barrato e il prezzo scontato direttamente nella pagina di pagamento.
- `Payment.amount` (cents addebitati) registra l'importo netto effettivo. `Trip.amountPaid` riflette lo stesso valore.
- Se la env è vuota o l'utente non è eligible → nessun campo `discounts` viene incluso (Stripe non applica sconto).
- I metadata della sessione contengono `newTripDiscount: "1"` quando attivato (utile per analitiche).

### 8.5 Disabilitare lo sconto (rollback rapido)

- Su Vercel: rimuovere o svuotare `STRIPE_PROMO_CODE_NEW_TRIP_ID` → redeploy. Lo sconto si spegne immediatamente per tutti.
- In alternativa: disattivare il Promotion Code da Stripe Dashboard (più rapido se serve un kill-switch _senza_ redeploy). Il backend continuerà a passarlo a Stripe ma Stripe risponderà con un errore di validazione: per evitare 500 in checkout, **preferire** la disattivazione tramite env.

## 9. Endpoint subscription `POST /api/billing/subscribe`

### 9.1 Cosa fa

[`route.ts`](../src/app/api/billing/subscribe/route.ts) → [`BillingController.createSubscriptionCheckout`](../src/server/controllers/BillingController.ts) → [`BillingService.createSubscriptionCheckoutSession`](../src/server/services/billing/billingService.ts).

Crea una **Stripe Checkout Session** in `mode: 'subscription'` legata al Price ricorrente di `STRIPE_SUBSCRIPTION_PRICE_ID`. Risponde con `{ checkoutUrl, sessionId }`.

### 9.2 Flusso utente

#### Utente loggato (sulla home)

1. Click su CTA "Iniziamo subito" del piano _Viaggiatore Frequente_.
2. [`SubscribeCtaButton`](../src/components/home/subscribe-cta.tsx) → `fetch('/api/billing/subscribe', { method: 'POST' })`.
3. Risposta `{ data: { checkoutUrl } }` → `window.location.href = checkoutUrl`.
4. L'utente paga su Stripe → webhook `customer.subscription.created/updated` → `syncSubscriptionPlanFromStripe` aggiorna `User.planType = 'sub'` e `User.subExpiresAt`.

#### Utente non loggato (sulla home)

1. Click su CTA "Iniziamo subito" del piano _Viaggiatore Frequente_.
2. `SubscribeCtaButton` rileva `!isSignedIn` → apre Clerk SignUp con `redirectUrl=/{locale}/app/account/upgrade?plan=sub`.
3. Dopo signup Clerk reindirizza su [`/app/account/upgrade?plan=sub`](../src/app/%5Blocale%5D/app/account/upgrade/page.tsx) (server component).
4. La pagina chiama il `BillingService` server-side e fa `redirect()` a Stripe immediatamente. L'utente vede al massimo un brevissimo flash di pagina vuota, poi è su Stripe Checkout.
5. Se la creazione fallisce (env mancante, Stripe down, abbonamento già attivo) → la pagina mostra un fallback con CTA _Riprova_ / _Torna alla home_.

### 9.3 Errori gestiti

| Caso                                                     | HTTP | Codice                        | Messaggio                                         |
| -------------------------------------------------------- | ---- | ----------------------------- | ------------------------------------------------- |
| Body JSON malformato                                     | 400  | `INVALID_JSON`                | "Body JSON non valido"                            |
| `STRIPE_SUBSCRIPTION_PRICE_ID` non configurato           | 503  | `SUBSCRIPTION_NOT_CONFIGURED` | "Abbonamento non disponibile in questo ambiente." |
| L'utente ha già un piano `sub` con `subExpiresAt` futuro | 400  | `SUBSCRIPTION_ALREADY_ACTIVE` | "Hai già un abbonamento attivo."                  |
| Stripe restituisce session senza URL                     | 500  | `CHECKOUT_URL_MISSING`        | "Checkout URL non disponibile"                    |
| Utente non autenticato                                   | 401  | `UNAUTHORIZED`                | "Non autenticato" (dal middleware Clerk)          |

### 9.4 Webhook e idempotenza

- L'evento `checkout.session.completed` con `mode: 'subscription'` viene **skippato** dal fulfillment per-trip (non ha `tripId` nei metadata). Il piano si attiva solo quando arriva `customer.subscription.created/updated`. Vedi early-return in `fulfillCheckoutSessionCompleted`.
- Disdette: `customer.subscription.deleted` retrocede il piano a `free` mantenendo `subExpiresAt` (i giorni residui restano disponibili).

### 9.5 Verifica end-to-end (test mode)

1. Su Vercel test → impostare `STRIPE_SUBSCRIPTION_PRICE_ID` con un Price `recurring` di test.
2. Da home non-loggato → click CTA → completare signup Clerk.
3. Atterraggio su `/app/account/upgrade?plan=sub` → redirect a Stripe → carta `4242 4242 4242 4242`.
4. Verificare in Stripe Dashboard la subscription creata.
5. Verificare in DB `User.planType = 'sub'`, `User.subExpiresAt` ≈ +1 mese, `User.stripeCustomerId` valorizzato.
