import Anthropic from "@anthropic-ai/sdk";
import { ANTHROPIC_MODEL, anthropic } from "@/lib/ai/anthropic";
import {
  addCalendarDaysUtc,
  dayOfWeekForLocale,
  toDateOnlyIsoUtc,
} from "@/lib/calendar-date";
import {
  normalizeAiLocale,
  systemLanguageDirective,
  userLanguageReminder,
  type SupportedAiLocale,
} from "@/lib/ai/prompt-locale";
import {
  parseAndValidateModelJson,
  type DayPlanExtended,
} from "@/lib/itinerary-model-schema";
import { buildRepairSuffix } from "@/lib/ai/repairLoop";
import { ITINERARY_OUTPUT_FORMAT } from "@/lib/ai/itinerary-output-format";
import {
  formatGroundingForPrompt,
  type GroundedDestination,
} from "@/lib/grounding/grounding-schema";
import {
  EMPTY_PREFERENCES,
  buildPreferencesPromptBlock,
  findDietaryGaps,
  formatDietaryGaps,
  requiredDietFits,
  type TripPreferences,
} from "@/lib/trip/preferences";
import { generationChunks, type DayRange } from "@/lib/trip/generation-chunks";
import { logger } from "@/lib/observability";

export type ItineraryGenerationInput = {
  destination: string;
  startDate: Date;
  endDate: Date;
  numDays: number;
  tripType: string;
  style: string | null;
  budgetLevel: string;
  usedZones: string | null;
  localPassCityCount: number;
  locale: SupportedAiLocale;
  /** Preferenze strutturate (interessi, ritmo, mobilità, restrizioni alimentari); assenti/vuote = prompt invariato. */
  preferences?: TripPreferences;
  /** POI/ristoranti verificati via ricerca web (cache condivisa); assente = si genera solo dalla conoscenza del modello. */
  grounding?: { grounding: GroundedDestination; fetchedAt: string } | null;
};

export type ItineraryGenerationResult = ReturnType<
  typeof parseAndValidateModelJson
>;

function buildSystemPrompt(locale: SupportedAiLocale): string {
  return [
    "Sei un travel planner locale esperto.",
    "Rispondi sempre e solo con JSON valido, senza markdown e senza testo fuori dal JSON.",
    systemLanguageDirective(locale),
  ].join(" ");
}

/**
 * Genera la riga di calendario per ogni giorno del viaggio nella lingua
 * dell'organizer. Es (it): "  Giorno 1 (2026-03-30): lunedì"
 * Es (en): "  Day 1 (2026-03-30): Monday"
 */
const DAY_WORD: Record<SupportedAiLocale, string> = {
  it: "Giorno",
  en: "Day",
  es: "Día",
  fr: "Jour",
  de: "Tag",
};

function buildDayCalendar(
  startDate: Date,
  numDays: number,
  locale: SupportedAiLocale,
): string {
  const dayWord = DAY_WORD[locale];
  const lines: string[] = [];
  for (let i = 0; i < numDays; i++) {
    const d = addCalendarDaysUtc(startDate, i);
    const iso = toDateOnlyIsoUtc(d);
    const dow = dayOfWeekForLocale(d, locale);
    lines.push(`  ${dayWord} ${i + 1} (${iso}): ${dow}`);
  }
  return lines.join("\n");
}

const BUDGET_PROMPT_MAP: Record<string, string> = {
  economy:
    "BUDGET BASSO — Privilegia: street food, mercati locali, musei gratuiti o a basso costo, trasporti pubblici, parchi. Nei ristoranti suggerisci opzioni economiche. Evita esperienze costose.",
  moderate:
    "BUDGET MEDIO — Equilibrio qualità/prezzo: mix di ristoranti mid-range e trattorie locali, attrazioni principali con biglietto, qualche esperienza speciale. Non serve risparmiare su tutto.",
  premium:
    "BUDGET ALTO — Privilegia: ristoranti rinomati, tour privati o con guida, esperienze esclusive, ingressi VIP/salta-fila, cocktail bar, roof-top. L'utente vuole il meglio.",
};

