import { roundCoordForAi } from "@/lib/geo-privacy";
import { prisma } from "@/lib/prisma";
import { ANTHROPIC_MODEL, anthropic } from "@/lib/ai/anthropic";
import { AppError } from "@/server/errors/AppError";
import { z } from "zod";

const REASONS: Record<string, string> = {
  closed: "il posto previsto è chiuso o inaccessibile",
  crowded: "il posto previsto è troppo affollato / lunga coda",
  weather: "il meteo è sfavorevole (pioggia, troppo caldo/freddo)",
  bored: "l'utente vuole qualcosa di diverso / non è interessato",
  early: "l'utente ha finito prima del previsto e ha tempo libero",
  other: "motivo non specificato",
};

const SuggestionSchema = z.object({
  name: z.string().min(1),
  type: z.string().min(1),
  distance: z.string().min(1),
  walkMin: z.coerce.number().int().min(0).max(120),
  why: z.string().min(10),
  durationMin: z.coerce.number().int().min(10).max(480),
  googleMapsQuery: z.string().min(3),
  bookingLink: z.union([z.string().url(), z.null()]).default(null),
  indoor: z.boolean(),
  budgetHint: z.string().min(1),
  tips: z.array(z.string().min(1)).min(1).max(3),
  lat: z.union([z.number(), z.null()]).default(null),
  lng: z.union([z.number(), z.null()]).default(null),
});

export const LiveResponseSchema = z.object({
  suggestions: z.array(SuggestionSchema).min(3).max(3),
  contextNote: z.string().min(1),
});

/** Parsing/validazione risposta AI (test e diagnostica). */
export function parseLiveSuggestModelJson(raw: string): LiveSuggestResult {
  const text = extractJsonText(raw);
  let parsed: unknown;
  try {
    parsed = JSON.parse(text) as unknown;
  } catch {
    throw new Error("LIVE_SUGGEST_JSON_PARSE");
  }
  const check = LiveResponseSchema.safeParse(parsed);
  if (!check.success) {
    throw new Error(
      `Schema live suggest: ${check.error.issues.map((i) => i.message).slice(0, 4).join("; ")}`
    );
  }
  return {
    suggestions: check.data.suggestions,
    contextNote: check.data.contextNote,
  };
}

export type LiveSuggestion = z.infer<typeof SuggestionSchema>;

export type LiveSuggestResult = {
  suggestions: LiveSuggestion[];
  contextNote: string;
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
    return `${label}: "${o.title ?? "?"}" — ${o.place ?? "?"} (${o.startTime ?? "?"}–${o.endTime ?? "?"})`;
  } catch {
    return `${label}: dati non leggibili`;
  }
}

function buildSystemPrompt(): string {
  return [
    "Sei EasyTrip AI in modalità assistente live durante il viaggio.",
    "L'utente è FISICAMENTE sul posto e ha bisogno di aiuto ORA.",
    "Devi suggerire 3 alternative REALI raggiungibili a piedi dalla posizione attuale.",
    "Priorità assoluta: distanza breve, apertura garantita, esperienza di qualità.",
    "NON suggerire posti che richiedono trasporto pubblico o taxi se non esplicitamente richiesto.",
    "Rispondi SOLO con JSON valido, zero testo extra, zero markdown.",
  ].join(" ");
}

