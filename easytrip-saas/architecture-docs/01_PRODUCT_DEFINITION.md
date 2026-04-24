# 01 — Definizione prodotto

| Documento    | Percorso                                 |
| ------------ | ---------------------------------------- |
| Indice       | [README_00.md](../README_00.md)          |
| Architettura | [02_ARCHITECTURE.md](02_ARCHITECTURE.md) |
| Database     | [03_DATABASE.md](03_DATABASE.md)         |

## 1. Sintesi

EasyTrip è un’applicazione SaaS che genera **itinerari di viaggio in formato strutturato (JSON)** tramite il modello **Anthropic Claude** (`@anthropic-ai/sdk`). L’output viene validato contro uno schema applicativo, persistito come **versioni di itinerario** (`TripVersion` + `Day`) e presentato all’utente con **sblocco giornaliero**, **punteggio geografico** e supporto **mappa** (coordinate su `Day`).

## 2. Proposta di valore

| Dimensione                  | Descrizione                                                                                                                                                                                                                                                                                            |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Generazione AI**          | Prompt di sistema e utente in `generate-itinerary` (Inngest): risposta **solo JSON** validato (`parseAndValidateModelJson`, `itinerary-model-schema`).                                                                                                                                                 |
| **Rigenerazione**           | Fino a 7 versioni per trip (`regenCount`, `currentVersion`); logica business in `trip-regen-rules`; rigenerazioni a pagamento via Stripe (`paymentType: regen`).                                                                                                                                       |
| **GPS / geolocalizzazione** | Coordinate sui giorni (`mapCenterLat`, `mapCenterLng`); **sostituzione slot** con input lat/lng opzionale (`SlotReplaceService`, schema `replaceSlotSchema`); **live suggest** con posizione obbligatoria (`liveSuggestSchema`). Privacy coordinate arrotondate in contesti sensibili (`geo-privacy`). |
| **Gruppo**                  | Tipologie `solo` / `coppia` / `gruppo`; membri, inviti, spese e bilanci (vedi [03_DATABASE.md](03_DATABASE.md)).                                                                                                                                                                                       |

## 3. Segmento target

- **Viaggiatori “tech”**: utenti che accettano flussi web moderni (auth Clerk, checkout Stripe, job asincroni).
- **Organizzatori di piccoli gruppi**: invito tramite token, spese condivise e saldi per membro.

## 4. Confini funzionali (MVP corrente)

- Nessuna app nativa; web responsive Next.js.
- Pagamenti in **EUR**; prezzi configurabili per ambiente (`unifiedConfig.ts`).
- Email transazionali opzionali (Resend) se chiavi presenti.

## 5. Riferimenti codice

| Area            | Percorso                                            |
| --------------- | --------------------------------------------------- |
| Config AI       | `src/config/unifiedConfig.ts` (`ai.anthropicModel`) |
| Job generazione | `src/lib/inngest/functions/generate-itinerary.ts`   |
| Schema giorni   | `src/lib/itinerary-model-schema.ts`                 |
| API generazione | `src/app/api/trips/[tripId]/generate/route.ts`      |
