import { currentUser } from "@clerk/nextjs/server";
import { UserRepository } from "@/server/repositories/UserRepository";
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

    return this.userRepository.upsertByClerkId({
      clerkUserId: clerkUser.id,
      email: primaryEmail,
      name: `${clerkUser.firstName ?? ""} ${clerkUser.lastName ?? ""}`.trim(),
    });
  }
}
