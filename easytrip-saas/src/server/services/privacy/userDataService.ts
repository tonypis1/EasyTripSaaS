import { prisma } from "@/lib/prisma";
import { clerkClient } from "@clerk/nextjs/server";
import { stripe } from "@/lib/billing/stripe";
import { logger } from "@/lib/observability";
import { AppError } from "@/server/errors/AppError";

function serializeDecimal(v: unknown): string | number | null {
  if (v == null) return null;
  if (typeof v === "object" && v !== null && "toString" in v) {
    return (v as { toString: () => string }).toString();
  }
  if (typeof v === "number") return v;
  return String(v);
}

export class UserDataService {
  /**
   * Export completo dati utente (diritto alla portabilità — formato JSON strutturato).
   */
  async exportAllDataForUserId(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        tripsAsOrganizer: {
          include: {
            versions: { include: { days: true } },
            members: { include: { user: true } },
            expenses: true,
            payments: true,
          },
        },
        tripMembers: {
          include: {
            trip: {
              select: {
                id: true,
                destination: true,
                status: true,
                startDate: true,
                endDate: true,
                accessExpiresAt: true,
                tripType: true,
                organizerId: true,
              },
            },
          },
        },
        credits: true,
        payments: true,
        supportTickets: { include: { messages: true } },
        referralsSent: true,
        referralsReceived: true,
      },
    });

    if (!user) {
      throw new AppError("Utente non trovato", 404, "USER_NOT_FOUND");
    }

    return {
      exportVersion: 1 as const,
      exportedAt: new Date().toISOString(),
      user: {
        id: user.id,
        clerkUserId: user.clerkUserId,
        email: user.email,
        name: user.name,
        creditBalance: serializeDecimal(user.creditBalance),
        referralCode: user.referralCode,
        referredBy: user.referredBy,
        planType: user.planType,
        subExpiresAt: user.subExpiresAt?.toISOString() ?? null,
        stripeCustomerId: user.stripeCustomerId,
        totalTrips: user.totalTrips,
        marketingOptIn: user.marketingOptIn,
        marketingOptInAt: user.marketingOptInAt?.toISOString() ?? null,
        welcomeEmailSentAt: user.welcomeEmailSentAt?.toISOString() ?? null,
        nurtureNoTrip3SentAt: user.nurtureNoTrip3SentAt?.toISOString() ?? null,
        nurtureNoTrip7SentAt: user.nurtureNoTrip7SentAt?.toISOString() ?? null,
        createdAt: user.createdAt.toISOString(),
        updatedAt: user.updatedAt.toISOString(),
      },
      tripsAsOrganizer: user.tripsAsOrganizer.map((t) => ({
        ...t,
        startDate: t.startDate.toISOString(),
        endDate: t.endDate.toISOString(),
        accessExpiresAt: t.accessExpiresAt.toISOString(),
        amountPaid:
          t.amountPaid != null ? serializeDecimal(t.amountPaid) : null,
        deletedAt: t.deletedAt?.toISOString() ?? null,
        createdAt: t.createdAt.toISOString(),
        updatedAt: t.updatedAt.toISOString(),
        versions: t.versions.map((v) => ({
          ...v,
          geoScore: v.geoScore != null ? serializeDecimal(v.geoScore) : null,
          generatedAt: v.generatedAt.toISOString(),
          days: v.days.map((d) => ({
            ...d,
            unlockDate: d.unlockDate.toISOString(),
            mapCenterLat:
              d.mapCenterLat != null ? serializeDecimal(d.mapCenterLat) : null,
            mapCenterLng:
              d.mapCenterLng != null ? serializeDecimal(d.mapCenterLng) : null,
          })),
        })),
        members: t.members.map((m) => ({
          ...m,
          balance: serializeDecimal(m.balance),
          totalPaid: serializeDecimal(m.totalPaid),
          joinedAt: m.joinedAt.toISOString(),
          user: { id: m.user.id, email: m.user.email, name: m.user.name },
        })),
        expenses: t.expenses.map((e) => ({
          ...e,
          amount: serializeDecimal(e.amount),
          createdAt: e.createdAt.toISOString(),
        })),
        payments: t.payments.map((p) => ({
          ...p,
          amount: serializeDecimal(p.amount),
          createdAt: p.createdAt.toISOString(),
        })),
      })),
      memberships: user.tripMembers.map((m) => ({
        role: m.role,
        balance: serializeDecimal(m.balance),
        totalPaid: serializeDecimal(m.totalPaid),
        joinedAt: m.joinedAt.toISOString(),
        tripId: m.tripId,
        trip: {
          ...m.trip,
          startDate: m.trip.startDate.toISOString(),
          endDate: m.trip.endDate.toISOString(),
          accessExpiresAt: m.trip.accessExpiresAt.toISOString(),
        },
      })),
      credits: user.credits.map((c) => ({
        ...c,
        amount: serializeDecimal(c.amount),
        expiresAt: c.expiresAt.toISOString(),
        createdAt: c.createdAt.toISOString(),
      })),
      payments: user.payments.map((p) => ({
        ...p,
        amount: serializeDecimal(p.amount),
        createdAt: p.createdAt.toISOString(),
      })),
      supportTickets: user.supportTickets.map((t) => ({
        ...t,
        createdAt: t.createdAt.toISOString(),
        updatedAt: t.updatedAt.toISOString(),
        resolvedAt: t.resolvedAt?.toISOString() ?? null,
        messages: t.messages.map((m) => ({
          ...m,
          createdAt: m.createdAt.toISOString(),
        })),
      })),
      referralsSent: user.referralsSent,
      referralsReceived: user.referralsReceived,
    };
  }

  /**
   * Diritto all'oblio: Stripe → DB (cascade) → Clerk.
   */
  async deleteAccountForUser(input: {
    prismaUserId: string;
    clerkUserId: string;
    stripeCustomerId: string | null;
  }) {
    if (input.stripeCustomerId) {
      try {
        await stripe.customers.del(input.stripeCustomerId);
      } catch (e) {
        logger.error("Stripe customer delete failed (continuing with DB)", e);
      }
    }

    await prisma.user.delete({
      where: { id: input.prismaUserId },
    });

    const clerk = await clerkClient();
    await clerk.users.deleteUser(input.clerkUserId);
  }
}
