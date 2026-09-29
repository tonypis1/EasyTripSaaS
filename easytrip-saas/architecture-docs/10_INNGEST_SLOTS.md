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
- Passi tipici: carica snapshot trip → **grounding** (`ground-destination`) → Anthropic (`anthropic.messages.create`) → validazione JSON → upsert `TripVersion` / `Day` → email “itinerary ready” se configurato.
- **Grounding “EasyTrip Verified”** (`GroundingService`, `src/server/services/trip/groundingService.ts`): prima di generare, aree/attrazioni/ristoranti della destinazione vengono verificati via tool `web_search` e messi in `VerifiedPoiCache` (condivisa tra utenti, TTL `VERIFIED_POI_TTL_DAYS`); i luoghi entrano nella parte stabile (cacheable) del prompt come blocco “FONTI VERIFICATE”. Non fatale: qualunque errore → si genera come prima, senza fonti. Kill switch: `VERIFIED_GROUNDING_ENABLED=false`. Lo step `log-grounding-coverage` registra quanti POI/ristoranti generati compaiono tra quelli verificati (copertura bassa sui ristoranti = probabile invenzione di nomi).
- **GeoScore calcolato** (step `calcola-geo-score`, `src/lib/geo-optimization.ts`): il punteggio salvato su `TripVersion.geoScore` non è quello che il modello dichiara (`optimizationScore`, nessuno lo verifica) ma il risultato di un'analisi delle coordinate degli slot. Per ogni giorno: 65% compattezza (distanza media tra tappe consecutive, ≤ 1 km = pieno, ≥ 15 km = zero) + 35% efficienza dell'ordine (confronto con il miglior ordine possibile delle stesse tappe, ricerca esatta: max 3 tappe/giorno). Guardrail: coordinate mancanti, fuori range, `(0, 0)` o tutte coincidenti (copiate) escludono il giorno dal punteggio; sotto il 50% di giorni valutabili si ripiega sul valore dichiarato. Lo step logga `declared`/`computed`/`delta` (telemetria del confronto). Limiti: distanze in linea d'aria e scala tarata su spostamenti cittadini (un giorno di escursione in auto tra borghi lontani viene penalizzato).
- **Preferenze strutturate** (`src/lib/trip/preferences.ts`): il blocco `SEZIONE — PREFERENZE DEL VIAGGIATORE` (interessi, ritmo, mobilità, restrizioni alimentari) sta nella parte stabile/cacheable del prompt, in ordine canonico, e non compare se l'utente non ha scelto nulla (prompt invariato). Le restrizioni alimentari sono un **contratto verificato**: ogni ristorante deve dichiarare in `dietaryFit` le restrizioni che soddisfa (un locale vegano soddisfa anche "vegetariano"); se un ristorante non le dichiara, il primo tentativo viene rifiutato con il motivo e passa dal ciclo di riparazione. Nella risposta riparata il risultato si accetta comunque (con un `logger.warn` con il solo conteggio): in una destinazione piccola può non esistere un locale per ogni pasto e un itinerario già pagato non deve fallire per un vincolo morbido — la UI mostra "da verificare" sui locali non confermati. `dietaryFit` è **auto-dichiarato dal modello**: lo step `log-preferences-fit` registra (solo conteggi) quanti ristoranti non lo dichiarano e quanti hanno nome/cucina in apparente conflitto (euristica multilingue, solo telemetria) per capire quanto ci si può fidare. Le allergie non generano un contratto (l'AI non può garantirle): il prompt chiede cautela e la UI mostra un avviso fisso.
- Modello default: da `config.ai.anthropicModel` (`claude-sonnet-5` se env assente).
- Output vincolato con Structured Outputs (`output_config.format`, schema derivato da `ModelResponseSchema` in `src/lib/ai/structured-output.ts`): la struttura JSON è garantita dall'API; il loop di riparazione resta per gli errori di business logic (es. numero di giorni) e i limiti di valore che lo schema non può esprimere. Il modello configurato deve supportare gli Structured Outputs.

