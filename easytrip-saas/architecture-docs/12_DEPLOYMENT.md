# 12 — Deployment, CI/CD e go-live

| Documento | Percorso                                     |
| --------- | -------------------------------------------- |
| Indice    | [README_00.md](../README_00.md)              |
| DevOps    | [08_DEVOPS_VERCEL.md](08_DEVOPS_VERCEL.md)   |
| Sicurezza | [09_SECURITY_CLERK.md](09_SECURITY_CLERK.md) |

## 1. Build di produzione

```bash
cd easytrip-saas
npm ci
npm run build
npm start
```

- Vercel esegue equivalente su push (configurazione progetto Vercel, root `easytrip-saas` o monorepo secondo setup).

## 2. Pipeline CI (GitHub Actions)

File principale: `.github/workflows/main.yml` (root repository, `working-directory: easytrip-saas`).

| Job               | Contenuto                                                                         |
| ----------------- | --------------------------------------------------------------------------------- |
| `quality`         | `npm audit` (critical), Prettier check, ESLint, TypeScript, Vitest unit, coverage |
| `integration`     | Postgres 16 service, `prisma db push`, test integrazione                          |
| `e2e-smoke-local` | Chromium, `npm run test:e2e:smoke`                                                |
| `e2e-preview`     | (su `deployment_status` Vercel Preview) smoke contro URL deploy                   |
| `verify-env`      | `workflow_dispatch` — controlla segreti allineati a produzione (opzionale)        |

Altri workflow: `codeql.yml`. Segreti, DNS, post-deploy: [13_CICD_SECRETS_AND_DNS.md](13_CICD_SECRETS_AND_DNS.md).

## 3. Checklist go-live

| #   | Voce           | Dettaglio                                                                               |
| --- | -------------- | --------------------------------------------------------------------------------------- |
| 1   | Env produzione | Tutte le variabili in `unifiedConfig` + Stripe price ID + `APP_BASE_URL` dominio finale |
| 2   | Database       | Migrazioni applicate; backup policy definita                                            |
| 3   | Clerk          | Domini autorizzati, chiavi produzione                                                   |
| 4   | Stripe         | Webhook URL produzione, eventi selezionati, test pagamento reale in modalità limitata   |
| 5   | Inngest        | App collegata a deploy URL; sync funzioni ok                                            |
| 6   | Upstash        | Token produzione se si usa rate limit                                                   |
| 7   | Anthropic      | Quota e model ID aggiornato                                                             |
| 8   | Resend         | Dominio verificato se email attive                                                      |
| 9   | PostHog        | Progetto produzione; `NEXT_PUBLIC_POSTHOG_*` in Production                                 |
| 10  | Vercel Analytics / Speed Insights | Nel progetto Vercel: abilitare **Web Analytics** e **Speed Insights** se si vogliono i pannelli; i componenti sono già in [`src/app/layout.tsx`](../src/app/layout.tsx) |
| 11  | Smoke test     | E2E smoke in CI verde su `main`                                                         |

## 4. Rollback

- Vercel: promuovere deployment precedente.
- Database: pianificare rollback migrazioni separatamente (non automatico nel repo).

## 5. Domini personalizzati

- Configurazione DNS e Vercel Domains (documentazione operativa esterna; aggiornare `APP_BASE_URL`).

## 6. Riferimenti

| Risorsa             | Path                                                     |
| ------------------- | -------------------------------------------------------- |
| OpenAPI             | `docs/openapi.yaml`                                      |
| Config env          | `src/config/unifiedConfig.ts`                            |
| Template env        | `.env.example`                                           |
| CI/CD, segreti, DNS | [13_CICD_SECRETS_AND_DNS.md](13_CICD_SECRETS_AND_DNS.md) |
