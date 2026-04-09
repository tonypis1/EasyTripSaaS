# Deployment e go-live — EasyTrip

## Panoramica

L’app è un monolite **Next.js** adatto a deploy su **Vercel** (o altro Node host) con **PostgreSQL** gestito (Neon, Supabase, RDS, ecc.).

## Ordine consigliato di setup

1. **Database PostgreSQL** — crea database e ottieni `DATABASE_URL`.
2. **Prisma** — in locale: `npm run db:generate`; applica migrazioni (`npx prisma migrate deploy` in produzione dopo il primo deploy o prima del go-live).
3. **Clerk** — crea applicazione, abilita provider di login; copia `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` e `CLERK_SECRET_KEY`.
4. **Stripe** — prodotti/prezzi in centesimi come da `README` e variabili `STRIPE_PRICE_*`; configura webhook verso `https://<dominio>/api/webhooks/stripe` (vedi [stripe-webhook-setup.md](./stripe-webhook-setup.md)).
5. **Inngest** — registra app con URL produzione `https://<dominio>/api/inngest`.
6. **Anthropic** — `ANTHROPIC_API_KEY` e opzionale `ANTHROPIC_MODEL`.
7. **Resend** (opzionale) — email transazionali; senza chiave le email sono solo log.
8. **PostHog** (opzionale) — analytics client.
9. **Upstash Redis** (opzionale ma consigliato in produzione) — rate limiting API:
   - `UPSTASH_REDIS_REST_URL`
   - `UPSTASH_REDIS_REST_TOKEN`  
   Senza queste variabili il rate limiting è disattivato (nessun errore, solo assenza di protezione).

## Variabili d’ambiente essenziali

| Variabile | Uso |
|-----------|-----|
| `DATABASE_URL` | Connessione Prisma |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Auth client |
| `CLERK_SECRET_KEY` | Auth server |
| `STRIPE_SECRET_KEY` / chiavi publishable | Pagamenti |
| `STRIPE_WEBHOOK_SECRET` | Verifica webhook |
| `ANTHROPIC_API_KEY` | Generazione itinerari |
| Variabili `STRIPE_PRICE_*` | Prezzi in centesimi |

Elenco completo: `.env.example` (se presente) e codice in `src/config/unifiedConfig.ts`.

## CI (GitHub Actions)

Workflow [`.github/workflows/ci.yml`](../../.github/workflows/ci.yml): **lint** + **test unitari** (`npm run test:unit`).

La **`npm run build`** non è in CI di default perché **Clerk valida le chiavi publishable durante il prerender** di Next.js: servono chiavi reali di test/produzione. Esegui la build:

- in locale con `.env.local` completo, oppure
- sulla piattaforma di deploy (Vercel inietta le env).

## Go-live checklist

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
