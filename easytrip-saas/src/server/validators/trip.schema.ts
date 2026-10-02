import { z } from "zod";
import {
  preferencesCreateShape,
  preferencesUpdateShape,
  sensitiveConsentShape,
} from "@/lib/trip/preferences";

export const BUDGET_LEVELS = ["economy", "moderate", "premium"] as const;
export type BudgetLevel = (typeof BUDGET_LEVELS)[number];

export const createTripSchema = z.object({
  destination: z.string().min(2).max(120),
  startDate: z.coerce.date(),
  endDate: z.coerce.date(),
  tripType: z.enum(["solo", "coppia", "gruppo"]),
  style: z.string().min(2).max(120).optional(),
  budgetLevel: z.enum(BUDGET_LEVELS).default("moderate"),
  /** Preferenze strutturate (facoltative): interessi, ritmo, mobilità, restrizioni alimentari. */
  ...preferencesCreateShape,
  /** Consenso esplicito (art. 9) se tra le preferenze ci sono scelte sensibili. */
  ...sensitiveConsentShape,
  /** Add-on LocalPass: numero di città (0 = nessun add-on). */
  localPassCityCount: z.coerce.number().int().min(0).max(30).default(0),
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
  /** Campo omesso = invariato; `[]` / `null` = azzera. */
  ...preferencesUpdateShape,
  /** Omesso = resta il consenso già dato (se le scelte restano sensibili). */
  ...sensitiveConsentShape,
});

export const liveSuggestSchema = z.object({
  dayId: z.string().min(1),
  lat: z.number().finite(),
  lng: z.number().finite(),
  reason: z
    .enum(["closed", "crowded", "weather", "bored", "early", "other"])
    .default("other"),
  currentSlot: z
    .enum(["morning", "afternoon", "evening"])
    .optional()
    .nullable(),
  /**
   * Ora locale del dispositivo dell'utente (0-23), NON quella del server.
   * L'utente è fisicamente sul posto: solo il client conosce l'ora reale
   * della destinazione (gestisce fuso e ora legale nativamente via `Date`).
   */
  localHour: z.number().int().min(0).max(23),
});
