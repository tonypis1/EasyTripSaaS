import { inngest } from "../client";
import { prisma } from "@/lib/prisma";
import {
  addCalendarDaysUtc,
  dayOfWeekItalian,
  inclusiveCalendarDaysBetweenUtc,
  toDateOnlyIsoUtc,
} from "@/lib/calendar-date";
import { ANTHROPIC_MODEL, anthropic } from "@/lib/ai/anthropic";
import { resolveTripGeneratePayload } from "@/lib/inngest/trip-generate-payload";
import { z } from "zod";
import {
  itineraryReadyHtml,
  sendTransactionalEmail,
} from "@/lib/email/transactional";
import { formatGeoScoreLabel } from "@/lib/geo-score-ui";
import { config } from "@/config/unifiedConfig";

type DaySlot = {
  title: string;
  place: string;
  why: string;
  startTime: string;
  endTime: string;
  durationMin: number;
  googleMapsQuery: string;
  bookingLink: string | null;
  tips: string[];
  lat: number | null;
  lng: number | null;
};

type RestaurantEntry = {
  meal: "pranzo" | "cena";
  name: string;
  cuisine: string;
  why: string;
  budgetHint: string;
  distance: string;
  reservationNeeded: boolean;
  reservationTip: string;
};

type DayPlanExtended = {
  dayNumber: number;
  title: string;
  morning: DaySlot;
  afternoon: DaySlot;
  evening: DaySlot;
  zoneFocus: string;
  dowWarning: string;
  localGem: string;
  tips: string;
  mapCenterLat: number | null;
  mapCenterLng: number | null;
  restaurants: RestaurantEntry[];
};

/** Dati trip serializzabili tra gli step Inngest (JSON). */
type TripSnapshot = {
  id: string;
  destination: string;
  startDateIso: string;
  endDateIso: string;
  tripType: string;
  style: string | null;
  budgetLevel: string;
  regenCount: number;
  usedZones: string | null;
};

function buildSystemPrompt(): string {
  return [
    "Sei un travel planner locale esperto.",
    "Rispondi sempre e solo con JSON valido, senza markdown e senza testo fuori dal JSON.",
  ].join(" ");
}

/**
 * Genera la riga di calendario per ogni giorno del viaggio.
 * Es: "  Giorno 1 (2026-03-30): lunedì"
 */