/**
 * Prompt utente diviso in una parte stabile (identica per lo stesso trip a
 * ogni blocco di giorni, a ogni tentativo di riparazione E a ogni
 * rigenerazione, finché destinazione/date/tipologia/stile/budget/locale non
 * cambiano) e una volatile (i giorni da generare, quelli già pianificati e le
 * zone già usate nelle versioni precedenti). Separarle permette di marcare la
 * parte stabile — che include il blocco OUTPUT ATTESO, di gran lunga il più
 * pesante — con un `cache_control` breakpoint: i blocchi successivi, le
 * riparazioni e le rigenerazioni dello stesso trip leggono quel blocco dalla
 * cache Anthropic invece di pagarlo per intero ogni volta. Vedi `generate()`.
 */
function buildStableUserPrompt(args: {
  destination: string;
  startDate: string;
  endDate: string;
  tripType: string;
  style: string | null;
  budgetLevel: string;
  numDays: number;
  dayCalendar: string;
  localPassCityCount: number;
  locale: SupportedAiLocale;
  groundingBlock: string | null;
  preferencesBlock: string | null;
}): string {
  const localPassBlock =
    args.localPassCityCount > 0
      ? `
SEZIONE — LOCALPASS (add-on attivo)
L'utente ha acquistato LocalPass per ${args.localPassCityCount} città (o altrettanti contesti urbani distinti da valorizzare nel viaggio). Privilegia consigli da insider, luoghi curati, gemme poco note e ristoranti dove vanno i residenti; evita cliché turistici e trappole per visitatori. Rafforza "localGem", i consigli giornalieri ("tips") e le scelte tra i ristoranti in questo senso.
`
      : "";
  const budgetInstruction =
    BUDGET_PROMPT_MAP[args.budgetLevel] ?? BUDGET_PROMPT_MAP.moderate;
  const groundingSection = args.groundingBlock
    ? `\n${args.groundingBlock}\n`
    : "";
  const preferencesSection = args.preferencesBlock
    ? `\n${args.preferencesBlock}\n`
    : "";

  return `
SEZIONE — CONTESTO
Pianifica un itinerario realistico e geograficamente coerente per la destinazione indicata.

SEZIONE — INPUT
- Destinazione: ${args.destination}
- Intervallo date: ${args.startDate} → ${args.endDate}
- Numero giorni calendario: ${args.numDays}
- Tipologia viaggio: ${args.tripType}
- Stile preferenze: ${args.style ?? "non specificato"}
- Livello budget: ${args.budgetLevel}

CALENDARIO GIORNALIERO (giorno della settimana per ogni data):
${args.dayCalendar}

SEZIONE — ISTRUZIONI BUDGET
${budgetInstruction}
${localPassBlock}${preferencesSection}${groundingSection}

SEZIONE — OUTPUT ATTESO
Rispondi con un unico oggetto JSON con:
- "optimizationScore": numero da 1 a 10 (quanto i giorni generati sono ottimizzati per ridurre spostamenti inutili tra mattina, pomeriggio e sera nello stesso giorno).
- "days": array con i soli giorni indicati in SEZIONE — GIORNI DA GENERARE (in fondo al messaggio), un oggetto per giorno, in ordine.

Ogni elemento di "days" deve contenere:
- "dayNumber", "title"
- "zoneFocus": quartiere/zona principale del giorno (per tracciare diversità tra rigenerazioni)
- "dowWarning": usa il CALENDARIO GIORNALIERO sopra per verificare il giorno della settimana effettivo. Se quel giorno cade di lunedì, domenica o festivo e un POI scelto potrebbe essere chiuso, scrivi un avviso specifico (es. "Lunedì: molti musei chiusi, verifica orari"). Se non ci sono rischi, stringa vuota "".
- "localGem": un suggerimento "da locale" (piccolo luogo o consiglio non ovvio)
- "tips": stringa con consigli trasversali al giorno (non duplicare i singoli slot)
- "mapCenterLat", "mapCenterLng": coordinate approssimative del centro della zona giornata (decimali WGS84; stima plausibile)
- "restaurants": array di esattamente 2–4 oggetti ristorante, con pranzo e cena SEPARATI. Ogni oggetto ha questi campi:
  - "meal": "pranzo" oppure "cena" (almeno 1 pranzo e almeno 1 cena per giorno)
  - "name": nome reale del ristorante/trattoria/locale
  - "cuisine": tipo di cucina in poche parole (es. "trattoria romana", "sushi fusion", "pizza napoletana")
  - "why": perché è consigliato, specifico e concreto (non generico)
  - "budgetHint": fascia di prezzo per persona (es. "€12-18/persona", "€25-35/persona")
  - "distance": distanza approssimativa dalla zona delle attività del giorno (es. "150m dal Pantheon", "5 min a piedi da Piazza Navona")
  - "reservationNeeded": booleano true/false — true se il locale è popolare, piccolo, o chiude presto; false se accetta walk-in facilmente
  - "reservationTip": se reservationNeeded=true, scrivi come prenotare (es. "Prenota su TheFork 1-2gg prima", "Chiama al mattino"); se false, stringa vuota ""
  - "dietaryFit": array con i codici delle restrizioni alimentari dell'utente che il locale soddisfa davvero (valori ammessi: vegetarian, vegan, gluten_free, lactose_free, halal, kosher). Array vuoto [] se l'utente non ha indicato restrizioni alimentari.
  Esempio di un singolo oggetto ristorante:
  { "meal": "pranzo", "name": "Trattoria Da Enzo", "cuisine": "cucina romana tradizionale", "why": "Cacio e pepe tra i migliori di Trastevere, porzioni generose", "budgetHint": "€12-16/persona", "distance": "100m da Piazza Santa Maria", "reservationNeeded": true, "reservationTip": "Arriva prima delle 12:30 o fila di 20+ min", "dietaryFit": [] }
  NON inventare ristoranti inesistenti: usa solo nomi di locali reali e noti della destinazione. Se non sei sicuro di un nome specifico, descrivi il tipo di locale e la zona.
- "morning", "afternoon", "evening": ogni slot deve contenere:
  - "title": nome breve del POI
  - "place": quartiere/strada
  - "why": perché è consigliato
  - "startTime": orario inizio HH:mm
  - "endTime": orario fine HH:mm
  - "durationMin": durata attività in minuti (intero). Calcolalo da startTime/endTime. Es: startTime="09:00" endTime="11:30" → durationMin=150
  - "googleMapsQuery": query di ricerca pronta per Google Maps. Include il nome specifico del POI + città/quartiere. Es: "Colosseo Roma", "Museu Picasso Barcelona El Born", "Mercato di San Lorenzo Firenze". NON coordinate, solo nome leggibile + località.
  - "bookingLink": URL diretto per prenotare o acquistare biglietti (sito ufficiale, GetYourGuide, Tiqets, TheFork, ecc.). Se il POI non richiede prenotazione o biglietto (passeggiata, piazza, parco), usa null. IMPORTANTE: usa SOLO URL reali. Se non sei sicuro, usa null.
  - "tips": array di stringhe con consigli
  - "lat": latitudine WGS84 del POI (decimale, es. 41.9029). Usa coordinate reali e precise del luogo specifico, NON del centro città.
  - "lng": longitudine WGS84 del POI (decimale, es. 12.4534). Usa coordinate reali e precise del luogo specifico, NON del centro città.
  IMPORTANTE per le coordinate: ogni slot DEVE avere "lat" e "lng" con le coordinate reali del POI. Se non conosci le coordinate esatte, stima la posizione nel quartiere corretto. NON usare null e NON usare le stesse coordinate per tutti gli slot.
  Esempio completo di un singolo slot:
  { "title": "Colosseo", "place": "Rione Monti", "why": "Simbolo di Roma, imperdibile al mattino prima della folla", "startTime": "09:00", "endTime": "11:30", "durationMin": 150, "googleMapsQuery": "Colosseo Roma", "bookingLink": null, "tips": ["Arrivo ore 8:45 per evitare la coda", "Porta acqua"], "lat": 41.8902, "lng": 12.4922 }

SEZIONE — REGOLE
- "dayNumber" = numero del giorno nel viaggio, come nel CALENDARIO GIORNALIERO (per i giorni successivi al primo blocco non ripartire da 1).
- Per ogni slot: "title" = nome breve del POI; "place" = quartiere/strada senza sostituire il nome in "title".
- Orari HH:mm, non sovrapposti, con buffer di spostamento 10–30 minuti tra slot consecutivi.
- Indoor/outdoor: in ogni giorno almeno uno slot adatto alla pioggia e uno all'aperto.
- In "tips" di ogni slot includi almeno un accenno meteo e un micro-budget qualitativo (senza prezzi inventati).
- IMPORTANTE: consulta il CALENDARIO GIORNALIERO per sapere il giorno della settimana di ogni giornata. NON calcolare i giorni da solo. Usa questa informazione per: (a) evitare di suggerire POI chiusi quel giorno; (b) compilare "dowWarning" con avvisi concreti; (c) preferire attività adatte al weekend se il giorno cade di sabato o domenica.
- LINGUA DI RISPOSTA: ${userLanguageReminder(args.locale)} Tutti i campi testuali liberi del JSON (title, why, tips, dowWarning, localGem, reservationTip, ecc.) DEVONO essere in questa lingua. I valori enum (es. "pranzo"/"cena" in "meal") restano invariati perché fanno parte dello schema.
`.trim();
}

