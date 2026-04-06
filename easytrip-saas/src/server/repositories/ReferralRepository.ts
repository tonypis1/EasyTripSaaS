import { randomBytes } from "crypto";
import { prisma } from "@/lib/prisma";

function generateReferralCode(): string {
  return `ref_${randomBytes(4).toString("hex")}`;
}

export class ReferralRepository {
  async ensureReferralCode(userId: string): Promise<string> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { referralCode: true },
    });
    if (user?.referralCode) return user.referralCode;

    const code = generateReferralCode();
    const updated = await prisma.user.update({
      where: { id: userId },
      data: { referralCode: code },
    });
    return updated.referralCode!;
  }

  async findUserByReferralCode(code: string) {
    return prisma.user.findFirst({
      where: { referralCode: code },
      select: { id: true, email: true, name: true, referralCode: true },
    });
  }

  async createReferral(referrerId: string, referredEmail: string) {
    return prisma.referral.upsert({
      where: {
        referrerId_referredEmail: { referrerId, referredEmail },
      },
      update: {},
      create: {
        referrerId,
        referredEmail: referredEmail.toLowerCase().trim(),
        status: "pending",
      },
    });
  }

  async markSignedUp(referredEmail: string, referredUserId: string) {
    const referral = await prisma.referral.findFirst({
      where: {
        referredEmail: referredEmail.toLowerCase().trim(),
        status: "pending",
      },
    });
    if (!referral) return null;

    return prisma.referral.update({
      where: { id: referral.id },
      data: {
        referredUserId,
        status: "signed_up",
      },
    });
  }

  async markConverted(referredUserId: string) {
    const referral = await prisma.referral.findFirst({
      where: {
        referredUserId,
        status: "signed_up",
        rewardGranted: false,
      },
    });
    if (!referral) return null;
    return referral;
  }

  async grantReward(
    referralId: string,
    referrerId: string,
    rewardAmount: number,
  ) {
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 365);

    return prisma.$transaction(async (tx) => {
      const credit = await tx.credit.create({
        data: {
          userId: referrerId,
          amount: rewardAmount,
          expiresAt,
        },
      });

      await tx.referral.update({
        where: { id: referralId },
        data: {
          status: "converted",
          rewardGranted: true,
          rewardCreditId: credit.id,
          convertedAt: new Date(),
        },
      });

      await tx.user.update({
        where: { id: referrerId },
        data: { creditBalance: { increment: rewardAmount } },
      });

      return credit;
    });
  }

  async getStatsForUser(userId: string) {
    const [total, signedUp, converted, totalRewardAmount] = await Promise.all([
      prisma.referral.count({ where: { referrerId: userId } }),
      prisma.referral.count({
        where: { referrerId: userId, status: { in: ["signed_up", "converted"] } },
      }),
      prisma.referral.count({
        where: { referrerId: userId, status: "converted" },
      }),
      prisma.referral.findMany({
        where: { referrerId: userId, rewardGranted: true },
        select: { rewardCredit: { select: { amount: true } } },
      }),
    ]);

    const earnedCents = totalRewardAmount.reduce((sum, r) => {
      const amt = r.rewardCredit ? Number(r.rewardCredit.amount) : 0;
      return sum + Math.round(amt * 100);
    }, 0);

    return { total, signedUp, converted, earnedCents };
  }

  async listForUser(userId: string) {
    return prisma.referral.findMany({
      where: { referrerId: userId },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        referredEmail: true,
        status: true,
        rewardGranted: true,
        createdAt: true,
        convertedAt: true,
        referredUser: { select: { name: true } },
      },
    });
  }

  async setReferredBy(userId: string, referralCode: string) {
    await prisma.user.update({
      where: { id: userId },
      data: { referredBy: referralCode },
    });
  }
}
