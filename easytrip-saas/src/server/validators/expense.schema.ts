import { z } from "zod";

export const EXPENSE_CATEGORIES = [
  "cibo",
  "trasporti",
  "attivita",
  "alloggio",
  "altro",
] as const;

export const createExpenseSchema = z.object({
  description: z.string().min(1, "Descrizione obbligatoria").max(200),
  amount: z.number().positive("L'importo deve essere positivo"),
  category: z.enum(EXPENSE_CATEGORIES).default("altro"),
  splitEqually: z.boolean().default(true),
  dayNumber: z.number().int().positive().optional().nullable(),
});

export type CreateExpenseInput = z.infer<typeof createExpenseSchema>;
