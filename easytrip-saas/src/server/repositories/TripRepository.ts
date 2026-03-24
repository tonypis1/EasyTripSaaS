import { prisma } from "@/lib/prisma";
import { CreateTripInput } from "@/server/validators/trip.schema";

type CreateTripDbInput = CreateTripInput & {
  organizerId: string;
};

export class TripRepository {
  async create(input: CreateTripDbInput) {
    const accessExpiresAt = new Date(input.endDate);
    accessExpiresAt.setDate(accessExpiresAt.getDate() + 1);

    return prisma.trip.create({
      data: {
        organizerId: input.organizerId,
        destination: input.destination,
        startDate: input.startDate,
        endDate: input.endDate,
        accessExpiresAt,
        tripType: input.tripType,
        style: input.style,
        status: "pending",
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

  /** Dettaglio per UI: versione attiva + giorni ordinati */
  async findDetailForOrganizer(tripId: string, organizerId: string) {
    return prisma.trip.findFirst({
      where: { id: tripId, organizerId, deletedAt: null },
      include: {
        versions: {
          where: { isActive: true },
          take: 1,
          include: {
            days: { orderBy: { dayNumber: "asc" } },
          },
        },
      },
    });
  }

  async markAsPaid(
    tripId: string,
    payload: { paymentId: string; amountPaid: number }
  ) {
    return prisma.trip.update({
      where: { id: tripId },
      data: {
        paymentId: payload.paymentId,
        amountPaid: payload.amountPaid,
      },
    });
  }

  /**
   * Nasconde il viaggio all’utente (soft delete). Il record Trip, Payment, TripVersion, Day
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
}

