# EasyTrip SaaS — Documento tecnico per l’informativa sulla privacy

> **Scopo di questo file:** descrivere in modo **tecnico e verificabile** quali dati l’applicazione EasyTrip (`easytrip-saas`) raccoglie, elabora e conserva, in base al codice sorgente (Prisma, API, integrazioni).  
> **Non è consulenza legale.** I testi rivolti all’utente finale (informativa breve, policy completa, cookie banner, basi giuridiche, trasferimenti extra-UE, rappresentante UE, ecc.) vanno redatti o validati da un professionista abilitato.

---

## 1. Mappatura dati (Data Map)

I dati sotto sono organizzati per **origine** e **destinazione di conservazione** (database PostgreSQL via Prisma, salvo dove indicato).

### 1.1 Identità e account (Clerk → applicazione)

| Dato / categoria               | Dove viene memorizzato                 | Note tecniche                                                                                          |
| ------------------------------ | -------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| Identificativo Clerk           | `User.clerkUserId`                     | Collegamento univoco tra sessione Clerk e record applicativo.                                          |
| Email                          | `User.email`                           | Sincronizzata con l’account; usata per account, fatturazione e comunicazioni coerenti con il prodotto. |
| Nome (opzionale)               | `User.name`                            | Profilo utente.                                                                                        |
| Piano / abbonamento (metadati) | `User.planType`, `User.subExpiresAt`   | Informazioni di prodotto legate al billing.                                                            |
| Cliente Stripe (riferimento)   | `User.stripeCustomerId`                | **Non** sono memorizzati numeri di carta sul database dell’app; Stripe gestisce i dati di pagamento.   |
| Saldo crediti                  | `User.creditBalance`                   | Valore monetario dei crediti utente.                                                                   |
| Codice referral                | `User.referralCode`, `User.referredBy` | Programma inviti.                                                                                      |

**Clerk** gestisce autenticazione, sessioni e profilo lato provider; l’app conserva una copia minimale in `User` per logiche di business (itinerari, pagamenti, referral).

### 1.2 Itinerari e contenuti di viaggio

| Dato / categoria                | Dove viene memorizzato                                                                                     | Note tecniche                                                                                                                            |
| ------------------------------- | ---------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Metadati viaggio                | `Trip` (destinazione, date, tipo, stile, budget, stato, scadenze accesso, token invito, soft-delete, ecc.) | Nucleo del prodotto.                                                                                                                     |
| Versioni itinerario (carosello) | `TripVersion`                                                                                              | Storico versioni generate; una versione può essere contrassegnata come attiva.                                                           |
| Giorni e contenuti              | `Day`                                                                                                      | Testi attività (campi serializzati/JSON), titoli, **coordinate centro mappa POI** (`mapCenterLat` / `mapCenterLng`), zone, suggerimenti. |
| Membri e ruoli                  | `TripMember`                                                                                               | Collegamento utente–viaggio, ruolo (organizzatore/membro), saldi spese.                                                                  |
| Spese di gruppo                 | `Expense`                                                                                                  | Importi, descrizioni, categorie, chi ha pagato.                                                                                          |

**Coordinate nel database:** sono associate ai **contenuti dell’itinerario** (es. centro mappa per POI giornata), non alla posizione GPS dell’utente in tempo reale.

### 1.3 Pagamenti e crediti

| Dato / categoria | Dove viene memorizzato | Note tecniche                                                                                                               |
| ---------------- | ---------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| Pagamenti        | `Payment`              | Tipo (`purchase`, `regen`, `reactivate`), importo, riferimenti Stripe (`stripePaymentId`), collegamento opzionale a `Trip`. |
| Crediti          | `Credit`               | Importo, scadenza, utilizzo, collegamenti opzionali a viaggi.                                                               |

### 1.4 Supporto e referral

| Dato / categoria | Dove viene memorizzato            | Note tecniche                                                                                |
| ---------------- | --------------------------------- | -------------------------------------------------------------------------------------------- |
| Ticket supporto  | `SupportTicket`, `SupportMessage` | Oggetto, stato, canale; messaggi testuali; opzionale `crispSessionId` se integrazione Crisp. |
| Referral         | `Referral`                        | Email invitato, stato, collegamenti a utenti/crediti.                                        |