/**
 * Blocco volatile: cambia ad ogni rigenerazione dello stesso trip (accumula
 * le zone già usate nelle versioni precedenti). Va SEMPRE dopo il blocco
 * stabile nel messaggio, mai prima, altrimenti sposterebbe il breakpoint di
 * cache su un prefisso che cambia ogni volta.
 */
function buildUsedZonesBlock(usedZones: string | null): string | null {
  if (!usedZones || usedZones.trim().length === 0) return null;
  return `
CONTESTO — ZONE GIÀ USATE (rigenerazione)
Evita di ripetere le stesse combinazioni di quartieri; varia rispetto a:
${usedZones}
`.trim();
}

/** Riga del riepilogo "già pianificati": testo del modello su una riga, accorciato. */
function plannedText(value: string): string {
  const oneLine = value.replace(/\s+/g, " ").trim();
  return oneLine.length > 80 ? `${oneLine.slice(0, 79)}…` : oneLine;
}

/**
 * Blocco volatile: i giorni da generare in questa chiamata e, dal secondo
 * blocco in poi, il riepilogo dei giorni già generati (zona, tappe,
 * ristoranti) da non ripetere. Sta dopo il breakpoint di cache, come le zone
 * già usate: il blocco stabile resta identico per tutti i blocchi.
 */
