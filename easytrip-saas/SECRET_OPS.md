# Segreti, ambienti e automazione

Guida breve per gestire credenziali in modo sicuro e scalare CI/CD (Vercel + GitHub Actions).

## Principi

- **Non committare mai** file `.env`, `.env.local`, export di chiavi o dump di database.
- **Separare Preview e Production**: stesse _chiavi logiche_ (es. `DATABASE_URL`) ma **valori diversi** per ambiente.
- **Rotazione**: quando una chiave è esposta, ruotarla alla fonte (Clerk, Stripe, Vercel, ecc.) e aggiornare ovunque sia configurata.

## Dove vivono i segreti

| Ambiente                | Dove configurare                                        | Note                                                                            |
| ----------------------- | ------------------------------------------------------- | ------------------------------------------------------------------------------- |
| **Vercel – Preview**    | Project → Settings → Environment Variables → Preview    | Deploy delle PR; ideale per DB di staging / branch Neon.                        |
| **Vercel – Production** | Stesso pannello → Production                            | Solo valori produzione.                                                         |
| **GitHub Actions**      | Repository → Settings → Secrets and variables → Actions | Per workflow che non passano da Vercel (es. token, URL E2E opzionali).          |
| **GitHub Environments** | Environments (`production`, `preview`, …)               | Secrets **scoped** per environment + approvatori opzionali su deploy sensibili. |
| **Locale**              | `easytrip-saas/.env` (gitignored)                       | `vercel env pull` per allinearsi a Vercel.                                      |

## Comandi utili (Vercel CLI / plugin)

- Elencare variabili (senza valori in chiaro in output controllato): `vercel env ls`
- Scaricare in `.env.local` per sviluppo: `vercel env pull` (dalla directory del progetto collegata)
- Aggiungere un segreto: `vercel env add NOME_VAR production` (e ripetere per `preview` se serve)

**Root directory:** in dashboard Vercel impostare **Root Directory** = `easytrip-saas` se il repository include altre cartelle alla root.

## CSP e header di sicurezza

Gli header applicativi (CSP, `X-Frame-Options`, ecc.) sono definiti in **`src/lib/security-headers.ts`** e applicati da **`next.config.ts`**.  
**Non duplicare** la stessa CSP in `vercel.json`: il file Vercel in questo repo aggiunge solo `Cache-Control` mirato per asset statici. Modifiche alla policy → solo `security-headers.ts` (+ test se necessario).

## GitHub Actions e segreti CI

- **`CI` (`.github/workflows/ci.yml`)** non richiede **secret Vercel** né API esterne: include anche **Prettier** (`format:check`), **npm audit** (solo severità **critical** sulle dipendenze di produzione), **ESLint**, **TypeScript**, test unitari, coverage, integrazione (Postgres di servizio nel runner e `DATABASE_URL` definito nel workflow), Playwright smoke. Panoramica leggibile: [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md#ci-github-actions).
- **CodeQL** (`.github/workflows/codeql.yml`): SAST; nessun segreto tipico oltre ai permessi predefiniti del workflow.
- **E2E Preview** (`.github/workflows/deployment-preview-e2e.yml`): usa l’URL del deploy Vercel (`deployment_status.target_url`). Eventuali secret aggiuntivi (sessioni Clerk per test autenticati) vanno definiti come **Secrets** repository e documentati qui quando li aggiungete.
- **Variabili mancanti**: se un job fallisce per env, controllare il log dello step; non stampare mai valori di secret nei `echo`.

## Husky (git hooks)

Il `package.json` è in **`easytrip-saas/`** mentre la root Git è spesso **`EasyTrip program_00`**. Dopo `npm install` in `easytrip-saas`, eseguire **una volta** dalla root del repository:

```bash
git config core.hooksPath easytrip-saas/.husky
```

Così `pre-commit` esegue `lint-staged` sul progetto corretto. Se `.git` non è trovato durante `npm install`, è normale finché non si configura il path sopra.

## Rotazione e accesso team

1. Revocare la vecchia chiave nel provider (Stripe, Clerk, Anthropic, …).
2. Aggiornare Vercel (Production e Preview se applicabile) e ridistribuire o attendere il prossimo deploy.
3. Aggiornare segreti GitHub se usati dai workflow.
4. Verificare CI e un deploy Preview a campione.

Limitare chi può vedere **Settings** su Vercel e **Secrets** su GitHub (ruoli Maintainer/Admin).

## Scalare l’automazione

- **Staging aggiuntivo**: branch dedicato (es. `staging`) collegato a un progetto Vercel separato o a environment Preview con override variabili.
- **Più regioni / team**: duplicare progetti Vercel o usare **team** Vercel con progetti per ambiente.

---

## Monitoraggio e visibilità (osservabilità)

### Vercel

- **Runtime Logs**: dashboard del progetto → Deployments → selezionare un deploy → _Functions_ / log runtime per API route e serverless.
- **Observability** (se incluso nel piano): metriche e tracce integrate.
- **Log Drains**: in Team/Project settings, inoltrare log a **Datadog**, **Axiom**, **Splunk**, ecc. per retention e alert lanciati dal provider.

### GitHub

- Abilitare notifiche email per **workflow falliti** (account GitHub → Notifications).
- Per **Slack**: creare un Incoming Webhook e un workflow che invia in `if: failure()` (secret `SLACK_WEBHOOK_URL`), oppure usare l’app GitHub per Slack.
- Per **Discord**: Webhook di canale + `curl` in un job finale con `if: failure()`.

### Vercel → canali esterni

- Nelle impostazioni del **team** o **progetto** Vercel: notifiche deploy (successo/fallimento) verso Slack/email dove supportato.

### Applicativo

- Valutare **Sentry** (o simile) per errori client/server con release legate al deploy Git.
- Dashboard **Stripe** / **Clerk** per autenticazione e pagamenti.

---

## Riferimenti interni

- Pipeline principale: [`.github/workflows/ci.yml`](../.github/workflows/ci.yml)
- E2E post-deploy Preview: [`.github/workflows/deployment-preview-e2e.yml`](../.github/workflows/deployment-preview-e2e.yml)
- SAST: [`.github/workflows/codeql.yml`](../.github/workflows/codeql.yml)
- Config piattaforma: [`vercel.json`](vercel.json)