### 1.5 Waitlist (landing / marketing)

| Dato / categoria | Dove viene memorizzato | Note tecniche                                             |
| ---------------- | ---------------------- | --------------------------------------------------------- |
| Email waitlist   | `WaitlistEntry`        | Indirizzo univoco; contatore sequenza email (`dripSent`). |

### 1.6 Posizione GPS dell’utente (non persistita nello schema)

| Flusso                                                          | Trattamento                                                                                                                                                                                                                   |
| --------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Sostituzione slot** (`POST /api/trips/[tripId]/replace-slot`) | Coordinate opzionali inviate dal browser nel corpo della richiesta; il backend le **arrotonda** (riduzione precisione) prima dell’invio al modello AI; **non** risultano campi dedicati nello schema Prisma per “GPS utente”. |
| **Suggerimenti live** (`POST /api/trips/[tripId]/live-suggest`) | Stesso approccio: coordinate nella richiesta, arrotondamento per AI; **non** persistenza come tracciamento storico nel DB.                                                                                                    |

### 1.7 Dati inviati ad Anthropic (Claude API)

- **Generazione / rigenerazione itinerario (job asincrono):** il prompt è costruito da dati di viaggio (destinazione, calendario, tipo viaggio, stile, budget, zone già usate, ecc.) e produce JSON di itinerario con **luoghi/POI** (coordinate di punti di interesse nel contenuto generato, non posizione utente).
- **Sostituzione slot e suggerimenti live:** il prompt include **coordinate già ridotte di precisione** (arrotondamento a 3 decimali lato applicazione, ordine di grandezza ~100 m) quando la funzione richiede contesto geografico locale.

L’app **non** invia ad Anthropic l’email o il nome utente come parte obbligata dei prompt di generazione principale documentati nel codice; i trattamenti devono comunque essere descritti nell’informativa legale e coperti da accordi con il fornitore (DPA / SCC se applicabile).

### 1.8 Stripe (pagamenti)

- L’applicazione utilizza le API Stripe per checkout, abbonamenti/acquisti e webhooks.
- **I dati della carta (PAN, CVC, ecc.) non transitano né vengono memorizzati sui server dell’app** secondo il modello standard Stripe: la raccolta avviene lato Stripe (Checkout / Elements secondo implementazione).
- Nel DB restano **metadati di transazione** (importi, ID pagamento Stripe, collegamenti utente/viaggio).

### 1.9 Inngest (code orchestration)

- Eventi usati per job in background (es. generazione itinerario, retention, waitlist drip).
- Il payload dell’evento waitlist invia solo `waitlistEntryId`; l’email per le email transazionali viene letta dal **database** nella funzione dedicata (minimizzazione PII nel message broker).

### 1.10 PostHog (analytics)

- Eventi lato client (es. creazione viaggio, checkout, sostituzione slot, suggerimento live, spese).
- Per le funzioni sensibili alla posizione, gli eventi pertinenti sono progettati per **non includere latitudine/longitudine precise** (es. flag `hadGps` anziché coordinate complete ove applicabile nel codice).

### 1.11 Resend (email transazionali)

- Invio email (es. sequenza waitlist, notifiche di prodotto dove implementato). Richiede indirizzo destinatario e contenuto; configurazione tramite variabili d’ambiente.

### 1.12 Crisp (chat di supporto, se abilitato)

- Identificativo sito lato client; sessione chat può essere collegata a `SupportTicket` tramite `crispSessionId` ove previsto.

---

## 2. Finalità del trattamento (motivazione tecnica)

