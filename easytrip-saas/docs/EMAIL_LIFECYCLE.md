# Ciclo di vita email EasyTrip

Documento di riferimento per email transazionali, marketing (opt-in) e automazioni collegate a Resend + Inngest + webhooks.

**Verifica pratica in locale (Clerk, ngrok, Resend, Prisma, Inngest):** vedi [`EMAIL_VERIFICATION_CHECKLIST.md`](EMAIL_VERIFICATION_CHECKLIST.md).

## Principi

- **Transazionali**: pagamenti, stato viaggio, sicurezza account — non richiedono opt-in marketing.
- **Marketing / nurturing**: promemoria commerciali, “torna in app” — solo se `marketingOptIn` è vero nel profilo utente (database).
- **Deliverability**: dominio verificato su Resend, SPF/DKIM/DMARC; email marketing con header `List-Unsubscribe` dove supportato.

## Mappa eventi

| Fase | Email | Trigger | Implementazione |
|------|--------|---------|-----------------|
| A1 | Benvenuto | `user.created` (webhook Clerk) | `api/webhooks/clerk` + `welcomeEmailHtml` |
| A2 | Pagamento ricevuto | Stripe `checkout.session.completed` | `billingService` |
| A3 | Itinerario pronto | Inngest `generate-itinerary` | `transactional.ts` |
| B1–B2 | Pre-viaggio / buon viaggio | Cron Inngest | `pre-trip-reminders.ts` |
| C1 | Crediti in scadenza | Cron | `credit-expiry-reminders.ts` |
| C2 | Accesso trip scaduto | Cron | `expire-trips.ts` |
| C3 | Checkout abbandonato | Stripe `checkout.session.expired` | `billingService` + `abandonedCheckoutHtml` |
| D1–D2 | Post-viaggio | Cron | `post-trip-followup.ts` |
| D3 | Nurture (nessun viaggio D+3 / D+7) | Cron Inngest | `nurture-no-trip.ts` (solo marketing opt-in) |
| E | Referral | Signup / Stripe | `referralService.ts` |
| Membri | Invito accettato / itinerario pronto (membro) | `joinTripByToken` / `generate-itinerary` | `transactional.ts` |

## Variabili ambiente

| Variabile | Uso |
|-----------|-----|
| `RESEND_API_KEY` | Invio reale |
| `EMAIL_FROM` | Mittente |
| `CLERK_WEBHOOK_SIGNING_SECRET` | Verifica webhook Clerk (Dashboard → Webhooks → Signing Secret) |
| `APP_BASE_URL` | Link nelle email |

## Preferenze marketing

L’utente può attivare/disattivare l’opt-in dalla pagina **Privacy** (`/app/account/privacy`) → API `PATCH /api/user/marketing-preferences`.

## Idempotenza webhook

La tabella `WebhookDelivery` (`provider` + `externalId`) evita doppi invii per lo stesso evento Stripe/Clerk.
