import { prisma } from "@/lib/prisma";
import { ANTHROPIC_MODEL, anthropic } from "@/lib/ai/anthropic";
import { AppError } from "@/server/errors/AppError";
import { z } from "zod";

const SlotKeySchema = z.enum(["morning", "afternoon", "evening"]);

const SLOT_ORDER = ["morning", "afternoon", "evening"] as const;

const SLOT_LABEL: Record<string, string> = {
  morning: "Mattina",
  afternoon: "Pomeriggio",
  evening: "Sera",
};

function normalizeTime(s: string): string {
  const [h, m] = s.split(":");
  return `${String(h).padStart(2, "0")}:${m}`;
}

const DaySlotSchema = z.object({
  title: z.string().min(1),
  place: z.string().min(1),
  why: z.string().min(1),
  startTime: z
    .string()
    .regex(/^\d{1,2}:\d{2}$/)
    .transform(normalizeTime),
  endTime: z
    .string()
    .regex(/^\d{1,2}:\d{2}$/)
    .transform(normalizeTime),
  durationMin: z.coerce.number().int().min(10).max(600),
  googleMapsQuery: z.string().min(3),
  bookingLink: z.union([z.string().url(), z.null()]).default(null),
  tips: z.array(z.string().min(1)).min(1).max(6),
  lat: z.union([z.number(), z.null()]).default(null),
  lng: z.union([z.number(), z.null()]).default(null),
});

const AlternativeSchema = z.object({
  name: z.string().min(1),
  distance: z.string().min(1),
  note: z.string().min(1),
});

const EnrichedResponseSchema = z.object({
  replacement: DaySlotSchema,
  whyNotOriginal: z.string().min(1),
  geoContinuityNote: z.string().min(1),
  dayRouteUpdated: z.string().min(1),
  alternatives: z.array(AlternativeSchema).min(2).max(2),
});

export type SlotAlternative = z.infer<typeof AlternativeSchema>;

export type EnrichedSlotResult = {
  replacement: z.infer<typeof DaySlotSchema>;
  whyNotOriginal: string;
  geoContinuityNote: string;
  dayRouteUpdated: string;
  alternatives: SlotAlternative[];
};

function extractJsonText(raw: string): string {
  const trimmed = raw.trim();
  const fence = /^```(?:json)?\s*([\s\S]*?)```/m;
  const m = trimmed.match(fence);
  if (m) return m[1].trim();
  return trimmed;
}

function slotSummary(raw: string | null, label: string): string {
  if (!raw || raw === "{}" || raw === "null") return `${label}: vuoto`;
  try {
    const o = JSON.parse(raw) as Record<string, unknown>;
    const title = o.title ?? "?";
    const place = o.place ?? "";
    const start = o.startTime ?? "?";
    const end = o.endTime ?? "?";
    return `${label}: "${title}" — ${place} (${start}–${end})`;
  } catch {
    return `${label}: dati non leggibili`;
  }
}

function buildSystemPrompt(): string {
  return [
    "Sei EasyTrip AI in modalità sostituzione slot.",
    "Devi sostituire UNA SINGOLA attività nell'itinerario di un utente.",
    "NON rigenerare l'intero giorno. NON toccare gli altri slot.",
    "Mantieni la coerenza geografica con le attività ADIACENTI (precedente e successiva).",
    "Rispetta il vincolo di quartiere/zona se presente.",
    "Aggiungi SEMPRE 2 alternative contestuali con nota sul timing/apertura.",
    "Se un'alternativa ha restrizioni orarie, spiegale chiaramente.",
    "Rispondi SOLO con JSON valido, zero testo extra, zero markdown.",
  ].join(" ");
}

