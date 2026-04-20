import { prisma } from "@/lib/prisma";

type UpsertUserInput = {
  clerkUserId: string;
  email: string;
  name?: string | null;
};

export class UserRepository {
  async upsertByClerkId(input: UpsertUserInput) {
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
}
