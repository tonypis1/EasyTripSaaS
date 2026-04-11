# Deployment e go-live — EasyTrip

## Panoramica

L’app è un monolite **Next.js** adatto a deploy su **Vercel** (o altro Node host) con **PostgreSQL** gestito (Neon, Supabase, RDS, ecc.).

## Ordine consigliato di setup

1. **Database PostgreSQL** — crea database e ottieni `DATABASE_URL`.
2. **Prisma** — in locale: `npm run db:generate`; applica migrazioni (`npx prisma migrate deploy` in produzione dopo il primo deploy o prima del go-live).
3. **Clerk** — crea applicazione, abilita provider di login; copia `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` e `CLERK_SECRET_KEY`.
4. **Stripe** — prodotti/prezzi in centesimi come da `README` e variabili `STRIPE_PRICE_*`; configura webhook verso `https://easytripsaas.vercel.app/api/webhooks/stripe` (o il dominio finale; vedi [stripe-webhook-setup.md](./stripe-webhook-setup.md) e [CUSTOM_DOMAIN.md](./CUSTOM_DOMAIN.md)).
5. **Inngest** — registra app con URL produzione `https://easytripsaas.vercel.app/api/inngest` (aggiorna se cambi dominio; vedi [CUSTOM_DOMAIN.md](./CUSTOM_DOMAIN.md)).
6. **Anthropic** — `ANTHROPIC_API_KEY` e opzionale `ANTHROPIC_MODEL`.
7. **Resend** (opzionale) — email transazionali; senza chiave le email sono solo log.
8. **PostHog** (opzionale) — analytics client.
9. **Upstash Redis** (opzionale ma consigliato in produzione) — rate limiting API:
   - `UPSTASH_REDIS_REST_URL`
   - `UPSTASH_REDIS_REST_TOKEN`  
     Senza queste variabili il rate limiting è disattivato (nessun errore, solo assenza di protezione).

## Variabili d’ambiente essenziali

| Variabile                                | Uso                                                                                          |
| ---------------------------------------- | -------------------------------------------------------------------------------------------- |
| `DATABASE_URL`                           | Connessione Prisma                                                                           |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`      | Auth client                                                                                  |
| `CLERK_SECRET_KEY`                       | Auth server                                                                                  |
| `STRIPE_SECRET_KEY` / chiavi publishable | Pagamenti                                                                                    |
| `STRIPE_WEBHOOK_SECRET`                  | Verifica webhook                                                                             |
| `ANTHROPIC_API_KEY`                      | Generazione itinerari                                                                        |
| Variabili `STRIPE_PRICE_*`               | Prezzi in centesimi (default in codice se omesse)                                            |
| `APP_BASE_URL`                           | URL pubblico dell’app; produzione attuale: `https://easytripsaas.vercel.app` — vedi [CUSTOM_DOMAIN.md](./CUSTOM_DOMAIN.md) per dominio proprio |

Elenco e gestione dei segreti: [`SECRET_OPS.md`](../SECRET_OPS.md). Contratto delle variabili obbligatorie: [`unifiedConfig`](../src/config/unifiedConfig.ts).

## CI (GitHub Actions)

### Workflow principale — `CI` ([`.github/workflows/ci.yml`](../../.github/workflows/ci.yml))

Su **push** e **pull request** verso `main` / `master` (con _concurrency_ per evitare run duplicati sullo stesso PR).

1. **Job `static-and-unit`**
   - `npm audit` (solo vulnerabilità **critical** sulle dipendenze di produzione)
   - **Prettier** — `npm run format:check`
   - **ESLint** — `npm run lint`
   - **TypeScript** — `npm run typecheck` (`tsc --noEmit`)
   - **Test unitari** — `npm run test:unit`
   - **Coverage** — `npm run test:coverage` (soglie su file critici definiti in `vitest.config.ts`)

2. **Job `integration`** (dopo il successo di `static-and-unit`)
   - Servizio **PostgreSQL 16** nel runner
   - `npx prisma db push --skip-generate` sul DB di test
   - **Test di integrazione** — `npm run test:integration`

3. **Job `playwright-smoke`** (dopo il successo di `integration`)
   - Playwright **Chromium**, test taggati **`@smoke`** (`npm run test:e2e:smoke`)

### Altri workflow

- **CodeQL** ([`.github/workflows/codeql.yml`](../../.github/workflows/codeql.yml)) — analisi statica (SAST) su `easytrip-saas`.
- **E2E su Preview Vercel** ([`.github/workflows/deployment-preview-e2e.yml`](../../.github/workflows/deployment-preview-e2e.yml)) — si attiva su `deployment_status` quando un deploy **Preview** ha successo; esegue gli smoke contro l’URL reale (`E2E_BASE_URL` dal deployment). Richiede integrazione GitHub ↔ Vercel con stato dei deployment abilitato.

### Build di produzione e Vercel

La **`npm run build`** **non** è eseguita in CI: il gate è lint, typecheck e test. La build avviene su **Vercel** (o in locale) con env complete: **Clerk** valida spesso la publishable key durante il prerender — servono valori coerenti con l’ambiente.

- In locale: `.env` / `.env.local` allineati a [`unifiedConfig`](../src/config/unifiedConfig.ts).
- Su Vercel: variabili in **Settings → Environment Variables** (vedi [`SECRET_OPS.md`](../SECRET_OPS.md)).

## Go-live checklist

- [ ] **CI GitHub** verde sul branch principale (workflow **CI** + eventuali **CodeQL** richiesti dalle regole del repo).
- [ ] Migrazioni DB applicate su produzione.
- [ ] Tutte le env configurate sul provider (Vercel / altro).
- [ ] Webhook Stripe verificato con evento di test.
- [ ] Inngest connesso e funzioni visibili nella dashboard.
- [ ] DNS e HTTPS attivi.
- [ ] Smoke test manuale: login, creazione trip, checkout test mode (se applicabile), generazione (o verifica coda Inngest).
- [ ] Rate limiting: Redis Upstash configurato per produzione.
- [ ] Backup DB: snapshot automatici dal provider DB o policy aziendale.
- [ ] Piano rollback: tag/release precedente su Vercel o immagine precedente.

## Disaster recovery (linee guida)

- **Database:** point-in-time recovery se offerto dal provider; altrimenti backup giornalieri e test di restore trimestrale.
- **Segreti:** rotazione chiavi Stripe/Clerk in caso di leak; revoca in dashboard.
- **Applicazione:** redeploy ultimo commit stabile; verificare compatibilità schema Prisma.
