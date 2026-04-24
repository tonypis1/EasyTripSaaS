import { currentUser } from "@clerk/nextjs/server";
import { cookies } from "next/headers";
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

    // Leggi la lingua corrente dal cookie NEXT_LOCALE scritto da next-intl.
    // Viene applicata SOLO alla prima creazione dell'utente (vedi UserRepository).
    const cookieStore = await cookies();
    const localeCookie = cookieStore.get("NEXT_LOCALE")?.value;
    const language = normalizeLanguage(localeCookie);

    return this.userRepository.upsertByClerkId({
      clerkUserId: clerkUser.id,
      email: primaryEmail,
      name: `${clerkUser.firstName ?? ""} ${clerkUser.lastName ?? ""}`.trim(),
      language,
    });
  }
}
