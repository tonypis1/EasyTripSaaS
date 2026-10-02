import { roundCoordForAi } from "@/lib/geo-privacy";
import { prisma } from "@/lib/prisma";
import {
  ANTHROPIC_MODEL,
  SYNC_REQUEST_OPTIONS,
  anthropic,
  toAiUnavailableError,
  SYNC_OUTPUT_CONFIG,
} from "@/lib/ai/anthropic";
import {
  normalizeAiLocale,
  systemLanguageDirective,
  userLanguageReminder,
  type SupportedAiLocale,
} from "@/lib/ai/prompt-locale";
import { AppError } from "@/server/errors/AppError";
import { DaySlotSchema } from "@/lib/itinerary-model-schema";
import { generateWithRepair } from "@/lib/ai/repairLoop";
import { SlotProposalRepository } from "@/server/repositories/SlotProposalRepository";
import { GeoScoreService } from "@/server/services/trip/geoScoreService";
import {
  plannedElsewherePromptBlock,
  readStoredSlot,
  slotSummary,
} from "@/lib/trip/day-slots";
import {
  buildPreferencesPromptBlock,
  preferencesFromTrip,
} from "@/lib/trip/preferences";
import { logger } from "@/lib/observability";
import { z } from "zod";

const SlotKeySchema = z.enum(["morning", "afternoon", "evening"]);

const SLOT_ORDER = ["morning", "afternoon", "evening"] as const;

const SLOT_LABEL: Record<string, string> = {
  morning: "Mattina",
  afternoon: "Pomeriggio",
  evening: "Sera",
};

/**
 * Alternativa proposta al gruppo: uno slot COMPLETO (stessa forma di
 * `replacement`), così se vince il voto si applica senza un'altra chiamata AI.
 * `name` è derivato dal titolo dello slot, per la UI che mostra l'elenco.
 */
const AlternativeSchema = z
  .object({
    distance: z.string().min(1),
    note: z.string().min(1),
    slot: DaySlotSchema,
  })
  .transform((alt) => ({ ...alt, name: alt.slot.title }));

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
  /** Bozza di votazione di gruppo con le alternative (solo viaggi con almeno 2 membri). */
  proposalId: string | null;
};

function extractJsonText(raw: string): string {
  const trimmed = raw.trim();
  const fence = /^```(?:json)?\s*([\s\S]*?)```/m;
  const m = trimmed.match(fence);
  if (m) return m[1].trim();
  return trimmed;
}

function parseSlotReplaceModelJson(
  raw: string,
): Omit<EnrichedSlotResult, "proposalId"> {
  const text = extractJsonText(raw);
  let parsed: unknown;
  try {
    parsed = JSON.parse(text) as unknown;
  } catch {
    throw new AppError("JSON non valido dal modello", 502, "AI_PARSE");
  }

  const check = EnrichedResponseSchema.safeParse(parsed);
  if (!check.success) {
    throw new AppError(
      `Schema non conforme: ${check.error.issues
        .map((i) => i.message)
        .slice(0, 3)
        .join("; ")}`,
      502,
      "AI_SCHEMA",
    );
  }

  return check.data;
}

/** Un solo tentativo di riparazione: sufficiente per gli errori di schema più comuni, e resta sotto il maxDuration della route (v. replace-slot/route.ts). */
const MAX_ATTEMPTS = 2;

function buildSystemPrompt(locale: SupportedAiLocale): string {
  return [
    "Sei EasyTrip AI in modalità sostituzione slot.",
    "Devi sostituire UNA SINGOLA attività nell'itinerario di un utente.",
    "NON rigenerare l'intero giorno. NON toccare gli altri slot.",
    "Mantieni la coerenza geografica con le attività ADIACENTI (precedente e successiva).",
    "Rispetta il vincolo di quartiere/zona se presente.",
    "Aggiungi SEMPRE 2 alternative contestuali, ciascuna uno slot completo e applicabile, con nota sul timing/apertura.",
    "Se un'alternativa ha restrizioni orarie, spiegale chiaramente.",
    "Rispondi SOLO con JSON valido, zero testo extra, zero markdown.",
    systemLanguageDirective(locale),
  ].join(" ");
}

