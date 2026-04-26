import { prisma } from "@/lib/prisma";
import { routing, type AppLocale } from "@/i18n/routing";

type UpsertUserInput = {
  clerkUserId: string;
  email: string;
  name?: string | null;
  language?: AppLocale | null;
};

/**
 * Normalizza un eventuale valore di lingua (es. da Accept-Language o cookie)
 * verso uno dei locali supportati; ritorna null se non mappabile.
 */
export function normalizeLanguage(input: string | null | undefined): AppLocale | null {
  if (!input) return null;
  const short = input.toLowerCase().split(/[-_]/)[0];
  return (routing.locales as readonly string[]).includes(short)
    ? (short as AppLocale)
    : null;
}

export class UserRepository {
  /**
   * Nota: `language` viene applicata SOLO in fase di create. Su update esistente
   * la preferenza è governata da `updateLanguageByClerkId` (tramite switcher o
   * webhook dedicato) per non sovrascrivere la scelta dell'utente ad ogni
   * chiamata di `getOrCreateCurrentUser` in sessioni multi-browser.
   */
  async upsertByClerkId(input: UpsertUserInput) {
    const language = input.language ?? undefined;
    return prisma.user.upsert({
      where: { clerkUserId: input.clerkUserId },
      update: {
        email: input.email,
        name: input.name ?? undefined,
      },
      create: {
        clerkUserId: input.clerkUserId,
        email: input.email,
        name: input.name ?? undefined,
        ...(language ? { language } : {}),
      },
    });
  }

  async findByClerkId(clerkUserId: string) {
    return prisma.user.findUnique({
      where: { clerkUserId },
    });
  }

  async updateMarketingOptIn(userId: string, marketingOptIn: boolean) {
    return prisma.user.update({
      where: { id: userId },
      data: {
        marketingOptIn,
        marketingOptInAt: marketingOptIn ? new Date() : null,
      },
    });
  }

  /**
   * Aggiorna la lingua preferita dell'utente. Accetta esclusivamente i locali
   * supportati (vedi `src/i18n/routing.ts`). Usata dal LocaleSwitcher e dal
   * webhook Clerk per mantenere aggiornata la preferenza lato DB.
   */
  async updateLanguageByClerkId(clerkUserId: string, language: AppLocale) {
    return prisma.user.update({
      where: { clerkUserId },
      data: { language },
    });
  }
}
