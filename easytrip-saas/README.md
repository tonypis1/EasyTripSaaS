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

### Screenshot per `presentation.html`

```bash
npm run screenshots:presentation
```

- **Memoria (Windows / “Zone Allocation failed” / out of memory)**  
  Gli script `screenshots:*` usano già Node con `--max-old-space-size=8192`. In più: avvia **`npm run dev` in un terminale separato** e aspetta che sia pronto, *poi* lancia gli screenshot. Così Playwright riusa il server (`reuseExistingServer`) e **non** avvia una seconda copia di Next.js, che consuma molta RAM.

- Senza variabili extra: genera `01-landing.png` e `02-auth-clerk.png`.
- Per le immagini **autenticate** (`03`–`05`) serve un file `e2e/.auth/user.json`.

#### Perché Google “browser non sicuro” con Playwright

Se usi **Accedi con Google** nella finestra di `playwright codegen`, Google spesso mostra *“Questo browser o questa app potrebbero non essere sicuri”*: è una **difesa di Google contro i browser controllati da automazione**, non un errore di Clerk o dell’app. **Non si risolve** affidandosi a OAuth Google dentro Playwright.

**Percorsi consigliati:**

1. **Script Clerk (consigliato)** — niente Google nel browser di test:
   - In `.env.local` servono le chiavi **di sviluppo** Clerk (`NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` / `pk_test_…` e `CLERK_SECRET_KEY` / `sk_test_…`). `@clerk/testing` **rifiuta** chiavi di produzione.
   - Imposta l’email dell’account: `E2E_CLERK_USER_EMAIL=tua@email.com`
   - Opzionale: `E2E_CLERK_USER_PASSWORD=…` se preferisci login a password invece del ticket via email (vedi [test helpers Clerk](https://clerk.com/docs/guides/development/testing/playwright/test-helpers)).
   - Esegui: `npm run screenshots:clerk-session`  
     Crea/aggiorna `e2e/.auth/user.json` (cartella in `.gitignore`).
   - Poi:  
     `E2E_AUTH_STORAGE_STATE=e2e/.auth/user.json` e opzionale `E2E_TRIP_ID=…` → `npm run screenshots:presentation`.
   - Usa lo **stesso host** per tutto (default `http://127.0.0.1:3000`): se generi la sessione con `127.0.0.1` e poi apri `localhost` (o viceversa), i cookie non combaciano e il login risulta assente.

2. **Codegen solo se eviti Google** — `npx playwright codegen http://127.0.0.1:3000 --save-storage=e2e/.auth/user.json` e accedi con **email + password** Clerk (stesso utente che possiede i trip), **non** con il pulsante Google.

- Opzionale `E2E_TRIP_ID=<id prisma/cuid del trip>`: genera anche `05-trip-detail.png` (pagina dettaglio reale).

## Deploy

Vedi [documentazione Next.js](https://nextjs.org/docs/app/building-your-application/deploying) (es. Vercel). Configura webhook Stripe verso `https://tuodominio.com/api/webhooks/stripe`.
