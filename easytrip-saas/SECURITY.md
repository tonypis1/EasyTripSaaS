# Sicurezza e protezione dei dati — EasyTrip SaaS

Questo documento descrive come EasyTrip tratta la sicurezza dell’applicazione, la protezione dei dati degli utenti e come segnalare vulnerabilità. È pensato per team tecnici, revisioni interne e allineamento a pratiche tipo SOC 2 (controlli organizzativi e tecnici) e PCI-DSS dove applicabile.

## Ambito

- **Prodotto:** applicazione web Next.js in questo repository (`easytrip-saas/`).
- **Dati sanitari (HIPAA):** l’app non è progettata per trattare informazioni sulla salute. Eventuali estensioni future richiedono valutazione legale e tecnica dedicate.

## Categorie di dati trattati

| Categoria            | Esempi                                                                               | Dove risiede                                                                                         |
| -------------------- | ------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------- |
| Identità e sessione  | Email, nome, ID Clerk                                                                | [Clerk](https://clerk.com), database applicativo (utente collegato a `clerk_user_id`)                |
| Contenuti viaggio    | Destinazione, date, preferenze, itinerari JSON, coordinate mappa/POI                 | Database PostgreSQL (Prisma)                                                                         |
| Pagamenti            | Importi, ID sessione/pagamento Stripe, metadati checkout                             | [Stripe](https://stripe.com) (carta **non** toccata dai nostri server)                               |
| Job e notifiche      | ID trip negli eventi generazione; waitlist solo `waitlistEntryId` (email solo in DB) | [Inngest](https://www.inngest.com/), worker applicativi                                              |
| Inferenza AI         | Prompt con contesto viaggio; suggerimenti live con coordinate GPS opzionali          | [Anthropic](https://www.anthropic.com/) (API server-side)                                            |
| Analytics e supporto | Eventi prodotto (se abilitati), chat supporto                                        | [PostHog](https://posthog.com/), [Crisp](https://crisp.chat/) (opzionali, variabili `NEXT_PUBLIC_*`) |

## Controlli tecnici principali

### Autenticazione e autorizzazione

- **Clerk** gestisce login, sessioni e token. Il middleware Next.js protegge l’area `/app`.
- Le **API** (`/api/*`) verificano l’utente lato server (`AuthService` / `currentUser` di Clerk) e applicano **autorizzazione applicativa** (es. organizzatore del trip, membership) senza affidarsi solo al client.

### Segregazione dati (multi-tenant)

- Non è attiva **Row Level Security (RLS)** a livello PostgreSQL; l’isolamento è **nel codice** (query Prisma filtrate per `organizerId`, `TripMember`, ecc.).
- Per ambienti ad alto rischio si può valutare RLS come ulteriore livello di difesa.

### Pagamenti (PCI-DSS)

- Si usa **Stripe Checkout** (reindirizzamento): numeri di carta e CVC **non** transitano né vengono memorizzati sui nostri server.
- I **webhook** Stripe sono verificati con firma (`STRIPE_WEBHOOK_SECRET`).

### Segreti e chiavi API

- Chiavi **Anthropic**, **Stripe**, **Clerk secret**, **webhook**, ecc. sono lette solo **lato server** tramite variabili d’ambiente validate in `src/config/unifiedConfig.ts`.
- Non committare file `.env`; usare `.env.example` come riferimento e secret manager in produzione (es. Vercel Environment Variables).

### Content Security Policy (CSP) e header HTTP

- Definiti in `src/lib/security-headers.ts` e applicati da `next.config.ts` (`headers()`).
- In caso di nuovi script o domini (es. nuovo provider analytics), aggiornare la CSP di conseguenza e verificare in staging.

### Output AI e integrità

- Gli itinerari generati sono validati con **Zod** prima del salvataggio (`generate-itinerary` e servizi correlati).
- Il prompt di “riparazione” JSON usa un **frammento troncato** della risposta precedente e istruzioni esplicite per non eseguire contenuti malevoli incorporati nell’output (mitigazione prompt injection).

### Geolocalizzazione

- Il GPS opzionale usa le API del browser (`navigator.geolocation`); le coordinate sono **arrotondate** prima dell’invio al backend e nei prompt verso Anthropic (`src/lib/geo-privacy.ts`). È richiesto un **consenso esplicito** in sessione prima della prima acquisizione (modale in `trip-detail-client`).
- Non sostituisce un’informativa privacy: gli utenti devono essere informati nel documento legale del prodotto.

### Diritti degli interessati (API)

- **Export dati:** `GET /api/user/data-export` (sessione Clerk) — JSON completo per portabilità.
- **Cancellazione account:** `POST /api/user/delete-account` con body `{ "confirm": "DELETE_MY_ACCOUNT" }` — ordine: Stripe (customer) → database (cascade) → Clerk (utente).

### Conservazione (retention)

- Variabili `RETENTION_INACTIVE_TRIP_VERSION_DAYS` e `RETENTION_SOFT_DELETED_TRIP_DAYS` in `unifiedConfig` (default 365 / 90 giorni).
- Job Inngest `data-retention-purge` (cron settimanale) elimina versioni itinerario inattive vecchie e trip **soft-deleted** oltre la soglia.

## Logging e osservabilità

- I log strutturati (`src/lib/observability.ts`) **non** devono contenere email o altri PII in chiaro in produzione: usare offuscamento (es. `redactEmail` in `src/lib/redact-pii.ts`).
- Gli errori possono includere stack trace: evitare di serializzare oggetti utente completi nei contesti di log.

## Fornitori e responsabilità condivise

L’applicazione si affida a fornitori cloud/SaaS. La sicurezza complessiva include:

- **Vercel** (hosting, HTTPS)
- **Clerk** (auth)
- **Stripe** (pagamenti)
- **Inngest** (code asincrono)
- **Anthropic** (inferenza)
- **PostgreSQL** (dati persistenti, gestito dal provider scelto, es. Neon/Vercel Postgres)

Consultare privacy policy e DPA di ciascun fornitore per retention, sottoprocessori e sedi dei dati.

## Segnalazione vulnerabilità (responsible disclosure)

1. **Non** aprire issue pubbliche con dettagli sfruttabili prima di una correzione concordata.
2. Inviare una descrizione a un indirizzo di contatto security del progetto (da impostare: es. `security@tuodominio.com` o casella del maintainer).
3. Includere: impatto stimato, passi per riprodurre, componente affetto (es. API `/api/...`), eventuale proof-of-concept non distruttivo.
4. Impegno a: rispondere entro tempi ragionevoli, tenere riservate le segnalazioni fino a fix o deadline concordata, riconoscere (se desiderato) i ricercatori nella changelog di sicurezza.

## Checklist pre-deploy (es. Vercel)

- [ ] Variabili d’ambiente di produzione impostate e allineate a `.env.example` (nessun segreto nel codice).
- [ ] `APP_BASE_URL` punta al dominio pubblico HTTPS.
- [ ] Webhook Stripe puntano all’URL produzione e secret aggiornato.
- [ ] App Inngest collegata all’endpoint `/api/inngest` in produzione.
- [ ] Clerk: domini autorizzati e chiavi live vs test.
- [ ] Smoke test: login, creazione trip, checkout test (se applicabile), generazione itinerario.
- [ ] Verificare che i log non espongano PII dopo le ultime modifiche.

## Roadmap sicurezza (non esaustiva)

- Hardening continuo della CSP (es. nonce per script) se la policy del traffico lo consente.
- Test automatizzati per **IDOR** su risorse con `tripId`.
- Scansione dipendenze (CI) e aggiornamenti tramite Dependabot.
- Valutazione **RLS** PostgreSQL se il modello di minaccia lo richiede.

## Riferimenti nel codice

- Config ambiente: `src/config/unifiedConfig.ts`
- Header sicurezza: `src/lib/security-headers.ts`
- Offuscamento PII log: `src/lib/redact-pii.ts`
- Middleware auth: `src/middleware.ts`
- Webhook Stripe: `src/server/services/billing/billingService.ts`
- Generazione itinerario: `src/lib/inngest/functions/generate-itinerary.ts`

---

_Ultimo aggiornamento: allineato alle modifiche di sicurezza del repository (CSP, log PII, repair prompt)._
