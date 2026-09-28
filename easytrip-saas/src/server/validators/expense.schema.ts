import { z } from "zod";

export const EXPENSE_CATEGORIES = [
  "cibo",
  "trasporti",
  "attivita",
  "alloggio",
  "altro",
] as const;

/** Quota di un membro: peso relativo (1 = quota intera), max 2 decimali. */
export const expenseParticipantSchema = z.object({
  memberId: z.string().min(1),
  weight: z
    .number()
    .min(0.01, "Il peso deve essere almeno 0,01")
    .max(100, "Il peso non può superare 100")
    .transform((w) => Math.round(w * 100) / 100)
    .default(1),
});

export const createExpenseSchema = z
  .object({
    description: z.string().min(1, "Descrizione obbligatoria").max(200),
    amount: z.number().positive("L'importo deve essere positivo"),
    category: z.enum(EXPENSE_CATEGORIES).default("altro"),
    /** false = spesa personale, esclusa dai saldi di gruppo. */
    splitEqually: z.boolean().default(true),
    dayNumber: z.number().int().positive().optional().nullable(),
    /**
     * Membri che condividono la spesa e le loro quote. Omesso = divisa in parti
     * uguali tra TUTTI i membri del viaggio.
     */
    participants: z.array(expenseParticipantSchema).min(1).max(50).optional(),
  })
  .superRefine((value, ctx) => {
    if (!value.participants) return;

    if (!value.splitEqually) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["participants"],
        message: "Una spesa personale non può avere partecipanti",
      });
    }

    const ids = value.participants.map((p) => p.memberId);
    if (new Set(ids).size !== ids.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["participants"],
        message: "Ogni partecipante può comparire una sola volta",
      });
    }
  });

export type CreateExpenseInput = z.infer<typeof createExpenseSchema>;
