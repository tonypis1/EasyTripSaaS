# EasyTrip SaaS

Applicazione [Next.js](https://nextjs.org) con **Prisma**, **PostgreSQL**, **Clerk**, **Stripe**, **Inngest** e **Anthropic** per generare itinerari strutturati (JSON), con rigenerazioni, carosello versioni, email transazionali (opzionali) e sostituzione slot con supporto GPS opzionale.

## Documentazione HTML (visione prodotto)

Nel repository, cartella **`docs/desktop-html/`**:

- `easytrip-index-documentazione-nextjs.html` — indice
- `easytrip-mvp-architecture-nextjs.html` — architettura MVP (stack attuale)
- `easytrip-technical-spec-nextjs.html` — specifiche tecniche e API

Puoi copiare questi file sul Desktop o aprirli direttamente dal disco. Sostituiscono i vecchi documenti basati su Bubble/Make/Brevo.

Il file **`CATALOG.md`** (catalogo skill Cursor) è incluso nella root del progetto: se usi un altro clone, copialo dalla stessa posizione o rigenera l’indice skill da Cursor.

## Variabili d’ambiente

Oltre a `DATABASE_URL`, chiavi Clerk, Stripe e `ANTHROPIC_API_KEY`, sono supportate:

| Variabile | Descrizione |
|-----------|-------------|
| `STRIPE_PRICE_REGEN_CENTS` | Prezzo rigenerazione (default `199` = €1,99) |
| `RESEND_API_KEY` | API key [Resend](https://resend.com) per email transazionali |
| `EMAIL_FROM` | Mittente verificato su Resend (es. `onboarding@tuo-dominio.com`) |

Senza Resend, le email sono solo loggate lato server (utile in sviluppo).

## Sviluppo

```bash
npm install
npm run dev
```

Dopo modifiche a `prisma/schema.prisma`:

```bash
npm run db:generate
```

Se compare **"@prisma/client did not initialize"**:

```bash
npm run db:generate
```

Per la generazione itinerario in locale serve il **dev server Inngest** in un secondo terminale:

```bash
npm run inngest:dev
```

## Generazione in sviluppo senza Stripe

In `development`, `POST /api/trips/:id/generate` può avviare la generazione anche senza pagamento (utile con il pulsante «Avvia generazione (dev)»). In produzione il pagamento è obbligatorio.

## E2E (Playwright)

```bash
npm run playwright:install
npm run test:e2e
```

Variabili: `E2E_AUTH_STORAGE_STATE`, `E2E_TRIP_ID`, opzionale `E2E_BASE_URL`.

## Deploy

Vedi [documentazione Next.js](https://nextjs.org/docs/app/building-your-application/deploying) (es. Vercel). Configura webhook Stripe verso `https://tuodominio.com/api/webhooks/stripe`.
