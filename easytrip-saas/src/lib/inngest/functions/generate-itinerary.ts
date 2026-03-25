import { inngest } from "../client";
import { prisma } from "@/lib/prisma";
import {
  addCalendarDaysUtc,
  inclusiveCalendarDaysBetweenUtc,
} from "@/lib/calendar-date";
import { ANTHROPIC_MODEL, anthropic } from "@/lib/ai/anthropic";
import { resolveTripGeneratePayload } from "@/lib/inngest/trip-generate-payload";
import { z } from "zod";

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
- Per ogni slot (morning/afternoon/evening): "title" = nome breve e riconoscibile del punto di interesse nella destinazione (es. "Duomo", "Museo Diocesano", "centro storico"); "place" = zona, quartiere o dettaglio geografico (strada/quartiere), senza sostituire il nome del POI che sta in "title".
- Orari realistici e non sovrapposti (formato HH:mm). Inserisci un buffer di trasferimento (10-30 minuti) tra luogo e luogo.
- Suggerisci luoghi realmente plausibili per ${args.destination}.
- Indoor/Outdoor: almeno 1 slot per giorno deve includere un'opzione al coperto (pioggia) e un'opzione outdoor (se bel tempo).
- Metti in "tips" almeno:
  1) un consiglio meteo (pioggia/caldo) per quello slot,
  2) un micro-budget (es. "economico: ...", "media spesa: ...") senza prezzi numerici inventati.
- Testi in italiano semplice, utili e concreti (niente descrizioni vaghe).
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
  tips: z.array(z.string().min(1)).min(1).max(6),
});

const DayPlanSchema = z.object({
  dayNumber: z.coerce.number().int().min(1),
  title: z.string().min(1),
  morning: DaySlotSchema,
  afternoon: DaySlotSchema,
  evening: DaySlotSchema,
});

const ModelResponseSchema = z.object({
  days: z.array(DayPlanSchema),
});

function parseAndValidateModelJson(
  raw: string,
  numDays: number
): { days: DayPlan[] } {
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
        .slice(0, 3)
        .join("; ")}`
    );
  }

  const days = check.data.days as unknown as DayPlan[];
  if (days.length !== numDays) {
    throw new Error(
      `Numero giorni non valido: attesi ${numDays}, ottenuti ${days.length}`
    );
  }

  const byNum = new Map<number, DayPlan>();
  for (const d of days) byNum.set(d.dayNumber, d);
  for (let i = 1; i <= numDays; i++) {
    if (!byNum.has(i)) throw new Error(`Manca dayNumber=${i}`);
  }

  return {
    days: Array.from(
      { length: numDays },
      (_, idx) => byNum.get(idx + 1)!
    ),
  };
}

function buildRepairPrompt(
  basePrompt: string,
  previousRaw: string,
  reason: string
) {
  return `
Il tuo JSON non ha superato la validazione.
Motivo: ${reason}

Rigenera SOLO JSON valido che rispetta esattamente il formato richiesto.

${basePrompt}

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

    const days = await step.run(
      "genera-con-claude",
      async (): Promise<DayPlan[]> => {
        const basePrompt = buildPrompt({
          destination: trip.destination,
          startDate: startDate.toISOString().slice(0, 10),
          endDate: endDate.toISOString().slice(0, 10),
          tripType: trip.tripType,
          style: trip.style,
          numDays,
        });

        const maxAttempts = 3;
        let lastErr: unknown = null;
        let lastRaw = "";

        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
          const response = await anthropic.messages.create({
            model: ANTHROPIC_MODEL,
            max_tokens: 10000,
            temperature: attempt === 1 ? 0.35 : 0.2,
            system:
              "Rispondi sempre solo con JSON valido, senza markdown e senza testo extra.",
            messages: [{ role: "user", content: basePrompt }],
          });

          const textBlock = response.content.find((c) => c.type === "text");
          if (!textBlock || textBlock.type !== "text") {
            throw new Error("Claude non ha restituito un blocco testuale");
          }

          lastRaw = textBlock.text;

          try {
            const ai = parseAndValidateModelJson(lastRaw, numDays);
            return ai.days;
          } catch (e) {
            lastErr = e;
            if (attempt === maxAttempts) break;

            const reason = e instanceof Error ? e.message : "errore sconosciuto";
            const repairPrompt = buildRepairPrompt(
              basePrompt,
              lastRaw,
              reason
            );

            // Secondo tentativo: usiamo un prompt di correzione
            const repairResponse = await anthropic.messages.create({
              model: ANTHROPIC_MODEL,
              max_tokens: 10000,
              temperature: 0.2,
              system:
                "Rispondi sempre solo con JSON valido, senza markdown e senza testo extra.",
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
              const ai = parseAndValidateModelJson(lastRaw, numDays);
              return ai.days;
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
