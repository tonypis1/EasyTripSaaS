import { z } from "zod";

/** 0 = mantieni l'attuale, 1..3 = alternative (il massimo reale dipende dalla proposta, verificato dal servizio). */
export const castSlotVoteSchema = z.object({
  optionIndex: z.number().int().min(0).max(3),
});