## 4. Altre funzioni registrate

Vedi [02_ARCHITECTURE.md](02_ARCHITECTURE.md) per elenco: scadenze trip, reminder, retention, follow-up.

## 5. Sostituzione slot (GPS / AI)

- **Service**: `src/server/services/trip/slotReplaceService.ts`
- **API**: `POST /api/trips/[tripId]/replace-slot`
- **Input** (`replaceSlotSchema`): `dayId`, `slot` (`morning` | `afternoon` | `evening`), `lat` / `lng` opzionali.
- **Comportamento**: costruisce contesto dal giorno corrente (slot JSON), chiama Anthropic, valida risposta con `EnrichedResponseSchema` (sostituto + alternative + note di continuità geografica).
- **Alternative**: ogni alternativa è uno **slot completo** (`slot: DaySlotSchema`, più `distance` e `note`), non solo un nome: può quindi essere applicata così com'è allo slot. La risposta include `proposalId` (bozza di votazione) solo se il viaggio ha almeno 2 membri; se la creazione della bozza fallisce la sostituzione va comunque a buon fine (`proposalId: null`).
- **Preferenze**: il prompt include lo stesso blocco (senza il contratto `dietaryFit`), così un'alternativa rispetta mobilità, ritmo e restrizioni scelti per il viaggio; vale anche per il live suggest (§6).
- **GeoScore**: dopo aver salvato lo slot, `GeoScoreService.refreshForVersion` ricalcola e riscrive `TripVersion.geoScore` dai giorni correnti (stesso ricalcolo quando un'alternativa votata viene applicata, anche dal cron di scadenza). Best-effort: un errore non fa fallire la sostituzione già applicata.
- Coordinate nei contenuti slot: schema `DaySlotSchema` include `lat`, `lng` nullable; `googleMapsQuery` per navigazione.

### 5.1 Group voting sulle alternative

- **Service**: `SlotProposalService` (apertura / voto / chiusura), `SlotProposalResolver` (chiusura e applicazione dell'opzione allo slot; usato anche dal cron), repository `SlotProposalRepository`. Regola di decisione pura in `src/lib/slot-vote.ts`.
- **API**: `POST /api/trips/[tripId]/slot-proposals/[proposalId]/{open|vote|close}`.
- **Flusso**: `replace-slot` → bozza (`draft`) → l'organizzatore apre la votazione ("Fai votare il gruppo") → ogni membro vota (voto modificabile) → chiusura.
- **Regola**: vince un'opzione con la **maggioranza stretta di tutti i membri** oppure, quando hanno votato tutti, quella in testa. A parità resta lo slot attuale (indice 0). L'organizzatore può chiudere prima; dopo 24h chiude il cron con l'opzione in testa (senza voti: attuale).
- **Sicurezza**: il `tripId` dell'URL deve coincidere con quello reale della proposta; solo i membri votano, solo l'organizzatore apre/chiude; il contenuto applicato allo slot viene dal database (mai dal client) ed è rivalidato con `SlotProposalOptionsSchema`.
- **Job**: `slot-proposal-expiry` (cron `0 * * * *`).
- **Limiti noti**: nessuna notifica push/email ai membri all'apertura della votazione (la vedono aprendo il viaggio).

## 6. Live suggest (posizione obbligatoria)

- **Service**: `LiveSuggestService`
- **API**: `POST /api/trips/[tripId]/live-suggest`
- **Input** (`liveSuggestSchema`): `dayId`, `lat`, `lng` **required**, `reason` (enum: closed, crowded, weather, bored, early, other), `currentSlot` opzionale.

## 7. Log e tracciamento job

- Logger strutturato usato nei servizi (cercare `logger` in billing e Inngest).
- **Dashboard Inngest**: tracciamento run, retry e errori lato piattaforma Inngest (configurazione account esterna al repo).

## 8. Test E2E

- `tests/e2e/slot-replace-geolocation.spec.ts` — scenario geolocalizzazione slot (richiede env E2E).
