import { inngest } from "../client";
import { prisma } from "@/lib/prisma";
import {
  addCalendarDaysUtc,
  inclusiveCalendarDaysBetweenUtc,
} from "@/lib/calendar-date";
import { ANTHROPIC_MODEL, anthropic } from "@/lib/ai/anthropic";
import { resolveTripGeneratePayload } from "@/lib/inngest/trip-generate-payload";

type DaySlot = {
  title: string;
  place: string;
  why: string;
  startTime: string;
  endTime: string;
  tips: string[];
};

type DayPlan = {
  dayNumber: number;
  title: string;
  morning: DaySlot;
  afternoon: DaySlot;
  evening: DaySlot;
};

/** Dati trip serializzabili tra gli step Inngest (JSON). */
type TripSnapshot = {
  id: string;
  destination: string;
  startDateIso: string;
  endDateIso: string;
  tripType: string;
  style: string | null;
  regenCount: number;
};

function buildPrompt(args: {
  destination: string;
  startDate: string;
  endDate: string;
  tripType: string;
  style: string | null;
  numDays: number;
}) {
  return `
Sei un travel planner locale esperto della destinazione.
Genera un itinerario pratico, realistico e geograficamente coerente.

INPUT
- Destinazione: ${args.destination}
- Date: ${args.startDate} -> ${args.endDate}
- Numero giorni: ${args.numDays}
- Tipologia viaggio: ${args.tripType}
- Stile: ${args.style ?? "non specificato"}

OUTPUT RICHIESTO
Rispondi SOLO con JSON valido (niente testo extra), con questa forma:
{
  "days": [
    {
      "dayNumber": 1,
      "title": "Titolo sintetico giorno",
      "morning": {
        "title": "Attivita mattina",
        "place": "Zona/indirizzo sintetico",
        "why": "Perche e adatta al profilo utente",
        "startTime": "09:00",
        "endTime": "12:00",
        "tips": ["Tip 1", "Tip 2"]
      },
      "afternoon": { ...stessa forma... },
      "evening": { ...stessa forma... }
    }
  ]
}

REGOLE
- Crea esattamente ${args.numDays} elementi in "days".
- dayNumber progressivo da 1 a ${args.numDays}.
- Orari realistici e non sovrapposti (formato HH:mm).
- Suggerisci luoghi realmente plausibili per ${args.destination}.
- Testi in italiano semplice, utile e concreto.
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

function parseModelJson(raw: string): { days: DayPlan[] } {
  const text = extractJsonText(raw);
  try {
    const parsed = JSON.parse(text) as { days?: DayPlan[] };
    if (!Array.isArray(parsed.days)) {
      throw new Error("Formato risposta AI non valido: days assente");
    }
    return { days: parsed.days };
  } catch (e) {
    throw new Error(
      `Impossibile parsare JSON da Claude: ${e instanceof Error ? e.message : "errore sconosciuto"}`
    );
  }
}

function fallbackSlot(label: string): DaySlot {
  return {
    title: label,
    place: "Da definire",
    why: "Contenuto in rigenerazione",
    startTime: "09:00",
    endTime: "11:00",
    tips: ["Riprova la generazione tra poco"],
  };
}

export const generateItinerary = inngest.createFunction(
  {
    id: "generate-itinerary",
    name: "Genera itinerario EasyTrip",
    retries: 3,
    triggers: [{ event: "trip/generate.requested" }],
    /**
     * Il Dev Server locale e spesso le piattaforme hanno limiti stretti sul tempo
     * di una singola richiesta HTTP verso /api/inngest: usare step.run spezza il lavoro.
     * finish evita che run lunghe vengano annullate prima del completamento.
     */
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
        regenCount: t.regenCount ?? 0,
      };
    });

    const startDate = new Date(trip.startDateIso);
    const endDate = new Date(trip.endDateIso);
    const numDays = inclusiveCalendarDaysBetweenUtc(startDate, endDate);

    const days = await step.run("genera-con-claude", async (): Promise<DayPlan[]> => {
      const prompt = buildPrompt({
        destination: trip.destination,
        startDate: startDate.toISOString().slice(0, 10),
        endDate: endDate.toISOString().slice(0, 10),
        tripType: trip.tripType,
        style: trip.style,
        numDays,
      });

      const response = await anthropic.messages.create({
        model: ANTHROPIC_MODEL,
        max_tokens: 8192,
        temperature: 0.4,
        system:
          "Rispondi sempre solo con JSON valido, senza markdown e senza testo extra.",
        messages: [{ role: "user", content: prompt }],
      });

      const textBlock = response.content.find((c) => c.type === "text");
      if (!textBlock || textBlock.type !== "text") {
        throw new Error("Claude non ha restituito un blocco testuale");
      }

      const ai = parseModelJson(textBlock.text);

      return Array.from({ length: numDays }, (_, idx) => {
        const dayNumber = idx + 1;
        const fromModel = ai.days.find((d) => d.dayNumber === dayNumber);
        if (fromModel) return fromModel;
        return {
          dayNumber,
          title: `Giorno ${dayNumber}`,
          morning: fallbackSlot("Mattina libera"),
          afternoon: fallbackSlot("Pomeriggio libero"),
          evening: fallbackSlot("Serata libera"),
        };
      });
    });

    const result = await step.run("salva-versione-e-giorni", async () => {
      const versionNum = trip.regenCount + 1;

      await prisma.tripVersion.updateMany({
        where: { tripId: trip.id },
        data: { isActive: false },
      });

      const version = await prisma.tripVersion.create({
        data: {
          tripId: trip.id,
          versionNum,
          isActive: true,
        },
      });

      for (const day of days) {
        const unlockDate = addCalendarDaysUtc(startDate, day.dayNumber - 1);

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
          },
        });
      }

      await prisma.trip.update({
        where: { id: trip.id },
        data: {
          regenCount: versionNum,
          currentVersion: versionNum,
          status: "active",
        },
      });

      return { versionNum, daysCreated: numDays };
    });

    return { tripId: trip.id, ...result };
  }
);
