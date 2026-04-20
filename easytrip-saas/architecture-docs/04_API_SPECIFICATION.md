# 04 — API: Route Handlers e contratto REST

| Documento | Percorso |
|-----------|----------|
| Indice | [README_00.md](../README_00.md) |
| Validazione | [05_VALIDATION_ZOD.md](05_VALIDATION_ZOD.md) |
| Pagamenti | [07_PAYMENTS_STRIPE.md](07_PAYMENTS_STRIPE.md) |

## 1. Modello di esposizione

- Le mutazioni e le query lato server sono implementate come **Route Handlers** in `src/app/api/**/route.ts`.
- **Non** sono presenti direttive `"use server"` né **Server Actions** nel codice: le form e i client invocano le API via `fetch` (o equivalente).

## 2. Contratto strutturato OpenAPI (fonte canonica)

| Artefatto | Percorso | Versione `info.version` |
|-----------|----------|-------------------------|
| Specifica OpenAPI 3.0.3 | [`docs/openapi.yaml`](../docs/openapi.yaml) | Allineata nel file (`1.1.0` o successiva) |

**Ruolo del file YAML**

- Descrive **path**, **metodi HTTP**, **tag**, **parametri path**, **schemi request/response** (`components/schemas`) e **sicurezza** (`clerkSession`).
- Il campo `info.description` riassume autenticazione, eccezioni pubbliche e rimanda a questo documento per il contesto d’architettura.
- `externalDocs` nel YAML punta a **questo file** (`../architecture-docs/04_API_SPECIFICATION.md`) per la documentazione narrativa e l’inventario allineato al codice.

**Uso consigliato**

- Integrazione client: generare tipi/SDK da `docs/openapi.yaml` con generator compatibili OpenAPI 3 (verificare sempre contro l’implementazione reale).
- Review contratti: aggiornare prima il codice (`route.ts`, validator Zod), poi **sincronizzare** `openapi.yaml` e questa pagina.

**Collegamenti incrociati**

```text
docs/openapi.yaml  ←──externalDocs──→  architecture-docs/04_API_SPECIFICATION.md
        │                                        │
        └──────────── stesso inventario route ──┘
```

## 3. Inventario Route Handlers (estrazione codice)

| Metodo | Path | Note |
|--------|------|------|
| GET | `/api/trips` | Risposta `200`: `{ ok: true, data: TripListItem[] }` — campi in [§3.1](#31-risposta-get-apitrips-triplistitem) |
| POST | `/api/trips` | Creazione trip; body `CreateTripBody` (`docs/openapi.yaml`) |
| GET, DELETE | `/api/trips/[tripId]` | Dettaglio / soft-delete |
| POST | `/api/trips/[tripId]/generate` | Coda generazione Inngest; rate limit (429 se Upstash attivo); 401 se non autenticato |
| PATCH | `/api/trips/[tripId]/preferences` | Stile / budget |
| POST | `/api/trips/[tripId]/active-version` | Versione attiva carosello |
| POST | `/api/trips/[tripId]/replace-slot` | Sostituzione slot (AI + GPS) |
| POST | `/api/trips/[tripId]/live-suggest` | Suggerimenti contestuali GPS |
| GET | `/api/trips/[tripId]/invite` | Link invito |
| GET, POST | `/api/trips/[tripId]/expenses` | Spese |
| DELETE | `/api/trips/[tripId]/expenses/[expenseId]` | Rimozione spesa |
| GET | `/api/trips/[tripId]/balances` | Bilanci |
| POST | `/api/trips/[tripId]/archive` | Archiviazione |
| POST | `/api/billing/checkout` | Sessione Stripe acquisto |
| POST | `/api/billing/regen-checkout` | Checkout rigenerazione |
| POST | `/api/billing/reactivate-checkout` | Riattivazione accesso |
| POST | `/api/webhooks/stripe` | Webhook (body raw, firma) |
| GET, POST | `/api/join/[token]` | Ingresso gruppo |
| GET, POST | `/api/support` | Ticket |
| GET, POST | `/api/support/[ticketId]` | Dettaglio / messaggi |
| POST | `/api/support/[ticketId]/resolve` | Risoluzione |
| GET | `/api/referral` | Codice referral |
| POST | `/api/referral/track` | Tracciamento |
| GET | `/api/user/data-export` | Export GDPR |
| POST | `/api/user/delete-account` | Cancellazione account (`confirm: DELETE_MY_ACCOUNT`) |
| GET, POST, PUT | `/api/inngest` | Sync funzioni Inngest (non per client finali) |

### 3.1. Risposta GET `/api/trips` (TripListItem)

Ogni elemento di `data` corrisponde al DTO `TripListItem` in [`docs/openapi.yaml`](../docs/openapi.yaml) (`components.schemas.TripListItem`). Include viaggi di cui l’utente è organizzatore e, se applicabile, viaggi condivisi come membro del gruppo.

| Campo | Tipo | Note |
|--------|------|------|
| `id` | string | ID Prisma (cuid) |
| `destination` | string | Destinazione |
| `tripType` | `solo` \| `coppia` \| `gruppo` | |
| `status` | string | Workflow (es. `pending`, `active`, `expired`, `cancelled`) |
| `startDate` | string (ISO date-time) | Inizio viaggio |
| `endDate` | string (ISO date-time) | Fine viaggio |
| `accessExpiresAt` | string (ISO date-time) | Scadenza accesso contenuti |
| `regenCount` | integer | Contatore rigenerazioni |
| `currentVersion` | integer | Versione corrente carosello |
| `activeDays` | integer | Giorni nella versione attiva dell’itinerario (`0` se non ancora generato) |
| `isPaid` | boolean | `true` se `amountPaid` valorizzato sul trip |
| `localPassCityCount` | integer (0–30) | Add-on **LocalPass** per questo viaggio: numero di città scelte in creazione (`0` = assente). Stesso significato del campo omonimo nel dettaglio `GET /api/trips/{tripId}`; esposto in lista per UI (badge) e client API. |

## 4. Autenticazione

- La maggior parte delle route trip/billing/user richiede sessione **Clerk** (cookie / header secondo configurazione SDK).
- Eccezioni tipiche: webhook Stripe (firma), join con token, alcune GET di invito (verificare handler per policy esatta).

## 5. Formato risposta

- Pattern JSON consolidato (`{ ok, data | error }`) — verificare i controller per ogni endpoint; OpenAPI documenta i codici HTTP principali.

## 6. Riferimenti

- Controller: `src/server/controllers/*`
- `src/server/di/container.ts` — wiring dipendenze
- Contratto machine-readable: [`docs/openapi.yaml`](../docs/openapi.yaml)
