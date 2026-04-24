import { randomBytes } from "crypto";
import { prisma } from "@/lib/prisma";
import { CreateTripInput } from "@/server/validators/trip.schema";

type CreateTripDbInput = CreateTripInput & {
  organizerId: string;
};

function generateToken(): string {
  return randomBytes(16).toString("hex");
}

export class TripRepository {
  async create(input: CreateTripDbInput) {
    const accessExpiresAt = new Date(input.endDate);
    accessExpiresAt.setDate(accessExpiresAt.getDate() + 1);

    const isGroup = input.tripType === "gruppo" || input.tripType === "coppia";

    return prisma.trip.create({
      data: {
        organizerId: input.organizerId,
        destination: input.destination,
        startDate: input.startDate,
        endDate: input.endDate,
        accessExpiresAt,
        tripType: input.tripType,
        style: input.style,
        budgetLevel: input.budgetLevel ?? "moderate",
        localPassCityCount: input.localPassCityCount ?? 0,
        status: "pending",
        inviteToken: isGroup ? generateToken() : null,
        members: {
          create: {
            userId: input.organizerId,
            role: "org",
          },
        },
      },
    });
  }

  async listByOrganizer(organizerId: string) {
    return prisma.trip.findMany({
      where: { organizerId, deletedAt: null },
      orderBy: { createdAt: "desc" },
      include: {
        versions: {
          where: { isActive: true },
          include: { days: true },
        },
      },
    });
  }

  /** Home dashboard: ultimi trip con tutte le versioni (carosello). */
  async listRecentForDashboard(organizerId: string, take = 5) {
    return prisma.trip.findMany({
      where: { organizerId, deletedAt: null },
      orderBy: { updatedAt: "desc" },
      take,
      select: {
        id: true,
        destination: true,
        startDate: true,
        endDate: true,
        status: true,
        currentVersion: true,
        versions: {
          orderBy: { versionNum: "asc" },
          select: {
            versionNum: true,
            isActive: true,
            generatedAt: true,
            geoScore: true,
          },
        },
      },
    });
  }

  /** Per webhook Stripe (nessun utente in sessione): solo verifica esistenza / idempotenza */
  async findById(tripId: string) {
    return prisma.trip.findUnique({
      where: { id: tripId },
    });
  }

  async findByIdAndOrganizer(tripId: string, organizerId: string) {
    return prisma.trip.findFirst({
      where: {
        id: tripId,
        organizerId,
        deletedAt: null,
      },
    });
  }

  /** Dettaglio per UI: tutte le versioni (carosello) + giorni della versione attiva */
  async findDetailForOrganizer(tripId: string, organizerId: string) {
    return prisma.trip.findFirst({
      where: { id: tripId, organizerId, deletedAt: null },
      include: {
        versions: {
          orderBy: { versionNum: "asc" },
          include: {
            days: { orderBy: { dayNumber: "asc" } },
          },
        },
        members: {
          include: { user: { select: { id: true, name: true, email: true } } },
          orderBy: { joinedAt: "asc" },
        },
      },
    });
  }

  /** Solo giorni della versione attiva (per replace-slot e query mirate). */
  async findActiveVersionWithDays(tripId: string, organizerId: string) {
    return prisma.trip.findFirst({
      where: { id: tripId, organizerId, deletedAt: null },
      include: {
        versions: {
          where: { isActive: true },
          take: 1,
          include: { days: { orderBy: { dayNumber: "asc" } } },
        },
      },
    });
  }

  /**
   * Imposta la versione attiva (carosello, senza nuova generazione).
   */
  async setActiveVersion(
    tripId: string,
    organizerId: string,
    versionNum: number,
  ) {
    const trip = await prisma.trip.findFirst({
      where: { id: tripId, organizerId, deletedAt: null },
      include: { versions: { select: { id: true, versionNum: true } } },
    });
    if (!trip) return { ok: false as const, reason: "not_found" as const };

    const target = trip.versions.find((v) => v.versionNum === versionNum);
    if (!target)
      return { ok: false as const, reason: "version_not_found" as const };

    await prisma.$transaction([
      prisma.tripVersion.updateMany({
        where: { tripId },
        data: { isActive: false },
      }),
      prisma.tripVersion.update({
        where: { id: target.id },
        data: { isActive: true },
      }),
      prisma.trip.update({
        where: { id: tripId },
        data: { currentVersion: versionNum },
      }),
    ]);

    return { ok: true as const };
  }

  async markAsPaid(
    tripId: string,
    payload: { paymentId: string; amountPaid: number },
  ) {
    return prisma.trip.update({
      where: { id: tripId },
      data: {
        paymentId: payload.paymentId,
        amountPaid: payload.amountPaid,
      },
    });
  }

  async updatePreferences(
    tripId: string,
    organizerId: string,
    data: { style?: string | null; budgetLevel: string },
  ) {
    const result = await prisma.trip.updateMany({
      where: { id: tripId, organizerId, deletedAt: null },
      data: {
        style: data.style,
        budgetLevel: data.budgetLevel,
        prefChangedAfterGen: true,
      },
    });
    return { updated: result.count > 0 };
  }

