# 11 — Osservabilità e monitoraggio

| Documento | Percorso                                   |
| --------- | ------------------------------------------ |
| Indice    | [README_00.md](../README_00.md)            |
| Inngest   | [10_INNGEST_SLOTS.md](10_INNGEST_SLOTS.md) |
| Deploy    | [12_DEPLOYMENT.md](12_DEPLOYMENT.md)       |

## Panoramica strumenti

| Strumento | Cosa misura | Configurazione tipica | Dove nel codice |
| --------- | ----------- | --------------------- | --------------- |
| **PostHog** | Analytics prodotto: eventi, funnel, feature flags, (opz.) session replay | `NEXT_PUBLIC_POSTHOG_KEY`, `NEXT_PUBLIC_POSTHOG_HOST` (vedi `.env.example`) | `src/app/[locale]/layout.tsx` → `PostHogProvider` |
| **Vercel Web Analytics** | Visite, pagine viste, percorso utente aggregato (dashboard Vercel) | Nessuna variabile d’ambiente dedicata: il progetto Vercel è associato al deploy | `src/app/layout.tsx` → `<Analytics />` da `@vercel/analytics/next` |
| **Vercel Speed Insights** | Core Web Vitals da traffico reale (LCP, INP, CLS, ecc.) | Come sopra; abilitare Speed Insights dal pannello progetto se richiesto | `src/app/layout.tsx` → `<SpeedInsights />` da `@vercel/speed-insights/next` |
| **Log runtime** | Errori e messaggi strutturati lato server | — | `src/lib/observability.ts`; consumo in **Vercel → Logs** |
| **Inngest Cloud** | Esecuzioni job, retry, errori workflow | `INNGEST_EVENT_KEY`, `INNGEST_SIGNING_KEY` | Dashboard Inngest; sync su `/api/inngest` |
| **Stripe** | Pagamenti, consegna webhook | Dashboard Stripe | Webhook e log eventi |
| **Prisma (dev)** | Query SQL verbose | Solo sviluppo | `src/lib/prisma.ts` |

**Nota**: PostHog e i due prodotti Vercel possono convivere: PostHog è orientato a **eventi di prodotto** e sperimentazione; Vercel Analytics / Speed Insights sono integrati nella **dashboard di hosting** e non richiedono chiavi pubbliche nel client oltre al deploy sulla piattaforma.

## 1. Analytics prodotto (client)

### PostHog

- **Pacchetto**: `posthog-js` in `package.json`; inizializzazione lato client tramite `PostHogProvider` (cercare `posthog` in `src/`).
- **Uso**: funnel, eventi custom, sessioni (policy privacy e retention lato progetto PostHog).

### Vercel Web Analytics e Speed Insights

- **Pacchetti**: `@vercel/analytics`, `@vercel/speed-insights` in `package.json`.
- **Integrazione**: componenti nel **layout radice** [`src/app/layout.tsx`](../src/app/layout.tsx) così tutte le rotte ereditano il tracking.
- **Dati utili**: in **produzione su Vercel**; in locale le dashboard restano spesso vuote o con campioni minimi.

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

- Nessun vendor APM unico obbligatorio nel codice (es. Datadog/New Relic) oltre a **Vercel** (Web Analytics, Speed Insights, Logs), **Inngest**, **Stripe** e **PostHog**.