function buildUserPrompt(args: {
  destination: string;
  dayNumber: number;
  lat: number;
  lng: number;
  reason: string;
  reasonDetail: string;
  currentSlotSummary: string;
  allSlotsSummary: string;
  budgetLevel: string;
  style: string | null;
  timeOfDay: string;
}): string {
  return `
SITUAZIONE LIVE
L'utente è in viaggio a ${args.destination}, giorno ${args.dayNumber}.
Posizione approssimativa (precisione ridotta): lat ${args.lat}, lng ${args.lng}
Momento della giornata: ${args.timeOfDay}
Motivo della richiesta: ${args.reasonDetail}

PROGRAMMA ORIGINALE DEL GIORNO:
${args.allSlotsSummary}

SLOT PROBLEMATICO (se applicabile):
${args.currentSlotSummary}

PREFERENZE UTENTE:
- Budget: ${args.budgetLevel}
- Stile: ${args.style ?? "non specificato"}

OUTPUT ATTESO
Rispondi con un unico oggetto JSON:
{
  "contextNote": "Frase breve che riconosce la situazione dell'utente (es. 'Capisco, il museo è chiuso. Ecco 3 alternative vicinissime a te!')",
  "suggestions": [
    {
      "name": "Nome del posto",
      "type": "Categoria (es. museo, caffè, parco, mercato, chiesa, viewpoint, street art, gelateria)",
      "distance": "Distanza dalla posizione attuale (es. '200m', '5 min a piedi')",
      "walkMin": 5,
      "why": "Perché è perfetto per questa situazione specifica (concreto, non generico)",
      "durationMin": 45,
      "googleMapsQuery": "Nome Posto Città Quartiere",
      "bookingLink": null,
      "indoor": true,
      "budgetHint": "Gratis / €5-10 / €10-20",
      "tips": ["Un consiglio pratico e specifico"],
      "lat": 41.9029,
      "lng": 12.4534
    }
  ]
}

REGOLE FONDAMENTALI
- Esattamente 3 suggerimenti, ordinati per distanza crescente (il più vicino prima).
- Ogni suggerimento DEVE essere raggiungibile a piedi (max 15 minuti / ~1.2km dalla posizione GPS).
- "walkMin": tempo reale di camminata in minuti dalla posizione GPS dell'utente.
- "distance": formato leggibile (es. "200m", "450m · 6 min a piedi").
- "durationMin": durata consigliata della visita in minuti.
- "googleMapsQuery": nome leggibile del posto + città/quartiere per ricerca Maps precisa.
- "bookingLink": URL reale per prenotazione/biglietti, oppure null. NON inventare URL.
- "indoor": true se al coperto, false se all'aperto. IMPORTANTE per motivi meteo.
- "lat"/"lng": coordinate WGS84 reali del posto specifico. NON le coordinate dell'utente.
- Varia le categorie: es. non 3 musei, ma 1 museo + 1 caffè + 1 parco.
- NON suggerire posti già presenti nel programma del giorno.
- Se il motivo è "meteo", privilegia opzioni indoor.
- Se il motivo è "affollato", suggerisci posti meno turistici / gemme locali.
- Se il motivo è "tempo libero", suggerisci esperienze complementari al programma.
- Usa SOLO posti reali e conosciuti della destinazione.
- Testi in italiano chiaro, conciso e utile.
`.trim();
}

export class LiveSuggestService {
  async suggest(input: {
    organizerId: string;
    tripId: string;
    dayId: string;
    lat: number;
    lng: number;
    reason: string;
    currentSlot: string | null;
  }): Promise<LiveSuggestResult> {
    const day = await prisma.day.findFirst({
      where: { id: input.dayId },
      include: {
        tripVersion: {
          include: { trip: true },
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
    const reasonDetail = REASONS[input.reason] ?? REASONS.other;

    const allSlotsSummary = [
      slotSummary(day.morning, "Mattina"),
      slotSummary(day.afternoon, "Pomeriggio"),
      slotSummary(day.evening, "Sera"),
    ].join("\n");

    const currentSlotSummary = input.currentSlot
      ? slotSummary(
          input.currentSlot === "morning"
            ? day.morning
            : input.currentSlot === "afternoon"
              ? day.afternoon
              : input.currentSlot === "evening"
                ? day.evening
                : null,
          input.currentSlot,
        )
      : "Nessuno slot specifico — l'utente cerca suggerimenti generici";

    const hour = new Date().getUTCHours() + 1;
    const timeOfDay =
      hour < 12 ? "mattina" : hour < 17 ? "pomeriggio" : "sera";

    const prompt = buildUserPrompt({
      destination: trip.destination,
      dayNumber: day.dayNumber,
      lat: roundCoordForAi(input.lat),
      lng: roundCoordForAi(input.lng),
      reason: input.reason,
      reasonDetail,
      currentSlotSummary,
      allSlotsSummary,
      budgetLevel: trip.budgetLevel ?? "moderate",
      style: trip.style,
      timeOfDay,
    });

    const response = await anthropic.messages.create({
      model: ANTHROPIC_MODEL,
      max_tokens: 3000,
      temperature: 0.4,
      system: buildSystemPrompt(),
      messages: [{ role: "user", content: prompt }],
    });

    const textBlock = response.content.find((c) => c.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      throw new AppError("Risposta AI non valida", 502, "AI_ERROR");
    }

    const rawText = extractJsonText(textBlock.text);
    try {
      return parseLiveSuggestModelJson(rawText);
    } catch (e) {
      if (e instanceof Error) {
        if (e.message === "LIVE_SUGGEST_JSON_PARSE") {
          throw new AppError("JSON non valido dal modello", 502, "AI_PARSE");
        }
        if (e.message.startsWith("Schema live suggest:")) {
          throw new AppError(
            `Schema non conforme: ${e.message.replace(/^Schema live suggest:\s*/, "")}`,
            502,
            "AI_SCHEMA",
          );
        }
      }
      throw e;
    }
  }
}