| Area                                                  | Perché il dato è necessario                                                                                                                                                                                                           |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Account (Clerk + `User`)**                          | Registrare l’utente, proteggere l’area riservata `/app`, associare itinerari e pagamenti a un soggetto univoco.                                                                                                                       |
| **Itinerari (`Trip`, `TripVersion`, `Day`)**          | Erogare il servizio core: generazione, consultazione, versionamento, condivisione tramite token di invito.                                                                                                                            |
| **Coordinate POI in `Day`**                           | Mostrare mappe e contenuti legati a luoghi pubblici nell’itinerario; non costituiscono tracciamento GPS dell’utente.                                                                                                                  |
| **GPS nella richiesta (replace-slot / live-suggest)** | Migliorare la pertinenza delle proposte AI in base alla zona corrente; le coordinate sono **limitate in precisione** prima dell’invio al fornitore AI e **non sono persistite** come “cronologia posizioni” nello schema documentato. |
| **Consenso locale (browser)**                         | Memorizzazione in `sessionStorage` della chiave `easytrip_gps_ai_consent_v1` per ricordare l’accordo all’uso della posizione per finalità AI nella sessione (comportamento implementato nel client).                                  |
| **Pagamenti (Stripe)**                                | Incassare corrispettivi, gestire rigenerazioni/riattivazioni; conservare provvisti minimi in `Payment` per contabilità/reconciliation.                                                                                                |
| **Crediti**                                           | Gestire premi referral e utilizzo crediti sui viaggi.                                                                                                                                                                                 |
| **Spese di gruppo**                                   | Calcolare e visualizzare bilanci tra partecipanti.                                                                                                                                                                                    |
| **Supporto**                                          | Gestire richieste e storico messaggi.                                                                                                                                                                                                 |
| **Referral**                                          | Attribuire inviti e ricompense.                                                                                                                                                                                                       |
| **Waitlist**                                          | Contattare chi ha lasciato l’email in lista d’attesa secondo le finalità dichiarate in landing/iscrizione.                                                                                                                            |
| **Inngest**                                           | Esecuzione affidabile di processi lunghi o schedulati senza esporre PII in più del necessario negli eventi.                                                                                                                           |
| **PostHog**                                           | Misurare utilizzo prodotto e funnel; configurazione con host EU/US secondo variabili d’ambiente.                                                                                                                                      |

---

## 3. Terze parti (sub-processors) e ruoli

| Fornitore                                      | Ruolo tecnico                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| ---------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Clerk**                                      | Gestione identità, autenticazione, sessioni; bridge con `User` tramite `clerkUserId`.                                                                                                                                                                                                                                                                                                                                                           |
| **Stripe**                                     | Elaborazione pagamenti; **dati di carta** gestiti da Stripe; l’app conserva ID cliente (`stripeCustomerId`) e metadati transazione.                                                                                                                                                                                                                                                                                                             |
| **Anthropic**                                  | Elaborazione linguistica per generazione itinerari, sostituzione slot e suggerimenti live. I contenuti inviati sono **limitati al necessario**; le coordinate utente, ove presenti, sono **arrotondate** (non invio a piena precisione del dispositivo). **Non equivale a “anonimizzazione completa”**: gli identificativi diretti dell’utente non devono essere inclusi nei prompt ove evitabile; la valutazione giuridica spetta al Titolare. |
| **Inngest**                                    | Orchestrazione di workflow asincroni (generazione itinerario, promemoria, retention, drip waitlist, ecc.); payload minimizzati ove possibile (es. solo `waitlistEntryId` per la waitlist).                                                                                                                                                                                                                                                      |
| **PostgreSQL** (hosting dipendente dal deploy) | Persistenza dati applicativi tramite Prisma.                                                                                                                                                                                                                                                                                                                                                                                                    |
| **PostHog**                                    | Analytics prodotto; eventi configurati nel client.                                                                                                                                                                                                                                                                                                                                                                                              |
| **Resend**                                     | Invio email transazionali/drip.                                                                                                                                                                                                                                                                                                                                                                                                                 |
| **Crisp**                                      | Chat di supporto (se `NEXT_PUBLIC_CRISP_WEBSITE_ID` configurato).                                                                                                                                                                                                                                                                                                                                                                               |

_Elenco da integrare con contratti/DPA effettivi e regione di hosting scelti in produzione._

---

## 4. Conservazione (retention) — logica implementata

I tempi predefiniti sono configurabili tramite variabili d’ambiente (vedi `src/config/unifiedConfig.ts`):

