# 09 — Sicurezza e protezione route

| Documento     | Percorso                                           |
| ------------- | -------------------------------------------------- |
| Indice        | [README_00.md](../README_00.md)                    |
| API           | [04_API_SPECIFICATION.md](04_API_SPECIFICATION.md) |
| Osservabilità | [11_OBSERVABILITY.md](11_OBSERVABILITY.md)         |

## 1. Autenticazione (Clerk)

- Package: `@clerk/nextjs`.
- **Middleware**: `src/middleware.ts`
  - `createRouteMatcher(["/app(.*)"])` → per richieste a `/app`, `auth.protect()` obbligatorio.
  - Matcher ampio per static asset exclusion; include `/(api|trpc)(.*)` nel pattern globale — le singole route API applicano comunque controlli in handler (`auth()` da `@clerk/nextjs/server` dove implementato).

## 2. Autorizzazione applicativa

- I **controllers** verificano che l’utente Clerk mappato (`AuthService` + `UserRepository`) sia organizzatore o membro del trip prima di operazioni sensibili.
- **Join gruppo**: token `inviteToken` su `Trip`; endpoint `/api/join/[token]` con rate limit dedicato (`joinGetLimiter`, `joinPostLimiter`).

## 3. Rate limiting

- File: `src/lib/rate-limit.ts`
- Backend **Upstash** (sliding window). Se mancano `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN`, i limiti sono disattivati (sviluppo locale).
- Esempi: `tripGenerateLimiter` su `POST /api/trips/[tripId]/generate`, limiter per join e referral track.

## 4. Webhook Stripe

- Verifica firma con `stripe.webhooks.constructEvent` e `STRIPE_WEBHOOK_SECRET`.
- Rifiuto se firma assente o non valida (`AppError`).

## 5. Privacy utente

- `GET /api/user/data-export` — esportazione dati (implementazione in `UserDataService`).
- `POST /api/user/delete-account` — cancellazione account (flusso server-side).

## 6. Geo-privacy

- `src/lib/geo-privacy.ts` — arrotondamento coordinate dove applicato (es. contesti AI) per ridurre precisione inappropriata.

## 7. Segreti

- Mai committare `.env`. Usare solo `.env.example` come template (se presente nel repo).
