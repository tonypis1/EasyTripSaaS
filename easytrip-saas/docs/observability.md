# Osservabilità — EasyTrip

## Stato attuale nel codice

| Strumento | Cosa copre | Dove |
|-----------|------------|------|
| **Logger JSON** | Eventi strutturati `info` / `warn` / `error` su stdout | [`src/lib/observability.ts`](../src/lib/observability.ts) |
| **PostHog** (client) | Analytics prodotto, funnel | Integrazione lato browser (vedi uso in `src/app/`) |

I log server sono **JSON su console**: su Vercel compaiono nel runtime log del progetto; filtrabili per livello e timestamp.

## Estensioni consigliate (non obbligatorie nel repo)

| Area | Note |
|------|------|
| **Log drain** | In produzione, inoltrare stdout a Datadog, Axiom, Logtail, ecc., per retention e query. |
| **Sentry** | Variabile tipica `SENTRY_DSN`; pacchetto `@sentry/nextjs` per errori client/server e release. |
| **OpenTelemetry** | Utile per tracing se il sistema cresce oltre il monolite. |
| **Metriche** | Vercel Analytics o metriche host per latency ed error rate sulle route. |

## Alerting consigliato

1. **Errori 5xx** — soglia su log o su Sentry (es. > N/min).
2. **Webhook Stripe** — fallimenti di firma o elaborazione (monitorare log + dashboard Stripe).
3. **Inngest** — funzioni in retry o failed nella dashboard Inngest.
4. **Database** — CPU, connessioni, storage (dashboard Neon/Supabase/AWS).

## Checklist implementazione futura

- [ ] Integrare **Sentry** (o simile) per errori non gestiti lato server e client.
- [ ] Abilitare **log drain** su storage queryabile per audit.
- [ ] Definire **SLO** (es. disponibilità API `/api/trips` < 500ms p95) se necessario per contratti interni.
