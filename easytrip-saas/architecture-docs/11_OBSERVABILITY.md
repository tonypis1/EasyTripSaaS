# 11 — Osservabilità e monitoraggio

| Documento | Percorso |
|-----------|----------|
| Indice | [README_00.md](../README_00.md) |
| Inngest | [10_INNGEST_SLOTS.md](10_INNGEST_SLOTS.md) |
| Deploy | [12_DEPLOYMENT.md](12_DEPLOYMENT.md) |

## 1. Analytics prodotto (client)

- **PostHog**: `posthog-js` in `package.json`; inizializzazione lato client dove integrato (cercare `posthog` in `src/`).
- Uso: funnel, eventi custom, sessioni (policy privacy lato PostHog).

## 2. Log applicativi

- Pattern `logger` (livelli info/warn/error) in servizi critici — es. `billingService`, flussi Inngest.
- In **produzione Vercel**: log delle **Serverless Functions** nella dashboard del progetto (runtime Node).

## 3. Job Inngest

- **Pannello Inngest**: ogni esecuzione di `generateItinerary`, retention, reminder è visibile con timeline, payload e stack trace.
- Dev locale: `npm run inngest:dev` punta a `http://localhost:3000/api/inngest`.

## 4. Stripe

- Dashboard Stripe: pagamenti, webhook delivery, errori di firma.
- Endpoint webhook locale: tunnel (Stripe CLI) o deploy preview con URL pubblico.

## 5. Database

- Osservabilità query: Prisma query log in dev (`src/lib/prisma.ts`); in prod ridurre verbosità.

## 6. CI

- Pipeline GitHub Actions (repo root `.github/workflows/main.yml`) — esito job come gate qualità; non sostituisce APM.

## 7. Limiti attuali

- Nessun vendor APM unico obbligatorio nel codice (es. Datadog/New Relic) oltre a Vercel + Inngest + Stripe + PostHog.
