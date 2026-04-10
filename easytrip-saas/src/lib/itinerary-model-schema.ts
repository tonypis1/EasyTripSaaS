import { z } from "zod";

/** Claude a volte avvolge il JSON in ```json ... ``` */
export function extractJsonText(raw: string): string {
  const trimmed = raw.trim();
  const fence = /^```(?:json)?\s*([\s\S]*?)```/m;
  const m = trimmed.match(fence);
  if (m) return m[1].trim();
  return trimmed;
}

export const RestaurantEntrySchema = z.object({
  meal: z.enum(["pranzo", "cena"]),
  name: z.string().min(1),
  cuisine: z.string().min(1),
  why: z.string().min(1),
  budgetHint: z.string().min(1),
  distance: z.string().min(1),
  reservationNeeded: z.boolean(),
  reservationTip: z.string().default(""),
});

export const DaySlotSchema = z.object({
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

export const DayPlanExtendedSchema = z.object({
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

export const ModelResponseSchema = z.object({
  optimizationScore: z.coerce.number().min(1).max(10),
  days: z.array(DayPlanExtendedSchema),
});

export type DaySlot = z.infer<typeof DaySlotSchema>;
export type RestaurantEntry = z.infer<typeof RestaurantEntrySchema>;
export type DayPlanExtended = z.infer<typeof DayPlanExtendedSchema>;

export function parseAndValidateModelJson(
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
  for (const d of days) byNum.set(d.dayNumber, d);
  for (let i = 1; i <= numDays; i++) {
    if (!byNum.has(i)) throw new Error(`Manca dayNumber=${i}`);
  }

  return {
    optimizationScore,
    days: Array.from({ length: numDays }, (_, idx) => byNum.get(idx + 1)!),
  };
}
