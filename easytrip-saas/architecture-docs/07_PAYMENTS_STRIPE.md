# 07 — Pagamenti: Stripe

| Documento | Percorso |
|-----------|----------|
| Indice | [README_00.md](../README_00.md) |
| API | [04_API_SPECIFICATION.md](04_API_SPECIFICATION.md) |
| Deploy | [12_DEPLOYMENT.md](12_DEPLOYMENT.md) |

## 1. Libreria e configurazione

- SDK: `stripe` (package.json).
- Chiavi e prezzi: `src/config/unifiedConfig.ts` + variabili d’ambiente (vedi sezione 4).

## 2. Flussi Checkout

Implementazione in `src/server/services/billing/billingService.ts`:

| Flusso | Endpoint API | Metadata tipici |
|--------|--------------|-----------------|
| Acquisto viaggio | `POST /api/billing/checkout` | `tripId`, `appUserId`, importi, crediti applicabili |
| Rigenerazione extra | `POST /api/billing/regen-checkout` | `paymentType: regen` |
| Riattivazione accesso | `POST /api/billing/reactivate-checkout` | `paymentType: reactivate` |

Le sessioni usano `stripe.checkout.sessions.create` (modalità e line_items secondo implementazione corrente).

## 3. Webhook

- **Route**: `POST /api/webhooks/stripe`
- **Handler**: `BillingController.handleStripeWebhook` → `BillingService.handleStripeWebhook`
- **Body**: raw string (firma HMAC); `dynamic = "force-dynamic"`, `runtime = "nodejs"`.

### Eventi gestiti

| Evento Stripe | Azione |
|---------------|--------|
| `checkout.session.completed` | Idempotenza su `stripePaymentId`; ramo `purchase` (registra pagamento, `markAsPaid`, email, `trip/generate.requested` Inngest); ramo `regen` (pagamento + evento generazione); ramo `reactivate` (estensione accesso +30 giorni); applicazione crediti da metadata se presente |
| `customer.subscription.updated` | `syncSubscriptionPlanFromStripe` |
| `customer.subscription.deleted` | `syncSubscriptionPlanFromStripe` |

### Subscription opzionale

- Se `STRIPE_SUBSCRIPTION_PRICE_ID` è impostato e il prezzo del webhook corrisponde, il piano utente (`planType` / `subExpiresAt`) viene sincronizzato.

## 4. Variabili d’ambiente (billing)

| Variabile | Ruolo |
|-----------|--------|
| `STRIPE_SECRET_KEY` | API server |
| `STRIPE_WEBHOOK_SECRET` | Verifica firma webhook |
| `STRIPE_PRICE_SOLO_COUPLE_CENTS` | Prezzo base solo/coppia (centesimi) |
| `STRIPE_PRICE_GROUP_CENTS` | Prezzo gruppo |
| `STRIPE_PRICE_REGEN_CENTS` | Rigenerazione |
| `STRIPE_PRICE_REACTIVATE_CENTS` | Riattivazione |
| `STRIPE_PRICE_LOCALPASS_CENTS` | Add-on LocalPass (per città) |
| `STRIPE_SUBSCRIPTION_PRICE_ID` | Opzionale — abbonamento |

## 5. Modello dati

- `Payment`: collegamento a `User`, `Trip` opzionale, `type` (`purchase` | `regen` | `reactivate`), `stripePaymentId`.
- `Trip`: `paymentId`, `amountPaid`, stato `TripStatus`.

## 6. Referral post-acquisto

- Dopo `purchase` confermato, `referralService.tryGrantReward` (non bloccante).
