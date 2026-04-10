import { z } from "zod";

export const createCheckoutSchema = z.object({
  tripId: z.string().min(1),
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