function buildChunkBlock(
  range: DayRange,
  numDays: number,
  planned: readonly DayPlanExtended[],
): string {
  const count = range.lastDay - range.firstDay + 1;
  const single = range.firstDay === range.lastDay;
  const wholeTrip = range.firstDay === 1 && range.lastDay === numDays;
  const lines = [
    "SEZIONE — GIORNI DA GENERARE",
    `${single ? `Genera solo il giorno ${range.firstDay}` : `Genera i giorni da ${range.firstDay} a ${range.lastDay}`} del viaggio (${numDays} giorni in tutto): "days" deve contenere esattamente ${count} ${count === 1 ? "oggetto" : "oggetti"}, con "dayNumber" ${single ? `= ${range.firstDay}` : `da ${range.firstDay} a ${range.lastDay}`}.${wholeTrip ? "" : " Gli altri giorni vengono generati con richieste separate."}`,
  ];
  if (planned.length > 0) {
    lines.push(
      "",
      "SEZIONE — GIÀ PIANIFICATI (giorni precedenti dello stesso viaggio)",
      "Non riproporre questi POI né questi ristoranti e varia le zone; il nuovo blocco deve proseguire il viaggio in modo coerente.",
      ...planned.map(
        (d) =>
          `- Giorno ${d.dayNumber} — zona: ${plannedText(d.zoneFocus)}; tappe: ${[d.morning, d.afternoon, d.evening].map((slot) => plannedText(slot.title)).join(", ")}; ristoranti: ${d.restaurants.map((r) => plannedText(r.name)).join(", ")}`,
      ),
    );
  }
  return lines.join("\n");
}

