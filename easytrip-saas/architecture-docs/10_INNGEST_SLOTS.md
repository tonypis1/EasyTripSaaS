# 10 — Inngest, sostituzione slot e GPS

| Documento     | Percorso                                   |
| ------------- | ------------------------------------------ |
| Indice        | [README_00.md](../README_00.md)            |
| Architettura  | [02_ARCHITECTURE.md](02_ARCHITECTURE.md)   |
| Osservabilità | [11_OBSERVABILITY.md](11_OBSERVABILITY.md) |

## 1. Client e endpoint

- Client: `src/lib/inngest/client.ts`
- Endpoint sync: `src/app/api/inngest/route.ts` — `serve()` con funzioni esportate; metodi `GET`, `POST`, `PUT` per handshake Inngest.

## 2. Eventi di dominio rilevanti

| Evento                    | Emesso da                                     | Effetto                          |
| ------------------------- | --------------------------------------------- | -------------------------------- |
| `trip/generate.requested` | Webhook Stripe (post-pagamento), flussi regen | Avvio catena `generateItinerary` |

## 3. Funzione `generateItinerary`

- File: `src/lib/inngest/functions/generate-itinerary.ts`
- Passi tipici: carica snapshot trip → Anthropic (`anthropic.messages.create`) → validazione JSON → upsert `TripVersion` / `Day` → email “itinerary ready” se configurato.
- Modello default: da `config.ai.anthropicModel` (`claude-sonnet-5` se env assente).
- Output vincolato con Structured Outputs (`output_config.format`, schema derivato da `ModelResponseSchema` in `src/lib/ai/structured-output.ts`): la struttura JSON è garantita dall'API; il loop di riparazione resta per gli errori di business logic (es. numero di giorni) e i limiti di valore che lo schema non può esprimere. Il modello configurato deve supportare gli Structured Outputs.

## 4. Altre funzioni registrate

Vedi [02_ARCHITECTURE.md](02_ARCHITECTURE.md) per elenco: scadenze trip, reminder, retention, follow-up.

## 5. Sostituzione slot (GPS / AI)

- **Service**: `src/server/services/trip/slotReplaceService.ts`
- **API**: `POST /api/trips/[tripId]/replace-slot`
- **Input** (`replaceSlotSchema`): `dayId`, `slot` (`morning` | `afternoon` | `evening`), `lat` / `lng` opzionali.
- **Comportamento**: costruisce contesto dal giorno corrente (slot JSON), chiama Anthropic, valida risposta con `EnrichedResponseSchema` (sostituto + alternative + note di continuità geografica).
- Coordinate nei contenuti slot: schema `DaySlotSchema` include `lat`, `lng` nullable; `googleMapsQuery` per navigazione.

## 6. Live suggest (posizione obbligatoria)

- **Service**: `LiveSuggestService`
- **API**: `POST /api/trips/[tripId]/live-suggest`
- **Input** (`liveSuggestSchema`): `dayId`, `lat`, `lng` **required**, `reason` (enum: closed, crowded, weather, bored, early, other), `currentSlot` opzionale.

## 7. Log e tracciamento job

- Logger strutturato usato nei servizi (cercare `logger` in billing e Inngest).
- **Dashboard Inngest**: tracciamento run, retry e errori lato piattaforma Inngest (configurazione account esterna al repo).

## 8. Test E2E

- `tests/e2e/slot-replace-geolocation.spec.ts` — scenario geolocalizzazione slot (richiede env E2E).