function buildDayCalendar(startDate: Date, numDays: number): string {
  const lines: string[] = [];
  for (let i = 0; i < numDays; i++) {
    const d = addCalendarDaysUtc(startDate, i);
    const iso = toDateOnlyIsoUtc(d);
    const dow = dayOfWeekItalian(d);
    lines.push(`  Giorno ${i + 1} (${iso}): ${dow}`);
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

function buildUserPrompt(args: {
  destination: string;
  startDate: string;
  endDate: string;
  tripType: string;
  style: string | null;
  budgetLevel: string;
  numDays: number;
  dayCalendar: string;
  usedZones: string | null;
}): string {
  const usedBlock =
    args.usedZones && args.usedZones.trim().length > 0
      ? `
CONTESTO — ZONE GIÀ USATE (rigenerazione)
Evita di ripetere le stesse combinazioni di quartieri; varia rispetto a:
${args.usedZones}
`
      : "";

  const budgetInstruction =
    BUDGET_PROMPT_MAP[args.budgetLevel] ?? BUDGET_PROMPT_MAP.moderate;

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
${usedBlock}

SEZIONE — OUTPUT ATTESO
Rispondi con un unico oggetto JSON con:
- "optimizationScore": numero da 1 a 10 (quanto l'itinerario è ottimizzato per ridurre spostamenti inutili tra mattina, pomeriggio e sera nello stesso giorno).
- "days": array di esattamente ${args.numDays} oggetti giorno.

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
  Esempio di un singolo oggetto ristorante:
  { "meal": "pranzo", "name": "Trattoria Da Enzo", "cuisine": "cucina romana tradizionale", "why": "Cacio e pepe tra i migliori di Trastevere, porzioni generose", "budgetHint": "€12-16/persona", "distance": "100m da Piazza Santa Maria", "reservationNeeded": true, "reservationTip": "Arriva prima delle 12:30 o fila di 20+ min" }
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
- "dayNumber" progressivo da 1 a ${args.numDays}.
- Per ogni slot: "title" = nome breve del POI; "place" = quartiere/strada senza sostituire il nome in "title".
- Orari HH:mm, non sovrapposti, con buffer di spostamento 10–30 minuti tra slot consecutivi.
- Indoor/outdoor: in ogni giorno almeno uno slot adatto alla pioggia e uno all'aperto.
- In "tips" di ogni slot includi almeno un accenno meteo e un micro-budget qualitativo (senza prezzi inventati).
- IMPORTANTE: consulta il CALENDARIO GIORNALIERO per sapere il giorno della settimana di ogni giornata. NON calcolare i giorni da solo. Usa questa informazione per: (a) evitare di suggerire POI chiusi quel giorno; (b) compilare "dowWarning" con avvisi concreti; (c) preferire attività adatte al weekend se il giorno cade di sabato o domenica.
- Testi in italiano chiaro e concreto.
`.trim();
}

/** Claude a volte avvolge il JSON in ```json ... ``` */
function extractJsonText(raw: string): string {
  const trimmed = raw.trim();
  const fence = /^```(?:json)?\s*([\s\S]*?)```/m;
  const m = trimmed.match(fence);
  if (m) return m[1].trim();
  return trimmed;
}

const RestaurantEntrySchema = z.object({
  meal: z.enum(["pranzo", "cena"]),
  name: z.string().min(1),
  cuisine: z.string().min(1),
  why: z.string().min(1),
  budgetHint: z.string().min(1),
  distance: z.string().min(1),
  reservationNeeded: z.boolean(),
  reservationTip: z.string().default(""),
});

const DaySlotSchema = z.object({
  title: z.string().min(1),
  place: z.string().min(1),
  why: z.string().min(1),
  startTime: z
    .string()
    .regex(/^\d{1,2}:\d{2}$/)
    .transform((s) => {
      const [h, m] = s.split(":");
      return `${String(h).padStart(2, "0")}:${m}`;
    }),
  endTime: z
    .string()
    .regex(/^\d{1,2}:\d{2}$/)
    .transform((s) => {
      const [h, m] = s.split(":");
      return `${String(h).padStart(2, "0")}:${m}`;
    }),
  durationMin: z.coerce.number().int().min(10).max(600),
  googleMapsQuery: z.string().min(3),
  bookingLink: z.union([z.string().url(), z.null()]).default(null),
  tips: z.array(z.string().min(1)).min(1).max(6),
  lat: z.union([z.number(), z.null()]).default(null),
  lng: z.union([z.number(), z.null()]).default(null),
});

const DayPlanExtendedSchema = z.object({
  dayNumber: z.coerce.number().int().min(1),
  title: z.string().min(1),
  morning: DaySlotSchema,
  afternoon: DaySlotSchema,
  evening: DaySlotSchema,
  zoneFocus: z.string().min(1),
  dowWarning: z.string().default(""),
  localGem: z.string().default(""),
  tips: z.string().default(""),
  mapCenterLat: z.union([z.number(), z.null()]),
  mapCenterLng: z.union([z.number(), z.null()]),
  restaurants: z.array(RestaurantEntrySchema).min(2).max(4),
});

const ModelResponseSchema = z.object({
  optimizationScore: z.coerce.number().min(1).max(10),
  days: z.array(DayPlanExtendedSchema),
});

function parseAndValidateModelJson(
  raw: string,
  numDays: number
): { optimizationScore: number; days: DayPlanExtended[] } {
  const text = extractJsonText(raw);
  let parsed: unknown;
  try {
    parsed = JSON.parse(text) as unknown;
  } catch {
    throw new Error("JSON non valido (parse fallita)");
  }

  const check = ModelResponseSchema.safeParse(parsed);
  if (!check.success) {
    throw new Error(
      `Schema non valido: ${check.error.issues
        .map((i) => i.message)
        .slice(0, 4)
        .join("; ")}`
    );
  }

  const { optimizationScore, days } = check.data;
  if (days.length !== numDays) {
    throw new Error(
      `Numero giorni non valido: attesi ${numDays}, ottenuti ${days.length}`
    );
  }

  const byNum = new Map<number, DayPlanExtended>();
  for (const d of days) byNum.set(d.dayNumber, d as DayPlanExtended);
  for (let i = 1; i <= numDays; i++) {
    if (!byNum.has(i)) throw new Error(`Manca dayNumber=${i}`);
  }

  return {
    optimizationScore,
    days: Array.from({ length: numDays }, (_, idx) => byNum.get(idx + 1)!),
  };
}

function buildRepairPrompt(
  baseUserPrompt: string,
  previousRaw: string,
  reason: string
) {
  return `
Il tuo JSON non ha superato la validazione.
Motivo: ${reason}

Rigenera SOLO JSON valido che rispetta esattamente il formato richiesto.

${baseUserPrompt}

RISPOSTA PRECEDENTE (da correggere):
${previousRaw}
`.trim();
}

function fallbackSlot(label: string): DaySlot {
  return {
    title: label,
    place: "Da definire",
    why: "Contenuto in rigenerazione",
    startTime: "09:00",
    endTime: "11:00",
    durationMin: 120,
    googleMapsQuery: label,
    bookingLink: null,
    tips: ["Riprova la generazione tra poco"],
    lat: null,
    lng: null,
  };
}

export const generateItinerary = inngest.createFunction(
  {
    id: "generate-itinerary",
    name: "Genera itinerario EasyTrip",
    retries: 3,
    triggers: [{ event: "trip/generate.requested" }],
    timeouts: { finish: "15m" },
  },
  async ({ event, events, step }) => {
    const { tripId } = resolveTripGeneratePayload(event, events);

    const trip = await step.run("carica-trip", async (): Promise<TripSnapshot> => {
      const t = await prisma.trip.findUnique({
        where: { id: tripId },
      });
      if (!t) {
        throw new Error(`Trip ${tripId} non trovato`);
      }
      return {
        id: t.id,
        destination: t.destination,
        startDateIso: t.startDate.toISOString(),
        endDateIso: t.endDate.toISOString(),
        tripType: t.tripType,
        style: t.style,
        budgetLevel: t.budgetLevel ?? "moderate",
        regenCount: t.regenCount ?? 0,
        usedZones: t.usedZones,
      };
    });

    const startDate = new Date(trip.startDateIso);
    const endDate = new Date(trip.endDateIso);
    const numDays = inclusiveCalendarDaysBetweenUtc(startDate, endDate);

    const gen = await step.run(
      "genera-con-claude",
      async (): Promise<{
        optimizationScore: number;
        days: DayPlanExtended[];
      }> => {
        const userPrompt = buildUserPrompt({
          destination: trip.destination,
          startDate: startDate.toISOString().slice(0, 10),
          endDate: endDate.toISOString().slice(0, 10),
          tripType: trip.tripType,
          style: trip.style,
          budgetLevel: trip.budgetLevel,
          numDays,
          dayCalendar: buildDayCalendar(startDate, numDays),
          usedZones: trip.usedZones,
        });

        const maxAttempts = 3;
        let lastErr: unknown = null;
        let lastRaw = "";

        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
          const response = await anthropic.messages.create({
            model: ANTHROPIC_MODEL,
            max_tokens: 12000,
            temperature: attempt === 1 ? 0.35 : 0.2,
            system: buildSystemPrompt(),
            messages: [{ role: "user", content: userPrompt }],
          });

          const textBlock = response.content.find((c) => c.type === "text");
          if (!textBlock || textBlock.type !== "text") {
            throw new Error("Claude non ha restituito un blocco testuale");
          }

          lastRaw = textBlock.text;

          try {
            return parseAndValidateModelJson(lastRaw, numDays);
          } catch (e) {
            lastErr = e;
            if (attempt === maxAttempts) break;

            const reason = e instanceof Error ? e.message : "errore sconosciuto";
            const repairPrompt = buildRepairPrompt(userPrompt, lastRaw, reason);

            const repairResponse = await anthropic.messages.create({
              model: ANTHROPIC_MODEL,
              max_tokens: 12000,
              temperature: 0.2,
              system: buildSystemPrompt(),
              messages: [{ role: "user", content: repairPrompt }],
            });

            const repairTextBlock = repairResponse.content.find(
              (c) => c.type === "text"
            );
            if (!repairTextBlock || repairTextBlock.type !== "text") {
              throw new Error(
                "Claude non ha restituito un blocco testuale (riparazione)"
              );
            }

            lastRaw = repairTextBlock.text;
            try {
              return parseAndValidateModelJson(lastRaw, numDays);
            } catch (e2) {
              lastErr = e2;
              continue;
            }
          }
        }

        const msg = lastErr instanceof Error ? lastErr.message : "errore sconosciuto";
        throw new Error(
          `Claude JSON non valido dopo ${maxAttempts} tentativi: ${msg}`
        );
      }
    );

    const result = await step.run("salva-versione-e-giorni", async () => {
      const versionNum = trip.regenCount + 1;
      const { optimizationScore, days } = gen;

      await prisma.tripVersion.updateMany({
        where: { tripId: trip.id },
        data: { isActive: false },
      });

      const version = await prisma.tripVersion.create({
        data: {
          tripId: trip.id,
          versionNum,
          isActive: true,
          geoScore: optimizationScore,
        },
      });

      const zoneParts: string[] = [];

      for (const day of days) {
        const unlockDate = addCalendarDaysUtc(startDate, day.dayNumber - 1);
        if (day.zoneFocus?.trim()) zoneParts.push(day.zoneFocus.trim());

        await prisma.day.create({
          data: {
            tripVersionId: version.id,
            dayNumber: day.dayNumber,
            unlockDate,
            title: day.title || `Giorno ${day.dayNumber}`,
            morning: JSON.stringify(
              day.morning ?? fallbackSlot("Mattina libera")
            ),
            afternoon: JSON.stringify(
              day.afternoon ?? fallbackSlot("Pomeriggio libero")
            ),
            evening: JSON.stringify(
              day.evening ?? fallbackSlot("Serata libera")
            ),
            restaurants:
              day.restaurants && day.restaurants.length > 0
                ? JSON.stringify(day.restaurants)
                : null,
            mapCenterLat:
              day.mapCenterLat != null ? day.mapCenterLat : null,
            mapCenterLng:
              day.mapCenterLng != null ? day.mapCenterLng : null,
            zoneFocus: day.zoneFocus || null,
            dowWarning: day.dowWarning || null,
            localGem: day.localGem || null,
            tips: day.tips || null,
          },
        });
      }

      const usedZonesMerged = Array.from(new Set(zoneParts)).join(" | ");
      const usedZonesCombined = [trip.usedZones, usedZonesMerged]
        .filter((s) => s != null && String(s).trim().length > 0)
        .join(" | ");

      await prisma.trip.update({
        where: { id: trip.id },
        data: {
          regenCount: versionNum,
          currentVersion: versionNum,
          status: "active",
          usedZones: usedZonesCombined.length > 0 ? usedZonesCombined : null,
        },
      });

      return { versionNum, daysCreated: numDays, optimizationScore };
    });

    await step.run("email-itinerario-pronto", async () => {
      const full = await prisma.trip.findUnique({
        where: { id: trip.id },
        include: { organizer: { select: { email: true } } },
      });
      if (!full?.organizer?.email) return;

      const tripUrl = `${config.app.baseUrl}/app/trips/${trip.id}`;
      const label = formatGeoScoreLabel(result.optimizationScore);

      await sendTransactionalEmail({
        to: full.organizer.email,
        subject: `Itinerario pronto — ${full.destination}`,
        html: itineraryReadyHtml({
          destination: full.destination,
          tripUrl,
          geoScoreLabel: label,
        }),
      });
    });

    return { tripId: trip.id, ...result };
  }
);