const MAX_ATTEMPTS = 3;

/**
 * Budget di output per una chiamata (i giorni di un blocco): ragionamento
 * adattivo + JSON. Su Claude Sonnet 5 il ragionamento è attivo di default
 * (effort "high") e conta in `max_tokens`. Misurato con l'API reale (3
 * giorni): ~12.800 token in uscita, di cui ~4.700 di JSON (~1.550 per giorno)
 * e ~8.100 di ragionamento: il vecchio limite fisso di 12.000 troncava la
 * risposta senza lasciare alcun testo. Con effort "medium" il ragionamento si
 * dimezza ma è servito un giro di riparazione.
 */
function generationMaxTokens(numDays: number): number {
  return Math.min(64_000, 16_000 + numDays * 2_500);
}

/**
 * Una richiesta di generazione, in streaming: con un budget di output ampio
 * una richiesta non in streaming può superare i 10 minuti e l'SDK la rifiuta.
 * Ritorna il testo completo, o il motivo per cui non c'è (nessun blocco di
 * testo, risposta troncata): in quei casi non c'è un JSON da riparare.
 */
async function requestItinerary(
  locale: SupportedAiLocale,
  numDays: number,
  content: Anthropic.TextBlockParam[],
): Promise<{ text: string } | { text: null; problem: string }> {
  const response = await anthropic.messages
    .stream({
      model: ANTHROPIC_MODEL,
      max_tokens: generationMaxTokens(numDays),
      system: buildSystemPrompt(locale),
      output_config: { format: ITINERARY_OUTPUT_FORMAT },
      messages: [{ role: "user", content }],
    })
    .finalMessage();

  const textBlock = response.content.find((c) => c.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    return {
      text: null,
      problem: "Claude non ha restituito un blocco testuale",
    };
  }
  if (response.stop_reason === "max_tokens") {
    return { text: null, problem: "Risposta troncata (max_tokens)" };
  }
  return { text: textBlock.text };
}

/** Una chiamata al modello nel ciclo tentativi/riparazioni. */
export type GenerationCall = {
  /** Tentativo, da 1 a `MAX_ATTEMPTS`. */
  attempt: number;
  /** Risposta del tentativo da riparare (testo + motivo), o null = tentativo da zero. */
  repair: { raw: string; reason: string } | null;
};

type FailedGenerationCall = {
  ok: false;
  /** Testo completo da riparare; null = niente da riparare (troncato o senza testo). */
  raw: string | null;
  /** Motivo dettagliato, solo per il prompt di riparazione: può citare le restrizioni alimentari. */
  reason: string;
  /** Motivo senza dati personali, per log ed errori. */
  logReason: string;
};

/** Esito di una chiamata, serializzabile: passa tra gli step Inngest. */
export type GenerationCallOutcome =
  | { ok: true; result: ItineraryGenerationResult }
  | FailedGenerationCall;

