import { currentUser } from "@clerk/nextjs/server";
import { cookies, headers } from "next/headers";
import {
  UserRepository,
  normalizeLanguage,
} from "@/server/repositories/UserRepository";
import { AppError } from "@/server/errors/AppError";

export class AuthService {
  constructor(private readonly userRepository: UserRepository) {}

  async getOrCreateCurrentUser() {
    const clerkUser = await currentUser();

    if (!clerkUser || !clerkUser.id) {
      throw new AppError("Non autenticato", 401, "UNAUTHORIZED");
    }

    const primaryEmail = clerkUser.emailAddresses[0]?.emailAddress;
    if (!primaryEmail) {
      throw new AppError("Email utente mancante", 400, "MISSING_EMAIL");
    }

    const language = await currentUiLanguage();

    const user = await this.userRepository.upsertByClerkId({
      clerkUserId: clerkUser.id,
      email: primaryEmail,
      name: `${clerkUser.firstName ?? ""} ${clerkUser.lastName ?? ""}`.trim(),
      language,
    });

    // Allinea il profilo alla lingua in cui l'utente sta usando l'app: le
    // email (inviate anche a utente offline) leggono `User.language`.
    if (language && language !== user.language) {
      return this.userRepository.updateLanguageByClerkId(
        clerkUser.id,
        language,
      );
    }

    return user;
  }
}

/**
 * Lingua dell'interfaccia per la richiesta corrente. Stessa precedenza di
 * `resolveRootHtmlLang` (src/app/layout.tsx):
 * 1. `x-easytrip-locale` — lingua dell'URL `/[locale]/…`, impostata dal
 *    middleware sulle pagine;
 * 2. cookie `NEXT_LOCALE` — per le chiamate `/api`, che non hanno prefisso.
 *
 * Il solo cookie non basta: next-intl lo scrive soltanto quando la lingua
 * dell'URL differisce da quella del browser, quindi un utente che naviga
 * sempre nella lingua del browser non lo riceve mai e la lingua scelta in
 * passato su un altro dispositivo restava nel profilo (email in tedesco a
 * un utente che usa l'app in italiano).
 */
async function currentUiLanguage() {
  const headerStore = await headers();
  const fromUrl = normalizeLanguage(headerStore.get("x-easytrip-locale"));
  if (fromUrl) return fromUrl;
  const cookieStore = await cookies();
  return normalizeLanguage(cookieStore.get("NEXT_LOCALE")?.value);
}
