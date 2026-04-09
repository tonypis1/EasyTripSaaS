import { AuthService } from "@/server/services/auth/authService";
import { ReferralRepository } from "@/server/repositories/ReferralRepository";
import { config } from "@/config/unifiedConfig";
import { sendTransactionalEmail } from "@/lib/email/transactional";
import {
  referralSignupHtml,
  referralRewardHtml,
} from "@/lib/email/transactional";

const REWARD_EUROS = 9.99;

export type ReferralDto = {
  id: string;
  referredEmail: string;
  referredName: string | null;
  status: string;
  rewardGranted: boolean;
  createdAt: string;
  convertedAt: string | null;
};

export type ReferralStatsDto = {
  referralCode: string;
  referralUrl: string;
  total: number;
  signedUp: number;
  converted: number;
  earnedCents: number;
  referrals: ReferralDto[];
};

export class ReferralService {
  constructor(
    private readonly authService: AuthService,
    private readonly referralRepo: ReferralRepository,
  ) {}

  async getMyReferralData(): Promise<ReferralStatsDto> {
    const user = await this.authService.getOrCreateCurrentUser();
    const code = await this.referralRepo.ensureReferralCode(user.id);
    const stats = await this.referralRepo.getStatsForUser(user.id);
    const list = await this.referralRepo.listForUser(user.id);

    return {
      referralCode: code,
      referralUrl: `${config.app.baseUrl}/?ref=${code}`,
      ...stats,
      referrals: list.map((r) => ({
        id: r.id,
        referredEmail: r.referredEmail,
        referredName: r.referredUser?.name ?? null,
        status: r.status,
        rewardGranted: r.rewardGranted,
        createdAt: r.createdAt.toISOString(),
        convertedAt: r.convertedAt?.toISOString() ?? null,
      })),
    };
  }

  /**
   * Chiamato quando un nuovo utente si registra con un referral code.
   * Crea il record Referral (o aggiorna da pending a signed_up).
   */
  async trackSignup(referralCode: string, newUserId: string, newUserEmail: string) {
    const referrer = await this.referralRepo.findUserByReferralCode(referralCode);
    if (!referrer) return;

    if (referrer.id === newUserId) return;

    await this.referralRepo.setReferredBy(newUserId, referralCode);

    const existing = await this.referralRepo.markSignedUp(
      newUserEmail,
      newUserId,
    );

    if (!existing) {
      const ref = await this.referralRepo.createReferral(
        referrer.id,
        newUserEmail,
      );
      await this.referralRepo.markSignedUp(newUserEmail, newUserId);
      if (!ref) return;
    }

    try {
      await sendTransactionalEmail({
        to: referrer.email,
        subject: "🎉 Il tuo amico si è registrato su EasyTrip!",
        html: referralSignupHtml({
          referrerName: referrer.name ?? "Viaggiatore",
          referredEmail: newUserEmail,
          dashboardUrl: `${config.app.baseUrl}/app/referral`,
        }),
      });
    } catch {
      // email failure non blocca il flusso
    }
  }

  /**
   * Chiamato dal webhook Stripe quando l'invitato completa il primo pagamento.
   * Crea un Credit di €9,99 per il referrer = 1 trip gratis.
   */
  async tryGrantReward(paidUserId: string) {
    const referral = await this.referralRepo.markConverted(paidUserId);
    if (!referral) return;

    const credit = await this.referralRepo.grantReward(
      referral.id,
      referral.referrerId,
      REWARD_EUROS,
    );

    try {
      const { prisma } = await import("@/lib/prisma");
      const referrerUser = await prisma.user.findUnique({
        where: { id: referral.referrerId },
        select: { email: true, name: true },
      });

      if (referrerUser) {
        await sendTransactionalEmail({
          to: referrerUser.email,
          subject: "🎁 Hai guadagnato 1 trip gratis!",
          html: referralRewardHtml({
            referrerName: referrerUser.name ?? "Viaggiatore",
            rewardAmount: REWARD_EUROS,
            creditExpiresAt: credit.expiresAt.toISOString().split("T")[0],
            tripsUrl: `${config.app.baseUrl}/app/trips?new=1`,
          }),
        });
      }
    } catch {
      // email failure non blocca il reward
    }
  }
}
