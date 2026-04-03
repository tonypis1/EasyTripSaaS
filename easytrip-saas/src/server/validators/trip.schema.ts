import { z } from "zod";

export const BUDGET_LEVELS = ["economy", "moderate", "premium"] as const;
export type BudgetLevel = (typeof BUDGET_LEVELS)[number];

export const createTripSchema = z.object({
  destination: z.string().min(2).max(120),
  startDate: z.coerce.date(),
  endDate: z.coerce.date(),
  tripType: z.enum(["solo", "coppia", "gruppo"]),
  style: z.string().min(2).max(120).optional(),
  budgetLevel: z.enum(BUDGET_LEVELS).default("moderate"),
});

export type CreateTripInput = z.infer<typeof createTripSchema>;

export const tripIdParamSchema = z.object({
  tripId: z.string().min(1),
});

export const setActiveVersionSchema = z.object({
  versionNum: z.coerce.number().int().min(1).max(7),
});

export const replaceSlotSchema = z.object({
  dayId: z.string().min(1),
  slot: z.enum(["morning", "afternoon", "evening"]),
  lat: z.number().finite().optional().nullable(),
  lng: z.number().finite().optional().nullable(),
});

export const updatePreferencesSchema = z.object({
  style: z.string().min(2).max(120).optional().nullable(),
  budgetLevel: z.enum(BUDGET_LEVELS),
});