  /**
   * Estende l'accesso al viaggio di N giorni (riattivazione post-trip).
   * Il nuovo `accessExpiresAt` parte da oggi (se già scaduto) o dalla data attuale di scadenza.
   */
  async extendAccess(tripId: string, extraDays: number) {
    const trip = await prisma.trip.findUnique({
      where: { id: tripId },
      select: { accessExpiresAt: true },
    });
    if (!trip) return null;

    const base =
      trip.accessExpiresAt > new Date() ? trip.accessExpiresAt : new Date();
    const newExpiry = new Date(base);
    newExpiry.setDate(newExpiry.getDate() + extraDays);

    return prisma.trip.update({
      where: { id: tripId },
      data: { accessExpiresAt: newExpiry, status: "active" },
    });
  }

  /**
   * Trova tutti i trip attivi con accesso scaduto, li marca "expired" e
   * ritorna le info necessarie per inviare le email di notifica.
   * Idempotente: trip già "expired" non vengono selezionati.
   */
  async findAndExpireOverdue() {
    const now = new Date();

    const overdue = await prisma.trip.findMany({
      where: {
        status: "active",
        accessExpiresAt: { lt: now },
        deletedAt: null,
      },
      select: {
        id: true,
        destination: true,
        organizer: { select: { email: true } },
      },
    });

    if (overdue.length === 0) return [];

    await prisma.trip.updateMany({
      where: { id: { in: overdue.map((t) => t.id) } },
      data: { status: "expired" },
    });

    return overdue.map((t) => ({
      tripId: t.id,
      destination: t.destination,
      organizerEmail: t.organizer.email,
    }));
  }

  /**
   * Cancella il trip (solo se non ancora iniziato), genera un Credit pari
   * all'importo pagato con scadenza 365 giorni, e incrementa creditBalance.
   * Tutto in un'unica transazione atomica.
   */
  async cancelWithCredit(tripId: string, organizerId: string) {
    const trip = await prisma.trip.findFirst({
      where: { id: tripId, organizerId, deletedAt: null },
    });

    if (!trip) return { ok: false as const, reason: "not_found" as const };

    if (trip.startDate <= new Date()) {
      return { ok: false as const, reason: "already_started" as const };
    }

    if (trip.status === "cancelled") {
      return { ok: false as const, reason: "already_cancelled" as const };
    }

    const paid = trip.amountPaid ? Number(trip.amountPaid) : 0;

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 365);

    await prisma.$transaction(async (tx) => {
      await tx.trip.update({
        where: { id: tripId },
        data: { status: "cancelled", deletedAt: new Date() },
      });

      if (paid > 0) {
        await tx.credit.create({
          data: {
            userId: organizerId,
            amount: paid,
            originTripId: tripId,
            expiresAt,
          },
        });

        await tx.user.update({
          where: { id: organizerId },
          data: { creditBalance: { increment: paid } },
        });
      }
    });

    return {
      ok: true as const,
      creditAmount: paid,
      creditExpiresAt: expiresAt,
      destination: trip.destination,
    };
  }

  /**
   * Nasconde il viaggio all'utente (soft delete). Il record Trip, Payment, TripVersion, Day
   * restano in DB per storico, contabilità e futuri export fiscali.
   */
  async softDeleteByIdForOrganizer(tripId: string, organizerId: string) {
    const result = await prisma.trip.updateMany({
      where: {
        id: tripId,
        organizerId,
        deletedAt: null,
      },
      data: { deletedAt: new Date() },
    });
    if (result.count === 0) return { deleted: false as const };
    return { deleted: true as const };
  }

  async findByInviteToken(token: string) {
    return prisma.trip.findUnique({
      where: { inviteToken: token },
      include: {
        organizer: { select: { name: true, email: true, language: true } },
        members: {
          include: { user: { select: { id: true, name: true, email: true } } },
        },
      },
    });
  }

  async addMember(tripId: string, userId: string) {
    return prisma.tripMember.create({
      data: { tripId, userId, role: "member" },
    });
  }

  async isMember(tripId: string, userId: string) {
    const m = await prisma.tripMember.findUnique({
      where: { tripId_userId: { tripId, userId } },
    });
    return Boolean(m);
  }

  async getMembers(tripId: string) {
    return prisma.tripMember.findMany({
      where: { tripId },
      include: { user: { select: { id: true, name: true, email: true } } },
      orderBy: { joinedAt: "asc" },
    });
  }

  async findDetailForMember(tripId: string, userId: string) {
    const membership = await prisma.tripMember.findUnique({
      where: { tripId_userId: { tripId, userId } },
    });
    if (!membership) return null;

    return prisma.trip.findFirst({
      where: { id: tripId, deletedAt: null },
      include: {
        versions: {
          orderBy: { versionNum: "asc" },
          include: {
            days: { orderBy: { dayNumber: "asc" } },
          },
        },
        members: {
          include: { user: { select: { id: true, name: true, email: true } } },
          orderBy: { joinedAt: "asc" },
        },
      },
    });
  }

  async generateInviteToken(tripId: string, organizerId: string) {
    const token = generateToken();
    const result = await prisma.trip.updateMany({
      where: { id: tripId, organizerId, deletedAt: null },
      data: { inviteToken: token },
    });
    if (result.count === 0) return null;
    return token;
  }
}
