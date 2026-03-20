import { AuthService } from "@/server/services/auth/authService";
import { TripRepository } from "@/server/repositories/TripRepository";
import { CreateTripInput } from "@/server/validators/trip.schema";
import { AppError } from "@/server/errors/AppError";

function toDateOnlyIso(d: Date) {
  return d.toISOString().slice(0, 10);
}

export type TripDayDto = {
  id: string;
  dayNumber: number;
  unlockDate: string;
  title: string | null;
  morning: string | null;
  afternoon: string | null;
  evening: string | null;
};

export type TripDetailDto = {
  id: string;
  destination: string;
  startDate: string;
  endDate: string;
  accessExpiresAt: string;
  tripType: string;
  style: string | null;
  status: string;
  regenCount: number;
  currentVersion: number;
  isPaid: boolean;
  days: TripDayDto[];
};

export type TripListItemDto = {
  id: string;
  destination: string;
  tripType: string;
  status: string;
  startDate: Date;
  endDate: Date;
  accessExpiresAt: Date;
  regenCount: number;
  currentVersion: number;
  activeDays: number;
  isPaid: boolean;
};

/** Riga Prisma da listByOrganizer (include versioni attive + giorni) */
type TripListItemDb = {
  id: string;
  destination: string;
  tripType: string;
  status: string;
  startDate: Date;
  endDate: Date;
  accessExpiresAt: Date;
  regenCount: number;
  currentVersion: number;
  amountPaid: unknown;
  versions: { days: { id: string }[] }[];
};

export class TripService {
  constructor(
    private readonly authService: AuthService,
    private readonly tripRepository: TripRepository
  ) {}

  async createTrip(input: CreateTripInput) {
    if (input.endDate < input.startDate) {
      throw new AppError(
        "La data di fine deve essere successiva alla data di inizio",
        400,
        "INVALID_DATE_RANGE"
      );
    }

    const user = await this.authService.getOrCreateCurrentUser();
    const trip = await this.tripRepository.create({
      ...input,
      organizerId: user.id,
    });

    return {
      id: trip.id,
      status: trip.status,
      destination: trip.destination,
      tripType: trip.tripType,
      startDate: trip.startDate,
      endDate: trip.endDate,
      accessExpiresAt: trip.accessExpiresAt,
    };
  }

  async listMyTrips(): Promise<TripListItemDto[]> {
    const user = await this.authService.getOrCreateCurrentUser();
    const trips = await this.tripRepository.listByOrganizer(user.id);
    return trips.map((trip: TripListItemDb) => ({
      id: trip.id,
      destination: trip.destination,
      tripType: trip.tripType,
      status: trip.status,
      startDate: trip.startDate,
      endDate: trip.endDate,
      accessExpiresAt: trip.accessExpiresAt,
      regenCount: trip.regenCount,
      currentVersion: trip.currentVersion,
      activeDays: trip.versions[0]?.days.length ?? 0,
      isPaid: trip.amountPaid != null,
    }));
  }

  async getTripDetail(tripId: string): Promise<TripDetailDto> {
    const user = await this.authService.getOrCreateCurrentUser();
    const trip = await this.tripRepository.findDetailForOrganizer(
      tripId,
      user.id
    );

    if (!trip) {
      throw new AppError("Trip non trovato", 404, "TRIP_NOT_FOUND");
    }

    const active = trip.versions[0];
    const days = active?.days ?? [];

    return {
      id: trip.id,
      destination: trip.destination,
      startDate: toDateOnlyIso(trip.startDate),
      endDate: toDateOnlyIso(trip.endDate),
      accessExpiresAt: toDateOnlyIso(trip.accessExpiresAt),
      tripType: trip.tripType,
      style: trip.style,
      status: trip.status,
      regenCount: trip.regenCount,
      currentVersion: trip.currentVersion,
      isPaid: trip.amountPaid != null,
      days: days.map(
        (d: {
          id: string;
          dayNumber: number;
          unlockDate: Date;
          title: string | null;
          morning: string | null;
          afternoon: string | null;
          evening: string | null;
        }) => ({
          id: d.id,
          dayNumber: d.dayNumber,
          unlockDate: toDateOnlyIso(d.unlockDate),
          title: d.title,
          morning: d.morning,
          afternoon: d.afternoon,
          evening: d.evening,
        })
      ),
    };
  }
}