| Parametro                              | Default (codice) | Comportamento                                                                                                                                                                                              |
| -------------------------------------- | ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `RETENTION_INACTIVE_TRIP_VERSION_DAYS` | **365**          | Le righe `TripVersion` con `isActive: false` e `generatedAt` anteriore alla soglia possono essere **eliminate** dal job di retention (cron settimanale).                                                   |
| `RETENTION_SOFT_DELETED_TRIP_DAYS`     | **90**           | I `Trip` con `deletedAt` valorizzato e oltre la soglia possono essere **cancellati definitivamente** (hard delete), con aggiornamento dei riferimenti opzionali su pagamenti/crediti collegati al viaggio. |

Altri elementi rilevanti:

- **Soft-delete del viaggio:** il campo `Trip.deletedAt` mantiene il record per un periodo prima della purge; motivazioni possono includere obblighi contabili legati ai `Payment` (da definire con il legale).
- **Scadenza accesso viaggio:** logica di stato (es. `TripStatus.expired`) gestita da processi separati (es. job Inngest `expire-trips`) distinti dalla purge GDPR sopra.
- **Account utente:** cancellazione tramite API di oblio (vedi sezione 5) esegue eliminazione su Stripe (cliente), database (cascade su dati collegati a `User`) e Clerk.

---

## 5. Esercizio dei diritti (portabilità e oblio) — API implementate

Le route sono pensate per utenti **autenticati** (sessione Clerk). L’integrazione in UI (pulsanti “Scarica i miei dati” / “Elimina account”) è opzionale e separata.

### 5.1 Portabilità (export dati)

- **Metodo / percorso:** `GET /api/user/data-export`
- **Risposta:** JSON strutturato con allegato suggerito `Content-Disposition` (`easytrip-data-export-<userId>.json`).
- **Contenuto (indicativo):** profilo utente, viaggi organizzati (con versioni e giorni), membership, crediti, pagamenti, ticket di supporto con messaggi, referral inviati/ricevuti — allineato a `UserDataService.exportAllDataForUserId`.

### 5.2 Cancellazione account (diritto all’oblio)

- **Metodo / percorso:** `POST /api/user/delete-account`
- **Corpo richiesta (JSON):** `{ "confirm": "DELETE_MY_ACCOUNT" }`  
  La frase esatta è obbligatoria per evitare cancellazioni accidentali.
- **Ordine operativo implementato:** tentativo di eliminazione cliente **Stripe** (se presente `stripeCustomerId`) → eliminazione record **`User`** su Prisma (cascade sulle relazioni definite nello schema) → eliminazione utente **Clerk** via API.

Dopo la cancellazione, l’utente non potrà più accedere con la sessione precedente; eventuali backup o log lato infrastruttura vanno disciplinati dalla policy aziendale e dal contratto di hosting.

---

## 6. Riferimenti di implementazione (audit interno)

| Area                                    | Percorsi utili nel repo                                                                                                                               |
| --------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| Schema dati                             | `prisma/schema.prisma`                                                                                                                                |
| Retention automatica                    | `src/lib/inngest/functions/data-retention.ts`                                                                                                         |
| Export / cancellazione                  | `src/server/services/privacy/userDataService.ts`, `src/app/api/user/data-export/route.ts`, `src/app/api/user/delete-account/route.ts`                 |
| Arrotondamento coordinate AI            | `src/lib/geo-privacy.ts`                                                                                                                              |
| Servizi AI                              | `src/lib/inngest/functions/generate-itinerary.ts`, `src/server/services/trip/slotReplaceService.ts`, `src/server/services/trip/liveSuggestService.ts` |
| Waitlist / Inngest                      | `src/app/api/waitlist/route.ts`, `src/lib/inngest/functions/waitlist-drip.ts`                                                                         |
| Impostazioni Clerk (checklist)          | `docs/CLERK_PRIVACY_SETTINGS.md`                                                                                                                      |
| Registro trattamenti (supporto tecnico) | `npm run privacy:ropa`                                                                                                                                |

---

_Ultimo aggiornamento strutturale: allineato alla codebase `easytrip-saas` (documento generato per supporto legal-tech e revisione policy)._