function buildUserPrompt(args: {
  destination: string;
  dayNumber: number;
  slotKey: string;
  currentSlotJson: string;
  allSlotsSummary: string;
  prevActivity: string;
  nextActivity: string;
  zoneFocus: string | null;
  budgetLevel: string;
  style: string | null;
  /** Preferenze strutturate del viaggio (mobilità, ritmo, restrizioni…) o null. */
  preferencesBlock: string | null;
  /** Luoghi già in programma negli altri giorni, o null. */
  plannedElsewhereBlock: string | null;
  gpsHint: string;
  locale: SupportedAiLocale;
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
${args.preferencesBlock ? `\n${args.preferencesBlock}\n` : ""}

PROGRAMMA COMPLETO DEL GIORNO (tutti gli slot):
${args.allSlotsSummary}
${args.plannedElsewhereBlock ? `\n${args.plannedElsewhereBlock}\nVale sia per il sostituto sia per le alternative.\n` : ""}
SLOT DA SOSTITUIRE: ${SLOT_LABEL[args.slotKey] ?? args.slotKey}
Contenuto attuale (JSON):
${args.currentSlotJson}

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
    {
      "distance": "Xm · Y min a piedi",
      "note": "Nota su timing/apertura/contesto",
      "slot": {
        "title": "nome breve del POI",
        "place": "quartiere/strada",
        "why": "perché è consigliato (specifico, non generico)",
        "startTime": "HH:mm",
        "endTime": "HH:mm",
        "durationMin": 150,
        "googleMapsQuery": "Nome POI Città Quartiere",
        "bookingLink": null,
        "tips": ["consiglio 1"],
        "lat": 41.9029,
        "lng": 12.4534
      }
    },
    { "distance": "...", "note": "...", "slot": { "...": "stessi campi dell'alternativa 1" } }
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
- Le 2 alternative sono slot COMPLETI e applicabili al posto di "replacement": stessi campi e stesse regole (orari HH:mm coerenti con la fascia, coordinate WGS84 reali, "bookingLink" reale o null). Devono essere diverse tra loro, da "replacement" e dagli altri slot del giorno.
- "lat" e "lng" nel replacement DEVONO essere le coordinate WGS84 reali del POI specifico. NON usare coordinate generiche del centro città.
- LINGUA DI RISPOSTA: ${userLanguageReminder(args.locale)} Tutti i campi testuali liberi del JSON (title, place, why, tips, whyNotOriginal, geoContinuityNote, dayRouteUpdated, alternatives[].note, ecc.) DEVONO essere in questa lingua.
`.trim();
}

export class SlotReplaceService {
  constructor(
    private readonly proposals: SlotProposalRepository = new SlotProposalRepository(),
    private readonly geoScore: GeoScoreService = new GeoScoreService(),
  ) {}

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
            trip: {
              include: {
                organizer: { select: { language: true } },
                _count: { select: { members: true } },
              },
            },
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

    const slotContents: Record<string, unknown> = {
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

    const otherDays = await prisma.day.findMany({
      where: { tripVersionId: day.tripVersionId, id: { not: day.id } },
      select: { morning: true, afternoon: true, evening: true },
      orderBy: { dayNumber: "asc" },
    });

    const gpsHint =
      input.lat != null && input.lng != null
        ? `Area approssimativa utente (precisione ridotta): lat ${roundCoordForAi(input.lat)}, lng ${roundCoordForAi(input.lng)}. Preferisci luoghi raggiungibili da questa zona. Calcola le distanze da questo punto.`
        : `GPS non fornito. Scegli alternative coerenti con il percorso della giornata nella zona "${day.zoneFocus ?? trip.destination}".`;

    const locale = normalizeAiLocale(trip.organizer?.language);
    const prompt = buildUserPrompt({
      destination: trip.destination,
      dayNumber: day.dayNumber,
      slotKey: input.slot,
      currentSlotJson: JSON.stringify(readStoredSlot(currentRaw) ?? {}),
      allSlotsSummary,
      prevActivity,
      nextActivity,
      zoneFocus: day.zoneFocus,
      budgetLevel: trip.budgetLevel ?? "moderate",
      style: trip.style,
      preferencesBlock: buildPreferencesPromptBlock(
        preferencesFromTrip(trip),
        "slot",
      ),
      plannedElsewhereBlock: plannedElsewherePromptBlock(otherDays),
      gpsHint,
      locale,
    });

    const result = await generateWithRepair({
      maxAttempts: MAX_ATTEMPTS,
      parse: parseSlotReplaceModelJson,
      callModel: async (repairSuffix) => {
        const content = repairSuffix ? `${prompt}\n\n${repairSuffix}` : prompt;

        let response;
        try {
          response = await anthropic.messages.create(
            {
              model: ANTHROPIC_MODEL,
              max_tokens: 3000,
              output_config: SYNC_OUTPUT_CONFIG,
              system: buildSystemPrompt(locale),
              messages: [{ role: "user", content }],
            },
            SYNC_REQUEST_OPTIONS,
          );
        } catch (error) {
          throw toAiUnavailableError(error);
        }

        const textBlock = response.content.find((c) => c.type === "text");
        if (!textBlock || textBlock.type !== "text") {
          throw new AppError("Risposta AI non valida", 502, "AI_ERROR");
        }
        return textBlock.text;
      },
    });

    const field =
      input.slot === "morning"
        ? "morning"
        : input.slot === "afternoon"
          ? "afternoon"
          : "evening";

    await prisma.day.update({
      where: { id: day.id },
      data: { [field]: result.replacement },
    });
    // Le coordinate dello slot sono cambiate: riallinea il GeoScore della versione.
    await this.geoScore.refreshForVersion(day.tripVersionId);

    // Con almeno 2 membri le alternative diventano una bozza di votazione,
    // salvata dal server (mai ricevuta dal client: il contenuto che il gruppo
    // vota e che verrà applicato allo slot non è manipolabile dai membri).
    // Non deve far fallire la sostituzione, già applicata.
    let proposalId: string | null = null;
    if (trip._count.members >= 2) {
      try {
        const draft = await this.proposals.createDraft({
          dayId: day.id,
          slotKey: input.slot,
          options: [
            { slot: result.replacement, distance: null, note: null },
            ...result.alternatives.map((alt) => ({
              slot: alt.slot,
              distance: alt.distance,
              note: alt.note,
            })),
          ],
        });
        proposalId = draft.id;
      } catch (error) {
        logger.warn("Bozza di votazione non creata", {
          dayId: day.id,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    return {
      replacement: result.replacement,
      whyNotOriginal: result.whyNotOriginal,
      geoContinuityNote: result.geoContinuityNote,
      dayRouteUpdated: result.dayRouteUpdated,
      alternatives: result.alternatives,
      proposalId,
    };
  }
}