function buildUserPrompt(args: {
  destination: string;
  dayNumber: number;
  slotKey: string;
  currentSlotRaw: string;
  allSlotsSummary: string;
  prevActivity: string;
  nextActivity: string;
  zoneFocus: string | null;
  budgetLevel: string;
  style: string | null;
  gpsHint: string;
}): string {
  const zoneBlock = args.zoneFocus
    ? `Vincolo zona: rimani in "${args.zoneFocus}" o zone immediatamente adiacenti.`
    : "Nessun vincolo di zona specifico; mantieni coerenza con il resto della giornata.";

  return `
CONTESTO GIORNATA
Destinazione: ${args.destination}
Giorno: ${args.dayNumber}
Budget: ${args.budgetLevel}
Stile viaggio: ${args.style ?? "non specificato"}
${zoneBlock}

PROGRAMMA COMPLETO DEL GIORNO (tutti gli slot):
${args.allSlotsSummary}

SLOT DA SOSTITUIRE: ${SLOT_LABEL[args.slotKey] ?? args.slotKey}
Contenuto attuale (JSON):
${args.currentSlotRaw}

ATTIVITÀ ADIACENTI (per coerenza geografica):
- Attività PRECEDENTE: ${args.prevActivity}
- Attività SUCCESSIVA: ${args.nextActivity}
La sostituzione deve integrarsi nel percorso della giornata tra queste due attività. Evita spostamenti lunghi o rientri inutili.

POSIZIONE UTENTE
${args.gpsHint}

OUTPUT ATTESO
Rispondi con un UNICO oggetto JSON con questa struttura:
{
  "replacement": {
    "title": "nome breve del POI",
    "place": "quartiere/strada",
    "why": "perché è consigliato (specifico, non generico)",
    "startTime": "HH:mm",
    "endTime": "HH:mm",
    "durationMin": 150,
    "googleMapsQuery": "Nome POI Città Quartiere",
    "bookingLink": "https://..." oppure null se non serve prenotazione,
    "tips": ["consiglio 1", "consiglio 2"],
    "lat": 41.9029,
    "lng": 12.4534
  },
  "whyNotOriginal": "Spiega perché questa alternativa è migliore/diversa rispetto allo slot rimosso (es. meno affollato, più autentico, orario migliore)",
  "geoContinuityNote": "Spiega come la sostituzione si integra nel percorso del giorno (es. 'A 5 min a piedi dal pranzo, sulla strada verso i Jardins')",
  "dayRouteUpdated": "Riassunto percorso aggiornato (es. 'Pranzo Quimet → 5 min → El Sortidor → 5 min → Jardins')",
  "alternatives": [
    { "name": "Nome alternativa 1", "distance": "Xm · Y min a piedi", "note": "Nota su timing/apertura/contesto" },
    { "name": "Nome alternativa 2", "distance": "Xm · Y min a piedi", "note": "Nota su timing/apertura/contesto" }
  ]
}

REGOLE
- Orari HH:mm, realistici, coerenti con la fascia (mattina/pomeriggio/sera).
- "durationMin": intero, calcolato da startTime/endTime (es. 09:00→11:30 = 150).
- "googleMapsQuery": nome leggibile del POI + città/quartiere (es. "Fontana di Trevi Roma Centro"). NON coordinate.
- "bookingLink": URL reale per prenotare/biglietti (GetYourGuide, Tiqets, sito ufficiale, TheFork) o null se non serve. NON inventare URL.
- NON duplicare attività già presenti negli altri slot del giorno.
- ESCLUDI lo slot rimosso e posti nello stesso isolato.
- Se un'alternativa ha restrizioni orarie (apre tardi, chiude presto), spiegalo nella "note".
- "lat" e "lng" nel replacement DEVONO essere le coordinate WGS84 reali del POI specifico. NON usare coordinate generiche del centro città.
- Testi in italiano chiaro e concreto.
`.trim();
}

