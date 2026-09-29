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

| #   | Voce                              | Dettaglio                                                                                                                                                               |
| --- | --------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Env produzione                    | Tutte le variabili in `unifiedConfig` + Stripe price ID + `APP_BASE_URL` dominio finale                                                                                 |
| 2   | Database                          | Migrazioni applicate; backup policy definita                                                                                                                            |
| 3   | Clerk                             | Domini autorizzati, chiavi produzione                                                                                                                                   |
| 4   | Stripe                            | Webhook URL produzione, eventi selezionati, test pagamento reale in modalità limitata                                                                                   |
| 5   | Inngest                           | App collegata a deploy URL; sync funzioni ok                                                                                                                            |
| 6   | Upstash                           | Token produzione se si usa rate limit                                                                                                                                   |
| 7   | Anthropic                         | Quota e model ID aggiornato                                                                                                                                             |
| 8   | Resend                            | Dominio verificato se email attive                                                                                                                                      |
| 9   | PostHog                           | Progetto produzione; `NEXT_PUBLIC_POSTHOG_*` in Production                                                                                                              |
| 10  | Vercel Analytics / Speed Insights | Nel progetto Vercel: abilitare **Web Analytics** e **Speed Insights** se si vogliono i pannelli; i componenti sono già in [`src/app/layout.tsx`](../src/app/layout.tsx) |
| 11  | Smoke test                        | E2E smoke in CI verde su `main`                                                                                                                                         |

## 4. Rollback

- Vercel: promuovere deployment precedente.
- Database: pianificare rollback migrazioni separatamente (non automatico nel repo).

### Migrazione `20260929130000_add_trip_preferences` (Trip: preferenze strutturate)

- Additiva: 4 colonne nuove su `Trip` con default (elenchi vuoti / NULL). Non riscrive la tabella e le righe esistenti risultano subito con elenchi vuoti (verificato inserendo un viaggio prima della migrazione).
- **Ordine di deploy: applicare la migrazione PRIMA del nuovo codice** (a differenza della migrazione `day_slots_to_jsonb`, qui l'ordine conta). Il codice precedente funziona con lo schema nuovo (crea, legge e aggiorna viaggi normalmente); il codice nuovo su uno schema senza le colonne fallisce su ogni lettura di un viaggio (`The column Trip.interests does not exist`). Verificato con Prisma 6.19.3 e PostgreSQL 16.
- Rollback: `ALTER TABLE "Trip" DROP COLUMN "interests", DROP COLUMN "pace", DROP COLUMN "mobility_needs", DROP COLUMN "dietary_restrictions";` (elimina le preferenze salvate) e cancellare la riga da `_prisma_migrations`.

### Migrazione `20260929100000_day_slots_to_jsonb` (Day.morning/afternoon/evening/restaurants: testo → jsonb)

- **Non rigenerarla con `prisma migrate dev`**: per questo cambio di tipo Prisma produce `DROP COLUMN` + `ADD COLUMN`, cioè cancella il contenuto di ogni itinerario. La migrazione nel repo converte sul posto (`ALTER COLUMN … TYPE JSONB USING …`).
- **Prima di applicarla**: backup/snapshot del database. La tabella `Day` viene riscritta con un lock esclusivo per la durata della conversione (righe nell'ordine di poche migliaia: frazioni di secondo).
- **Ordine di deploy: indifferente** (verificato con Prisma 6.19.3 e PostgreSQL 16). Il codice precedente (campi `String`) legge e scrive le colonne `jsonb` come testo JSON — e ciò che scrive viene salvato come oggetto, non come stringa — e il codice nuovo (campi `Json`) funziona anche sulle vecchie colonne testo. Si può quindi applicare `npx prisma migrate deploy` prima o dopo il deploy Vercel senza finestre di errore. Il codice nuovo tollera inoltre righe ancora salvate come stringa JSON.
- **Righe anomale**: nessuna blocca la migrazione. `NULL`, stringa vuota e il testo `null` diventano `NULL`; testo che non è JSON valido (o non ammesso da jsonb) viene conservato come stringa JSON con il testo originale — l'app lo tratta come slot assente ma il dato resta ispezionabile (`SELECT id, morning FROM "Day" WHERE jsonb_typeof(morning) = 'string'`).
- **Rollback dello schema** (solo se necessario; anche il codice precedente funziona con entrambi i tipi):

  ```sql
  ALTER TABLE "Day"
    ALTER COLUMN "morning" TYPE TEXT USING "morning"::text,
    ALTER COLUMN "afternoon" TYPE TEXT USING "afternoon"::text,
    ALTER COLUMN "evening" TYPE TEXT USING "evening"::text,
    ALTER COLUMN "restaurants" TYPE TEXT USING "restaurants"::text;
  ```

  Dopo la conversione inversa il testo è JSON normalizzato da PostgreSQL (chiavi riordinate, spazi dopo `:`), equivalente per il parsing. Poi eliminare la riga della migrazione da `_prisma_migrations` (`DELETE FROM "_prisma_migrations" WHERE migration_name = '20260929100000_day_slots_to_jsonb'`) così che `migrate deploy` non la consideri applicata: `prisma migrate resolve --rolled-back` non funziona su una migrazione riuscita (errore P3012). Le righe conservate come stringa JSON (vedi sopra) tornano come testo tra virgolette: il codice precedente le tratta, come prima, come slot illeggibili.

## 5. Domini personalizzati

- Configurazione DNS e Vercel Domains (documentazione operativa esterna; aggiornare `APP_BASE_URL`).

## 6. Riferimenti

| Risorsa             | Path                                                     |
| ------------------- | -------------------------------------------------------- |
| OpenAPI             | `docs/openapi.yaml`                                      |
| Config env          | `src/config/unifiedConfig.ts`                            |
| Template env        | `.env.example`                                           |
| CI/CD, segreti, DNS | [13_CICD_SECRETS_AND_DNS.md](13_CICD_SECRETS_AND_DNS.md) |
