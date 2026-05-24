# Product Marketing Context — EasyTripSaaS

_Last updated: 2026-05-09_

---

## Product Overview

**One-liner:**
EasyTripSaaS genera itinerari di viaggio AI per weekend e soggiorni brevi in Europa, con sblocco giornaliero progressivo, mappe ottimizzate e split spese per gruppi.

**What it does:**
L'utente indica destinazione, date e stile di viaggio; l'AI (Anthropic Claude) crea un piano giorno per giorno in 30 secondi. L'itinerario si sblocca giornalmente (giorno 2 è visibile solo il giorno 2), creando engagement continuo durante il viaggio. Il piano include ristoranti locali, gemme nascoste, percorsi ottimizzati geograficamente e integrazione mappa con un click su Google Maps.

**Product category:**
Travel planning SaaS — "generatore di itinerari AI" (come i viaggiatori lo cercano)

**Product type:**
SaaS web-app (Next.js responsive, no app nativa)

**Business model:**

- Pay-per-trip: €3,99 (solo/coppia) · €6,99 (gruppo 3–5 persone)
- Abbonamento: €6,99/mese (trip solo/coppia illimitati)
- Add-on: LocalPass €3,99/città (contenuti insider locali)
- Extra: rigenerazione extra €1,99 · riattivazione accesso €2,90
- Referral: invita 1 amico → 1 trip gratis (€3,99 in credito)
- Sconto retention: −20% al prossimo viaggio se il precedente è finito negli ultimi 7 giorni

---

## Target Audience

**Target users:**
Viaggiatori italiani/europei digitali, 25–45 anni, abituati a fare acquisti online, che pianificano weekend o soggiorni brevi (2–5+ giorni) in Europa.

**Profili principali:**

- Viaggiatore frequente solo o in coppia (piano core €3,99 o abbonamento €6,99/mese)
- Organizzatore di piccoli gruppi (3–5 amici, piano gruppo €6,99)
- "Anti-tourista" (cerca esperienze locali autentiche, non trappole per turisti → LocalPass)

