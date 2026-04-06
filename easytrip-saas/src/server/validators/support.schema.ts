import { z } from "zod";

export const createTicketSchema = z.object({
  tripId: z.string().min(1).optional(),
  subject: z.string().min(3).max(200),
  message: z.string().min(5).max(2000),
  channel: z.enum(["chat", "email", "in_app"]).default("in_app"),
});

export type CreateTicketInput = z.infer<typeof createTicketSchema>;

export const addMessageSchema = z.object({
  body: z.string().min(1).max(2000),
});

export type AddMessageInput = z.infer<typeof addMessageSchema>;
