import { z } from "zod";

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

export type LiveSuggestion = z.infer<typeof SuggestionSchema>;

export type LiveSuggestResult = {
  suggestions: LiveSuggestion[];
  contextNote: string;
};

/** Parsing/validazione risposta AI (test e diagnostica, senza dipendenze da env/DB). */
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
      `Schema live suggest: ${check.error.issues
        .map((i) => i.message)
        .slice(0, 4)
        .join("; ")}`,
    );
  }
  return {
    suggestions: check.data.suggestions,
    contextNote: check.data.contextNote,
  };
}

export function extractJsonText(raw: string): string {
  const trimmed = raw.trim();
  const fence = /^```(?:json)?\s*([\s\S]*?)```/m;
  const m = trimmed.match(fence);
  if (m) return m[1].trim();
  return trimmed;
}