export type FailedGeneration = {
  call: GenerationCall;
  outcome: FailedGenerationCall;
};

/**
 * La chiamata successiva a un esito negativo (`null` = la prima): la
 * riparazione della risposta se c'è un testo completo da riparare, altrimenti
 * un nuovo tentativo; `null` = tentativi esauriti. Sequenza massima:
 * 1, riparazione 1, 2, riparazione 2, 3 (5 chiamate). Il job Inngest esegue
 * ogni chiamata in uno step separato: una sola richiesta al modello per
 * invocazione della route, invece di tutte nella stessa.
 */
export function nextGenerationCall(
  previous: FailedGeneration | null,
): GenerationCall | null {
  if (!previous) return { attempt: 1, repair: null };
  const { call, outcome } = previous;
  if (
    call.repair === null &&
    outcome.raw !== null &&
    call.attempt < MAX_ATTEMPTS
  ) {
    return {
      attempt: call.attempt,
      repair: { raw: outcome.raw, reason: outcome.reason },
    };
  }
  return call.attempt < MAX_ATTEMPTS
    ? { attempt: call.attempt + 1, repair: null }
    : null;
}

/**
 * Nessuna chiamata ha prodotto un blocco valido (messaggio senza dati
 * personali). Rieseguire il job non serve: rigiocherebbe gli stessi esiti
 * memorizzati, per questo il job Inngest la rende non ritentabile.
 */
export class GenerationExhaustedError extends Error {
  constructor(last: FailedGeneration | null, range: DayRange) {
    super(
      `Claude JSON non valido dopo ${MAX_ATTEMPTS} tentativi (giorni ${range.firstDay}-${range.lastDay}): ${last?.outcome.logReason ?? "errore sconosciuto"}`,
    );
    this.name = "GenerationExhaustedError";
  }
}

/**
 * Esegue una chiamata al modello. Il job Inngest passa `step.run`, così ogni
 * chiamata è uno step memorizzato (e una richiesta separata alla route);
 * fuori da Inngest la chiamata parte e basta.
 */
export type GenerationStepRunner = (
  id: string,
  run: () => Promise<GenerationCallOutcome>,
) => Promise<GenerationCallOutcome>;

const runInline: GenerationStepRunner = (_id, run) => run();

/** ID dello step Inngest di una chiamata: unico per blocco, tentativo e tipo. */
export function generationStepId(
  range: DayRange,
  call: GenerationCall,
): string {
  return `${call.repair ? "ripara" : "genera"}-giorni-${range.firstDay}-${range.lastDay}-${call.attempt}`;
}

/** Lacune dietetiche: dettaglio per il modello, solo conteggi nel messaggio (che finisce nei log). */
class DietaryGapsError extends Error {
  constructor(
    readonly modelReason: string,
    count: number,
  ) {
    super(
      `${count} ristoranti non dichiarano tutte le restrizioni alimentari richieste`,
    );
  }
}

/*
 * Structured Outputs (`ITINERARY_OUTPUT_FORMAT`): la risposta è vincolata
 * server-side allo schema, quindi gli errori strutturali/di parsing non
 * consumano più un tentativo. Restano possibili (e gestiti dal loop di
 * riparazione) i soli errori di business logic e di valore: numero di giorni,
 * limiti min/max che l'API non supporta. Lo schema è costante: la sua
 * compilazione lato API viene messa in cache.
 */

