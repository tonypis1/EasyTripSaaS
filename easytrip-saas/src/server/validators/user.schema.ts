import { z } from "zod";

export const deleteAccountSchema = z.object({
  confirm: z.string().min(1),
});

export type DeleteAccountInput = z.infer<typeof deleteAccountSchema>;
