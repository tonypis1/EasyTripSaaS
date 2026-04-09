# EasyTrip — Product specification

Documento consolidato allineato al codice in `easytrip-saas/`. Per presentazione navigabile e screenshot vedi anche [`presentation.html`](../presentation.html) nella root del progetto.

## Visione

EasyTrip offre **itinerari AI strutturati** per weekend e viaggi brevi in Europa: generazione asincrona (Inngest + Anthropic), più versioni per trip, gruppo con inviti, spese condivise e monetizzazione via **Stripe**.

## Problema

- Troppo tempo speso tra ricerche e tab aperte.
- Proposte generiche, poco calibrate su durate brevi (2–5+ giorni).
- Strumenti separati per gruppo e spese sullo stesso viaggio.

## Target

- Viaggiatori che pianificano **weekend e soggiorni brevi in Europa** (coppie, piccoli gruppi, early adopter beta).
- Copy di prodotto orientato IT / Europa (vedi `src/app/page.tsx`).

## User personas

| Persona | Ruolo | Comportamento nel prodotto |
|--------|--------|----------------------------|
| **Elena — Organizzatrice** | Crea il trip | Checkout Stripe, generazione, inviti (`invite_token`), confronto versioni, rigenerazioni. |
| **Marco — Membro** | Partecipa al viaggio | Join via `/join/[token]`, itinerario, spese, saldi (`TripMember.balance`). |
| **Sofia — Power user / beta** | Esplora funzioni avanzate | Sostituzione slot, live suggest, referral, waitlist; sensibile a qualità (`geo_score`, rating versione). |

## Value proposition

1. **Risparmio di tempo** — da preferenze a itinerario strutturato senza copia-incolla manuale.
2. **Output strutturato e persistente** — giorni, slot, mappe (Leaflet), metriche in database.
3. **Controllo e iterazione** — fino a 7 versioni per trip; regole rigenerazione in `src/lib/trip-regen-rules.ts`.
4. **Monetizzazione chiara** — prezzi in centesimi EUR tramite variabili d’ambiente Stripe.

## Funzionalità principali (implementate)

- Autenticazione **Clerk** sull’area `/app`.
- CRUD viaggi, generazione asincrona, versioni, preferenze, soft-delete.
- Pagamenti **Stripe** (checkout + webhook) e tipi `purchase` / `regen` / `reactivate`.
- Gruppo: invito e join; spese con categorie; saldi tra membri.
- Ticket support e messaggi; waitlist e drip **Inngest**.
- Referral con crediti; analytics **PostHog** (client).
- Test E2E **Playwright** (`tests/e2e/`).

## Modello di business

| Voce | Default (env) | Note |
|------|----------------|------|
| Solo / coppia | €9,99 | `STRIPE_PRICE_SOLO_COUPLE_CENTS=999` |
| Gruppo | €14,99 | `STRIPE_PRICE_GROUP_CENTS=1499` |
| Rigenerazione (v5–v7) | €1,99 | `STRIPE_PRICE_REGEN_CENTS=199` |
| Riattivazione post-trip | €2,90 | `STRIPE_PRICE_REACTIVATE_CENTS=290` |

Tipi pagamento Prisma: `purchase`, `regen`, `reactivate`. Crediti e referral: modelli `Credit`, `Referral` con stati `pending → signed_up → converted`. Campi `planType` / `subExpiresAt` sullo user predispongono una futura **subscription**.

## Metriche di successo (suggerite)

| Metrica | Definizione operativa |
|---------|------------------------|
| North Star | Trip con generazione completata e versione attiva (`TripVersion.isActive`). |
| Conversione checkout | Sessioni Stripe completate vs trip `pending → active`. |
| Attach rate rigenerazioni | Pagamenti `regen` / utenti con `regenCount` ≥ 4. |
| Qualità percepita | Distribuzione `geo_score` e `userRating` per versione. |
| Retention post-trip | Tasso pagamenti `reactivate`; crediti usati entro `expiresAt`. |
| Crescita referral | `ReferralStatus.converted` / link condivisi. |

## User stories (legate al codice)

1. Come **organizzatore** voglio pagare e avviare `POST /api/trips/:id/generate` così ricevo un itinerario in `TripVersion` / `Day`.
2. Come **membro** voglio usare `POST /api/join/[token]` per associarmi al trip.
3. Come **utente** voglio cambiare versione attiva con `POST /api/trips/:id/active-version` (max 7 versioni).
4. Come **utente** voglio rigenerazioni gratuite (v2–v4) e a pagamento (v5–v7) secondo `trip-regen-rules` e `regen-checkout`.
5. Come **utente** voglio sostituire uno slot (`replace-slot`) e suggerimenti live (`live-suggest`).
6. Come **partecipante** voglio spese e `GET .../balances`.
7. Come **utente** voglio riaprire un viaggio scaduto (`reactivate-checkout`).
8. Come **beta** voglio iscrivermi in waitlist (`POST /api/waitlist`) e ricevere drip automatizzati.

## MVP scope (checklist repository)

- [x] API Route Handlers sotto `src/app/api/`
- [x] Prisma schema + PostgreSQL
- [x] Inngest: generazione itinerario, scadenze trip, reminder crediti, waitlist drip, pre/post trip
- [x] Dev: `npm run inngest:dev` + `/api/inngest`
- [x] E2E Playwright (signup, checkout, percorsi critici)
- [x] Documentazione aggiuntiva in `docs/desktop-html/`

## OKR (prossimi trimestri — da adattare)

**O1 — Attivazione:** aumentare % trip con almeno una versione generata e attiva entro 24h dal pagamento.

**O2 — Monetizzazione secondaria:** tracciare attach rate rigenerazioni e riattivazioni.

**O3 — Qualità:** monitorare `geo_score` e feedback utente sulle versioni.

---

*Ultimo aggiornamento: allineato al repository EasyTrip SaaS (Next.js App Router, Prisma, Clerk, Stripe, Inngest, Anthropic).*