**Decision-makers:**
Chi prenota e paga (coincide con l'utente finale); in contesto gruppo, l'organizzatore (chi crea il trip e invita gli altri).

**Primary use case:**
Pianificare velocemente un weekend o una breve trasferta senza sprecare ore su Google, blog e forum.

**Jobs to be done:**

1. "Dimmi dove andare e cosa fare, giorno per giorno, senza che io ci perda ore."
2. "Aiutami a organizzare un viaggio con gli amici senza caos su spese e decisioni."
3. "Portami nei posti dove vanno davvero le persone del posto, non le trappole turistiche."

**Use cases:**

- Weekend a Lisbona da soli / in coppia → piano AI in 30 sec, mappa ottimizzata, sblocco giorno per giorno
- Gita di gruppo a Barcellona (4 amici) → itinerario condiviso, split spese automatico, ogni membro vede lo stesso sblocco
- "Insider experience" a Roma → LocalPass add-on per gemme nascoste non presenti sulle guide

---

## Personas

| Persona                             | Cares about                                 | Challenge                                     | Value we promise                                |
| ----------------------------------- | ------------------------------------------- | --------------------------------------------- | ----------------------------------------------- |
| Viaggiatore frequente (solo/coppia) | Risparmio di tempo, qualità dell'esperienza | Perde 8 ore a pianificare ogni viaggio        | Piano in 30 secondi, ottimizzato e aggiornabile |
| Organizzatore di gruppo             | Coordinamento, equità nelle spese           | Decidere con 4+ persone è peggio che lavorare | Itinerario condiviso + split spese automatico   |
| Anti-turista                        | Autenticità, esperienze locali              | Finisce sempre nelle trappole per turisti     | LocalPass: insider content, gemme nascoste      |
| Abbonato frequente                  | Convenienza, viaggi frequenti               | Ripianificare ogni volta costo e tempo        | €6,99/mese, trip illimitati                     |

---

## Problems & Pain Points

**Core problem:**
Pianificare un viaggio breve richiede 8+ ore su Google, blog, TripAdvisor e forum, per ottenere un piano che resta comunque statico e non si adatta a cosa succede giorno per giorno.

**Why alternatives fall short:**

- Google Maps/Trip → generico, nessuna personalizzazione, nessuna logica temporale
- PDF/blog di itinerari → statici, non aggiornabili, non adattativi
- TripAdvisor → pieni di trappole per turisti, contenuti pagati
- Pianificazione manuale → ore perse, litigi in gruppo su cosa fare e chi paga cosa
- ChatGPT gratis → non genera un piano strutturato e progressivo, non ha mappe, non gestisce spese

**What it costs them:**

- Tempo: 4–8 ore di ricerca per ogni viaggio
- Denaro: booking sbagliati, ristoranti "da turista", esperienze deludenti
- Stress: coordinamento di gruppo (votazioni, spese, chi organizza cosa)

**Emotional tension:**
"Voglio partire e godermela, non passare il weekend a fare il project manager del viaggio."

---

## Competitive Landscape

**Direct competitors:**

- Wanderlog — pianificatore collaborativo, ma manuale e senza AI generativa
- TripIt — aggregatore di prenotazioni, non genera piani
- Roadtrippers — focus road trip US, non itinerari AI europei

**Secondary competitors:**

- ChatGPT / Claude.ai free — genera testo, ma niente mappa, niente sblocco progressivo, niente pagamenti, niente gruppo
- Google Gemini Travel — integrazione Google Maps, ma niente esperienza temporale progressiva

**Indirect competitors:**

- Blog / influencer di viaggio — contenuti statici, non personalizzati
- Agenzie di viaggio online (Booking, Airbnb Experiences) — prenotano, non pianificano

**Come cadono short:**
Nessuno combina: generazione AI + sblocco progressivo + geo-optimization + group management + split spese + LocalPass insider content, tutto in un unico flusso pay-per-trip.

---

## Differentiation

**Key differentiators:**

1. **Sblocco giornaliero progressivo** — il giorno 2 si sblocca solo il giorno 2. Non è un PDF da leggere tutto subito: è un sistema che vive con il viaggio.
2. **Generazione in 30 secondi** — non è una lista di link, è un piano strutturato JSON validato, ottimizzato geograficamente.
3. **Rigenerazione con carosello** — 3 gratis → 7 max → carosello: scegli il migliore senza ansia.
4. **Group + split spese integrato** — PackedUp: itinerario condiviso, saldi per membro, inviti via token.
5. **LocalPass** — contenuti autentici da insider locali, non Google Places riprocessato.
6. **Live suggest & GPS** — sostituzione slot con posizione GPS, suggerimenti in tempo reale durante il viaggio.

**How we do it differently:**
Non acquisti un file. Acquisti l'accesso a un sistema dinamico che sa dove sei e cosa succede oggi nel tuo viaggio.

**Why that's better:**
L'engagement è costruito nel prodotto stesso (sblocco giornaliero → l'utente apre l'app ogni mattina). Nessun PDF o blog può replicare questo.

**Why customers choose us:**
"Voglio solo dire dove vado e avere un piano che funziona." → noi lo facciamo in 30 secondi, lo sblocchiamo giorno per giorno, lo adattiamo live.

---

## Objections

| Objection                                         | Response                                                                                                                                     |
| ------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| "Non posso vedere tutto l'itinerario in anticipo" | È la feature, non il bug: il giorno 2 si sblocca il giorno 2 perché l'esperienza è pensata per essere vissuta, non collezionata come un PDF. |
| "E se l'AI sbaglia qualcosa?"                     | 3 rigenerazioni gratis (poi €1,99 fino a 7 max). Il carosello ti permette di scegliere il migliore senza ansia.                              |
| "Non ho connessione sempre"                       | Il piano sbloccato è consultabile offline. Solo generazione e live suggest richiedono rete.                                                  |
| "È caro per un weekend"                           | €3,99 = meno di un cappuccino all'aeroporto. Confrontalo con le ore che ci metti a pianificare da solo.                                      |
| "Cancellazione?"                                  | Credito valido 1 anno. I contenuti sono fatti per essere vissuti, non per essere collezionati.                                               |
| "Come faccio a fidarmi dei contenuti LocalPass?"  | Curati da insider locali, non da algoritmi o advertorial. Gemme nascoste ≠ TripAdvisor top 10.                                               |

**Anti-persona:**

- Chi pianifica viaggi di 2–3 settimane (l'MVP è ottimizzato per 2–5+ giorni, non per tour lunghi)
- Chi non vuole pagare nulla e si accontenta di ChatGPT gratis
- Chi vuole un'app nativa iOS/Android (è web-only per ora)

---

## Switching Dynamics

**Push (cosa li allontana dall'alternativa attuale):**

- "Perdo 8 ore a pianificare ogni viaggio"
- Blog e guide turistiche portano sempre negli stessi posti da turista
- Coordinare spese e decisioni in un gruppo è estenuante

**Pull (cosa li attrae verso EasyTripSaaS):**

- Piano in 30 secondi
- Sblocco progressivo = engagement quotidiano durante il viaggio
- Split spese automatico = nessuna litigata post-viaggio
- LocalPass = esperienze autentiche, non tourist trap

**Habit (cosa li tiene fermi con l'alternativa):**

- "Uso Google Maps da sempre"
- "Ho già i miei blog preferiti di viaggi"
- Abitudine a pianificare manualmente anche se richiede ore

**Anxiety (cosa li preoccupa nel cambiare):**

- "E se l'itinerario non è buono?" → rigenerazioni
- "Non vedo tutto il piano subito" → è la feature, spiegata nella FAQ
- "Devo dare la carta per €3,99?" → Stripe hosted, sicuro e familiare

---

## Customer Language

**How they describe the problem:**

- "Perdo 8 ore a pianificare ogni viaggio. Voglio solo dire dove vado e avere un piano che funziona."
- "Organizzare un viaggio in cinque è peggio che lavorare: votazioni, spese, chi prenota cosa."
- "Spesso finisco in trappole per turisti. Voglio sapere dove vanno davvero le persone del posto."

**How they describe the solution:**

- "Hai detto dove vai → hai il piano" (aspirazionale)
- "Un piano che si sblocca giorno per giorno, non un PDF da leggere tutto in anticipo"
- "Come avere un amico del posto che ti dice dove andare davvero"

**Words to use:**

- itinerario, piano, sblocco, viaggio breve, weekend, gemme nascoste, insider, ottimizzato, generato in 30 secondi, rigenerazione, carosello, split spese, gruppo

**Words to avoid:**

- "soluzione" (vago), "piattaforma" (freddo), "innovative" (abusato), "streamline", "optimized workflow" (corporate speak)
- Mai "PDF" in positivo — siamo l'opposto di un PDF

**Glossary:**
| Term | Meaning |
|------|---------|
| TripGenius | Nome interno del motore AI di generazione itinerari |
| PackedUp | Modulo gruppo: itinerario condiviso + split spese |
| LocalPass | Add-on per contenuti autentici da insider locali (€3,99/città) |
| Sblocco progressivo | Il giorno N dell'itinerario si sblocca solo nel giorno N del viaggio |
| Carosello | Dopo 7 rigenerazioni, si torna alla versione 1 — scegli il migliore |
| Slot | Singola attività/ristorante nell'itinerario, sostituibile con GPS |
| Rigenera | Generare una nuova versione dell'itinerario (3 gratis, poi €1,99) |
| Riattivazione | Estensione accesso a un trip scaduto (+30 giorni, €2,90) |

---

## Brand Voice

**Tone:**
Diretto, concreto, leggermente ironico. Come un amico che viaggia molto e ti dice le cose come stanno, senza imbonire.

**Style:**
Frasi brevi. Niente perifrasi. Confronti reali ("meno di un cappuccino all'aeroporto"). Umorismo sottile ma non forzato. Titoli provocatori che anticipano l'obiezione ("Risposte rapide, prima che tu ci ripensi", "Le frasi che senti prima di comprare").

**Personality:**

- Pratico
- Honest (dice anche i limiti: "serve connessione per la generazione")
- Un po' sfacciato (sa che il prodotto funziona e non si scusa)
- Europeo / italiano nella sensibilità (non silicon valley speak)

---

## Proof Points

**Metrics:**

- Generazione itinerario: ~30 secondi
- Rigenerazioni disponibili: 3 gratis → 7 max (poi carosello)
- Prezzi: €3,99 solo/coppia · €6,99 gruppo · €6,99/mese abbonamento
- Sconto retention: −20% al viaggio successivo (entro 7 giorni dal rientro)
- Referral reward: €3,99 credito (= 1 trip solo/coppia gratis)

**Customers/Logos:**
MVP — nessun logo pubblico ancora.

**Testimonials (da user research, non verificati pubblicamente):**

> "Perdo 8 ore a pianificare ogni viaggio. Voglio solo dire dove vado e avere un piano che funziona." — Viaggiatore frequente

> "Organizzare un viaggio in cinque è peggio che lavorare: votazioni, spese, chi prenota cosa." — Organizzatore gruppo 3-5 amici

> "Spesso finisco in trappole per turisti. Voglio sapere dove vanno davvero le persone del posto." — Profilo LocalPass

**Value themes:**
| Theme | Proof |
|-------|-------|
| Velocità | Piano in 30 secondi dalla registrazione |
| Engagement quotidiano | Sblocco progressivo → l'utente apre l'app ogni mattina del viaggio |
| Flessibilità | 3+4 rigenerazioni, carosello, sostituzione slot con GPS |
| Autenticità | LocalPass: insider locals, non Google Places riprocessato |
| Convenienza gruppo | Split spese automatico, inviti via token, nessuna litigata |

---

## Goals

**Business goal:**
Acquisire i primi utenti paganti (Italia/Europa), validare il modello pay-per-trip, e crescere verso l'abbonamento "Viaggiatore Frequente" come MRR stabile.

**Conversion action:**

1. Registrazione (Clerk) → free
2. Creazione trip → compilazione form
3. Pagamento (Stripe) → €3,99 o €6,99
4. Utilizzo durante il viaggio → sblocco giornaliero (retention/engagement)
5. Ritorno → sconto 20% + referral → virale

**Current metrics:**
MVP in produzione. Dati di conversione non ancora disponibili pubblicamente.

---

## Canali di distribuzione

- Organico SEO (italiano, europeo) — keyword target: "itinerario weekend [città]", "piano viaggio AI"
- Referral virale in-app (1 trip gratis per chi invita)
- Potenziale: community viaggiatori (Facebook groups, Reddit r/italy, travel forum)
- Paid ads: non ancora attivo (MVP stage)
- Social content: non ancora attivo sistematicamente