export class ItineraryGenerationService {
  /**
   * Le restrizioni alimentari sono un vincolo: se i ristoranti non dichiarano
   * di soddisfarle, il primo tentativo viene rifiutato con il motivo (e passa
   * dalla riparazione). Nella risposta riparata si accetta comunque il
   * risultato, con un avviso: in una destinazione piccola può non esistere un
   * locale per ogni pasto, e un itinerario già pagato non deve fallire per un
   * vincolo morbido (la UI mostra "da verificare" sui locali non confermati).
   */
  private checkDietaryFit(
    result: ItineraryGenerationResult,
    required: ReturnType<typeof requiredDietFits>,
    mode: "strict" | "lenient",
  ): ItineraryGenerationResult {
    const gaps = findDietaryGaps(result.days, required);
    if (gaps.length === 0) return result;

    if (mode === "strict") {
      throw new DietaryGapsError(formatDietaryGaps(gaps), gaps.length);
    }

    logger.warn(
      "Ristoranti non conformi alle restrizioni dopo la riparazione",
      {
        restaurantsWithGaps: gaps.length,
      },
    );
    return result;
  }

  /** Prompt (stabile + zone già usate + giorni del blocco) e vincoli della generazione. */
  private buildRequest(
    input: ItineraryGenerationInput,
    range: DayRange,
    planned: readonly DayPlanExtended[],
  ) {
    const locale = normalizeAiLocale(input.locale);
    const preferences = input.preferences ?? EMPTY_PREFERENCES;
    const requiredDiets = requiredDietFits(preferences);
    const stableUserPrompt = buildStableUserPrompt({
      destination: input.destination,
      startDate: input.startDate.toISOString().slice(0, 10),
      endDate: input.endDate.toISOString().slice(0, 10),
      tripType: input.tripType,
      style: input.style,
      budgetLevel: input.budgetLevel,
      numDays: input.numDays,
      dayCalendar: buildDayCalendar(input.startDate, input.numDays, locale),
      localPassCityCount: input.localPassCityCount,
      locale,
      groundingBlock: input.grounding
        ? formatGroundingForPrompt(
            input.grounding.grounding,
            input.destination,
            input.grounding.fetchedAt.slice(0, 10),
          )
        : null,
      preferencesBlock: buildPreferencesPromptBlock(preferences, "itinerary"),
    });
    const usedZonesBlock = buildUsedZonesBlock(input.usedZones);

    /**
     * Il blocco stabile (destinazione/date/stile/budget/output atteso/regole)
     * è identico per lo stesso trip in ogni blocco di giorni, ad ogni
     * rigenerazione e ad ogni tentativo di riparazione: marcarlo con
     * `cache_control` lo rende leggibile dalla cache Anthropic invece di
     * pagarlo per intero ogni volta. "Zone già usate" (cambia ad ogni
     * rigenerazione) e giorni del blocco restano fuori dal breakpoint.
     */
    const baseContent: Anthropic.TextBlockParam[] = [
      {
        type: "text",
        text: stableUserPrompt,
        cache_control: { type: "ephemeral" },
      },
      ...(usedZonesBlock
        ? [{ type: "text" as const, text: usedZonesBlock }]
        : []),
      { type: "text", text: buildChunkBlock(range, input.numDays, planned) },
    ];

    return { locale, requiredDiets, baseContent };
  }

  /**
   * Una chiamata al modello (tentativo o riparazione) per i giorni di un
   * blocco e la validazione della risposta. Non lancia per risposte non
   * valide: le descrive nell'esito, così il chiamante decide la chiamata
   * successiva (`nextGenerationCall`). Lancia solo per errori dell'API (li
   * ritenta lo step Inngest).
   */
  async runGenerationCall(
    input: ItineraryGenerationInput,
    call: GenerationCall,
    range: DayRange,
    planned: readonly DayPlanExtended[],
  ): Promise<GenerationCallOutcome> {
    const { locale, requiredDiets, baseContent } = this.buildRequest(
      input,
      range,
      planned,
    );
    const chunkDays = range.lastDay - range.firstDay + 1;
    const content: Anthropic.TextBlockParam[] = call.repair
      ? [
          ...baseContent,
          {
            type: "text",
            text: buildRepairSuffix(call.repair.raw, call.repair.reason),
          },
        ]
      : baseContent;

    const outcome = await this.validateResponse(
      await requestItinerary(locale, chunkDays, content),
      range,
      requiredDiets,
      // Riparazioni e ultimo tentativo accettano le lacune dietetiche (vincolo
      // morbido): un itinerario già pagato non deve fallire per questo.
      call.repair !== null || call.attempt === MAX_ATTEMPTS
        ? "lenient"
        : "strict",
    );
    const logFields = {
      firstDay: range.firstDay,
      lastDay: range.lastDay,
      attempt: call.attempt,
      repair: call.repair !== null,
    };
    if (outcome.ok) {
      logger.info("Generazione itinerario: blocco completato", logFields);
    } else {
      logger.warn("Generazione itinerario: risposta non valida", {
        ...logFields,
        reason: outcome.logReason,
      });
    }
    return outcome;
  }