export class SlotReplaceService {
  async replaceSlot(input: {
    organizerId: string;
    tripId: string;
    dayId: string;
    slot: "morning" | "afternoon" | "evening";
    lat: number | null;
    lng: number | null;
  }): Promise<EnrichedSlotResult> {
    const slotParsed = SlotKeySchema.safeParse(input.slot);
    if (!slotParsed.success) {
      throw new AppError("Slot non valido", 400, "INVALID_SLOT");
    }

    const day = await prisma.day.findFirst({
      where: { id: input.dayId },
      include: {
        tripVersion: {
          include: {
            trip: true,
          },
        },
      },
    });

    if (!day || day.tripVersion.trip.id !== input.tripId) {
      throw new AppError("Giorno non trovato", 404, "DAY_NOT_FOUND");
    }

    if (day.tripVersion.trip.organizerId !== input.organizerId) {
      throw new AppError("Non autorizzato", 403, "FORBIDDEN");
    }

    const trip = day.tripVersion.trip;
    const currentRaw =
      input.slot === "morning"
        ? day.morning
        : input.slot === "afternoon"
          ? day.afternoon
          : day.evening;

    const slotIdx = SLOT_ORDER.indexOf(input.slot);
    const prevKey = slotIdx > 0 ? SLOT_ORDER[slotIdx - 1] : null;
    const nextKey = slotIdx < 2 ? SLOT_ORDER[slotIdx + 1] : null;

    const slotContents: Record<string, string | null> = {
      morning: day.morning,
      afternoon: day.afternoon,
      evening: day.evening,
    };

    const allSlotsSummary = SLOT_ORDER.map((k) =>
      slotSummary(slotContents[k], SLOT_LABEL[k]),
    ).join("\n");

    const prevActivity = prevKey
      ? slotSummary(slotContents[prevKey], SLOT_LABEL[prevKey])
      : "Nessuna (è il primo slot della giornata)";

    const nextActivity = nextKey
      ? slotSummary(slotContents[nextKey], SLOT_LABEL[nextKey])
      : "Nessuna (è l'ultimo slot della giornata)";

    const gpsHint =
      input.lat != null && input.lng != null
        ? `GPS utente: lat ${input.lat.toFixed(5)}, lng ${input.lng.toFixed(5)}. Preferisci luoghi raggiungibili da questa posizione. Calcola le distanze da questo punto.`
        : `GPS non fornito. Scegli alternative coerenti con il percorso della giornata nella zona "${day.zoneFocus ?? trip.destination}".`;

    const prompt = buildUserPrompt({
      destination: trip.destination,
      dayNumber: day.dayNumber,
      slotKey: input.slot,
      currentSlotRaw: currentRaw ?? "{}",
      allSlotsSummary,
      prevActivity,
      nextActivity,
      zoneFocus: day.zoneFocus,
      budgetLevel: trip.budgetLevel ?? "moderate",
      style: trip.style,
      gpsHint,
    });

    const response = await anthropic.messages.create({
      model: ANTHROPIC_MODEL,
      max_tokens: 3000,
      temperature: 0.35,
      system: buildSystemPrompt(),
      messages: [{ role: "user", content: prompt }],
    });

    const textBlock = response.content.find((c) => c.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      throw new AppError("Risposta AI non valida", 502, "AI_ERROR");
    }

    const text = extractJsonText(textBlock.text);
    let parsed: unknown;
    try {
      parsed = JSON.parse(text) as unknown;
    } catch {
      throw new AppError("JSON non valido dal modello", 502, "AI_PARSE");
    }

    const check = EnrichedResponseSchema.safeParse(parsed);
    if (!check.success) {
      throw new AppError(
        `Schema non conforme: ${check.error.issues.map((i) => i.message).slice(0, 3).join("; ")}`,
        502,
        "AI_SCHEMA",
      );
    }

    const result = check.data;

    const field =
      input.slot === "morning"
        ? "morning"
        : input.slot === "afternoon"
          ? "afternoon"
          : "evening";

    await prisma.day.update({
      where: { id: day.id },
      data: { [field]: JSON.stringify(result.replacement) },
    });

    return {
      replacement: result.replacement,
      whyNotOriginal: result.whyNotOriginal,
      geoContinuityNote: result.geoContinuityNote,
      dayRouteUpdated: result.dayRouteUpdated,
      alternatives: result.alternatives,
    };
  }
}
