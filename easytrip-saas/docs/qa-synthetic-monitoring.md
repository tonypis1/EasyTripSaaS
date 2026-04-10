# Monitoraggio sintetico API (opzionale)

Per controlli **HTTP sintetici** su produzione o staging senza integrarli nel merge gate:

## Checkly (o alternative)

1. Creare un account [Checkly](https://www.checklyhq.com/) (o Pingdom, Better Stack, ecc.).
2. Aggiungere un check **HTTP** verso endpoint stabili, ad esempio:
   - `GET /` (landing)
   - eventuali route pubbliche di health se ne aggiungete (es. `GET /api/health`).
3. Configurare frequenza (es. ogni 5 minuti) e soglie di latenza.
4. Collegare gli alert a Slack/email.

**Nota:** le route `/api/inngest` e le API protette da Clerk **non** sono adatte a check anonimi senza token; limitarsi a URL pubblici o usare [Checkly Browser checks](https://www.checklyhq.com/docs/browser-checks/) con credenziali di test in **secrets** Checkly, mai in repository.

Questo monitoraggio è **opzionale** e non blocca i merge: la qualità minima sul codice è definita dal workflow **`CI`** ([`.github/workflows/ci.yml`](../../.github/workflows/ci.yml)): audit dipendenze (solo **critical** in produzione), Prettier, ESLint, TypeScript, test unitari, coverage, integrazione con Postgres di servizio, Playwright smoke (`@smoke`). Oltre a ciò: **CodeQL** (SAST) e, opzionalmente, E2E sulla Preview Vercel dopo il deploy. Dettaglio e ordine degli step: [`docs/DEPLOYMENT.md`](DEPLOYMENT.md#ci-github-actions).
