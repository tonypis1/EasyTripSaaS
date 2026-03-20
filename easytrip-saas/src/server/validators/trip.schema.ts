import { z } from "zod";

export const createTripSchema = z.object({
  destination: z.string().min(2).max(120),
  startDate: z.coerce.date(),
  endDate: z.coerce.date(),
  tripType: z.enum(["solo", "coppia", "gruppo"]),
  style: z.string().min(2).max(120).optional(),
});

export type CreateTripInput = z.infer<typeof createTripSchema>;

export const tripIdParamSchema = z.object({
  tripId: z.string().min(1),
});

