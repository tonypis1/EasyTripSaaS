# 05 — Validazione con Zod

| Documento | Percorso |
|-----------|----------|
| Indice | [README_00.md](../README_00.md) |
| API | [04_API_SPECIFICATION.md](04_API_SPECIFICATION.md) |
| Design system | [06_DESIGN_SYSTEM.md](06_DESIGN_SYSTEM.md) |

## 1. Principi

- **Configurazione ambiente**: `src/config/unifiedConfig.ts` — `envSchema` con `z.object({...})`; fallimento all’avvio se variabili obbligatorie mancanti o non valide.
- **Input dominio trip**: `src/server/validators/trip.schema.ts` — creazione trip, parametri, preferenze, slot, live suggest.
- **Servizi AI**: schemi dedicati nei servizi (es. `SlotReplaceService` con `DaySlotSchema`, `EnrichedResponseSchema`).

## 2. Schemi trip (estratto)

| Schema | Scopo |
|--------|--------|
| `createTripSchema` | POST creazione: destinazione, date, `tripType`, `style`, `budgetLevel`, `localPassCityCount` |
| `tripIdParamSchema` | Validazione `tripId` |
| `setActiveVersionSchema` | `versionNum` 1..7 |
| `replaceSlotSchema` | `dayId`, `slot` (morning/afternoon/evening), `lat`/`lng` opzionali |
| `updatePreferencesSchema` | `style`, `budgetLevel` |
| `liveSuggestSchema` | `dayId`, `lat`/`lng` obbligatori, `reason`, `currentSlot` opzionale |

## 3. Costanti budget

```typescript
export const BUDGET_LEVELS = ["economy", "moderate", "premium"] as const;
```

Default creazione: `moderate`.

## 4. Validazione output AI

- **Itinerario**: `src/lib/itinerary-model-schema.ts` — parsing JSON modello dopo risposta Anthropic in `generate-itinerary`.
- **Sostituzione slot**: risposta JSON validata con `EnrichedResponseSchema` in `slotReplaceService.ts` (estrazione da fence opzionale tipo fenced code block `json`).

## 5. Errori

- Errori di dominio tipizzati: `AppError` in `src/server/errors/AppError.ts` (usati da services/controllers).

## 6. Riferimenti

| File | Contenuto |
|------|-----------|
| `src/config/unifiedConfig.ts` | Env Zod |
| `src/server/validators/trip.schema.ts` | Trip API |
| `src/server/services/trip/slotReplaceService.ts` | Validazione slot AI |
| `src/lib/itinerary-model-schema.ts` | Modello giorni/itinerario |
