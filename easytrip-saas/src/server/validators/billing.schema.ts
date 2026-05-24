import { z } from "zod";

const appLocaleSchema = z.enum(["it", "en", "es", "fr", "de"]);

export const createCheckoutSchema = z.object({
  tripId: z.string().min(1),
  /** Lingua UI al momento dell'acquisto (email + generazione itinerario). */
  locale: appLocaleSchema.optional(),
  successUrl: z.string().url().optional(),
  cancelUrl: z.string().url().optional(),
});

export type CreateCheckoutInput = z.infer<typeof createCheckoutSchema>;

export const createRegenCheckoutSchema = z.object({
  tripId: z.string().min(1),
  successUrl: z.string().url().optional(),
  cancelUrl: z.string().url().optional(),
});

export type CreateRegenCheckoutInput = z.infer<
  typeof createRegenCheckoutSchema
>;

export const createReactivateCheckoutSchema = z.object({
  tripId: z.string().min(1),
  successUrl: z.string().url().optional(),
  cancelUrl: z.string().url().optional(),
});

export type CreateReactivateCheckoutInput = z.infer<
  typeof createReactivateCheckoutSchema
>;

export const createSubscriptionCheckoutSchema = z.object({
  successUrl: z.string().url().optional(),
  cancelUrl: z.string().url().optional(),
});

export type CreateSubscriptionCheckoutInput = z.infer<
  typeof createSubscriptionCheckoutSchema
>;
