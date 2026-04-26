# 08 — DevOps: hosting e ambiente

| Documento | Percorso |
|-----------|----------|
| Indice | [README_00.md](../README_00.md) |
| Pagamenti | [07_PAYMENTS_STRIPE.md](07_PAYMENTS_STRIPE.md) |
| Deploy / CI | [12_DEPLOYMENT.md](12_DEPLOYMENT.md) |

## 1. Piattaforma di esecuzione

- L’applicazione è progettata per **Node.js** su hosting compatibile con Next.js (riferimento esplicito a **Vercel** in commenti di `unifiedConfig.ts`: URL produzione `https://easytripsaas.vercel.app`).
- Build: `npm run build` → `next build` (script in `package.json`).
- Avvio locale: `npm run dev` (`next dev --webpack`).

## 2. Runtime e regioni

- Route che usano Prisma, Stripe webhook, Inngest devono girare in **runtime Node.js** (non Edge) dove dichiarato.
- La scelta regione Vercel e database gestito è operativa (non codificata nel repo).

## 3. Servizi collegati (esterni)

| Servizio | Funzione |
|----------|----------|
| PostgreSQL | Database Prisma (es. Neon, RDS, Supabase) |
| Clerk | Auth |
| Stripe | Pagamenti |
| Inngest Cloud | Orchestrazione job (`inngest:dev` per dev locale) |
| Upstash Redis | Rate limit (opzionale) |
| Resend | Email (opzionale) |

## 4. Variabili d’ambiente obbligatorie (schema Zod)

Definite in `src/config/unifiedConfig.ts` — devono essere presenti in produzione (Vercel → Environment Variables):

| Variabile | Descrizione |
|-----------|-------------|
| `DATABASE_URL` | Connection string PostgreSQL |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Clerk pubblico |
| `CLERK_SECRET_KEY` | Clerk server |
| `STRIPE_SECRET_KEY` | Stripe segreta |
| `STRIPE_WEBHOOK_SECRET` | Verifica webhook |
| `ANTHROPIC_API_KEY` | Generazione itinerari |
| `APP_BASE_URL` | URL pubblico (redirect Stripe, link email); default localhost |

Opzionali / default: prezzi Stripe in centesimi, `ANTHROPIC_MODEL`, `STRIPE_SUBSCRIPTION_PRICE_ID`, `RESEND_API_KEY`, `EMAIL_FROM`, retention days.

## 5. Variabili opzionali non nello schema Zod

| Variabile | Uso |
|-----------|-----|
| `INNGEST_EVENT_KEY`, `INNGEST_SIGNING_KEY` | Inngest Cloud → sync con `/api/inngest` |
| `UPSTASH_REDIS_REST_URL` | Rate limit |
| `UPSTASH_REDIS_REST_TOKEN` | Rate limit |
| `NEXT_PUBLIC_POSTHOG_*` | Analytics (`posthog-provider.tsx`) |
| `NEXT_PUBLIC_CRISP_WEBSITE_ID` | Chat (`crisp-chat.tsx`) |
| `NEXT_PUBLIC_*` affiliate | `src/lib/affiliate.ts` (partner ID) |
| `E2E_*` | Playwright (CI / test) |

Template completo: [`.env.example`](../.env.example). Validazione manuale: `node scripts/check-env.mjs` (vedi `--strict` / `--production`).

## 6. Comandi operativi

| Comando | Scopo |
|---------|--------|
| `npm run db:generate` | `prisma generate` |
| `npx prisma migrate` | Migrazioni (operatore) |
| `npm run inngest:dev` | Dev server Inngest contro `/api/inngest` |