  private async validateResponse(
    response: Awaited<ReturnType<typeof requestItinerary>>,
    range: DayRange,
    requiredDiets: ReturnType<typeof requiredDietFits>,
    mode: "strict" | "lenient",
  ): Promise<GenerationCallOutcome> {
    if (response.text === null) {
      return {
        ok: false,
        raw: null,
        reason: response.problem,
        logReason: response.problem,
      };
    }
    try {
      return {
        ok: true,
        result: this.checkDietaryFit(
          parseAndValidateModelJson(
            response.text,
            range.lastDay - range.firstDay + 1,
            range.firstDay,
          ),
          requiredDiets,
          mode,
        ),
      };
    } catch (e) {
      if (e instanceof DietaryGapsError) {
        return {
          ok: false,
          raw: response.text,
          reason: e.modelReason,
          logReason: e.message,
        };
      }
      const message = e instanceof Error ? e.message : "errore sconosciuto";
      return {
        ok: false,
        raw: response.text,
        reason: message,
        logReason: message,
      };
    }
  }

  /**
   * Genera e valida l'itinerario via Claude, un blocco di giorni alla volta
   * (`generationChunks`): una chiamata per tutto un viaggio lungo supererebbe
   * il limite di durata della route. Ogni blocco riceve il riepilogo dei
   * giorni già generati, per non ripetere POI e ristoranti.
   *
   * Per ogni blocco, fino a `MAX_ATTEMPTS` tentativi: se il JSON restituito
   * non supera `parseAndValidateModelJson`, tenta una riparazione (stesso
   * prompt + frammento della risposta precedente + motivo dell'errore) prima
   * di ripartire dal tentativo successivo. Il job Inngest passa `step.run`
   * come `runStep`: uno step per chiamata.
   */
  async generate(
    input: ItineraryGenerationInput,
    runStep: GenerationStepRunner = runInline,
  ): Promise<ItineraryGenerationResult> {
    const days: DayPlanExtended[] = [];
    let weightedScore = 0;
    for (const range of generationChunks(input.numDays)) {
      const chunk = await this.generateChunk(input, range, [...days], runStep);
      days.push(...chunk.days);
      weightedScore += chunk.optimizationScore * chunk.days.length;
    }
    return {
      // Media pesata sui giorni di ogni blocco.
      optimizationScore: Math.round((weightedScore / days.length) * 100) / 100,
      days,
    };
  }

  private async generateChunk(
    input: ItineraryGenerationInput,
    range: DayRange,
    planned: readonly DayPlanExtended[],
    runStep: GenerationStepRunner,
  ): Promise<ItineraryGenerationResult> {
    let previous: FailedGeneration | null = null;
    for (
      let call = nextGenerationCall(null);
      call;
      call = nextGenerationCall(previous)
    ) {
      const current = call;
      const outcome = await runStep(generationStepId(range, current), () =>
        this.runGenerationCall(input, current, range, planned),
      );
      if (outcome.ok) return outcome.result;
      previous = { call: current, outcome };
    }
    throw new GenerationExhaustedError(previous, range);
  }
}
