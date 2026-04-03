import { config } from "@/config/unifiedConfig";
import { AuthService } from "@/server/services/auth/authService";
import { TripRepository } from "@/server/repositories/TripRepository";
import { CreateTripInput } from "@/server/validators/trip.schema";
import { AppError } from "@/server/errors/AppError";
import { toDateOnlyIsoUtc } from "@/lib/calendar-date";
import {
  cancelConfirmedHtml,
  sendTransactionalEmail,
} from "@/lib/email/transactional";
import { inngest } from "@/lib/inngest/client";
import { prisma } from "@/lib/prisma";
import {
  canCreateNewVersion,
  isPaidRegeneration,
  nextVersionNum,
} from "@/lib/trip-regen-rules";

export type RestaurantSuggestDto = {
  meal: "pranzo" | "cena";
  name: string;
  cuisine: string;
  why: string;
  budgetHint: string;
  distance: string;
  reservationNeeded: boolean;
  reservationTip: string;
};

export type TripDayDto = {
  id: string;
  dayNumber: number;
  unlockDate: string;
  title: string | null;
  morning: string | null;
  afternoon: string | null;
  evening: string | null;
  restaurants: RestaurantSuggestDto[] | null;
  mapCenterLat: number | null;
  mapCenterLng: number | null;
  zoneFocus: string | null;
  dowWarning: string | null;
  localGem: string | null;
  dayTips: string | null;
};

export type TripVersionSummaryDto = {
  versionNum: number;
  geoScore: number | null;
  generatedAt: string;
  isActive: boolean;
};

export type TripDetailDto = {
  id: string;
  destination: string;
  startDate: string;
  endDate: string;
  accessExpiresAt: string;
  tripType: string;
  style: string | null;
  budgetLevel: string;
  status: string;
  regenCount: number;
  currentVersion: number;
  isPaid: boolean;
  userCreditBalanceCents: number;
  tripPriceCents: number;
  days: TripDayDto[];
  versions: TripVersionSummaryDto[];
  activeGeoScore: number | null;
  prefChangedAfterGen: boolean;
  isAccessExpired: boolean;
  regen: {
    nextVersion: number;
    atMax: boolean;
    canStartGeneration: boolean;
    needsPaidCheckout: boolean;
    freeRegenFromPrefChange: boolean;
  };
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

function parseRestaurants(raw: string | null): RestaurantSuggestDto[] | null {
  if (!raw || raw === "null") return null;
  try {
    const j = JSON.parse(raw) as unknown;
    if (!Array.isArray(j)) return null;
    const out: RestaurantSuggestDto[] = [];
    for (const item of j) {
      if (!item || typeof item !== "object") continue;
      const o = item as Record<string, unknown>;

      // Nuovo formato (A2)
      if (
        (o.meal === "pranzo" || o.meal === "cena") &&
        typeof o.name === "string" &&
        typeof o.cuisine === "string" &&
        typeof o.why === "string" &&
        typeof o.budgetHint === "string" &&
        typeof o.distance === "string" &&
        typeof o.reservationNeeded === "boolean"
      ) {
        out.push({
          meal: o.meal,
          name: o.name,
          cuisine: o.cuisine,
          why: o.why,
          budgetHint: o.budgetHint,
          distance: o.distance,
          reservationNeeded: o.reservationNeeded,
          reservationTip:
            typeof o.reservationTip === "string" ? o.reservationTip : "",
        });
        continue;
      }

      // Vecchio formato (pre-A2): { name, why, budgetHint }
      if (
        typeof o.name === "string" &&
        typeof o.why === "string" &&
        typeof o.budgetHint === "string"
      ) {
        out.push({
          meal: "pranzo",
          name: o.name,
          cuisine: "ristorante",
          why: o.why,
          budgetHint: o.budgetHint,
          distance: "",
          reservationNeeded: false,
          reservationTip: "",
        });
      }
    }

    // Se arrivano record vecchi, assegna pranzo/cena in modo deterministico:
    // - 2 elementi: 1° pranzo, 2° cena
    // - >2 elementi: alterna pranzo/cena per index
    const hasAnyLegacy =
      out.some((r) => r.cuisine === "ristorante" && r.distance === "");
    if (hasAnyLegacy && out.length >= 2) {
      for (let i = 0; i < out.length; i++) {
        out[i] = { ...out[i], meal: i % 2 === 0 ? "pranzo" : "cena" };
      }
    }

    return out.length > 0 ? out : null;
  } catch {
    return null;
  }
}

function decToNumber(v: unknown): number | null {
  if (v == null) return null;
  if (typeof v === "number" && !Number.isNaN(v)) return v;
  if (typeof v === "object" && v !== null && "toNumber" in v) {
    const n = (v as { toNumber: () => number }).toNumber();
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

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
      budgetLevel: trip.budgetLevel,
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

    const versions = trip.versions.map((v) => ({
      versionNum: v.versionNum,
      geoScore: decToNumber(v.geoScore),
      generatedAt: v.generatedAt.toISOString(),
      isActive: v.isActive,
    }));

    const active = trip.versions.find((v) => v.isActive);
    const days = active?.days ?? [];
    const activeGeoScore = active ? decToNumber(active.geoScore) : null;

    const rc = trip.regenCount;
    const nextV = nextVersionNum(rc);
    const atMax = !canCreateNewVersion(rc);
    const needsPaidCheckout = !atMax && isPaidRegeneration(rc);
    const prefChanged = trip.prefChangedAfterGen === true;
    const freeRegenFromPrefChange = prefChanged && needsPaidCheckout && !atMax;
    const canStartGeneration = !atMax && (!needsPaidCheckout || freeRegenFromPrefChange);

    const availableCredits = await prisma.credit.aggregate({
      where: { userId: user.id, used: false, expiresAt: { gt: new Date() } },
      _sum: { amount: true },
    });
    const creditBalanceEuros = Number(availableCredits._sum.amount ?? 0);
    const userCreditBalanceCents = Math.round(creditBalanceEuros * 100);

    return {
      id: trip.id,
      destination: trip.destination,
      startDate: toDateOnlyIsoUtc(trip.startDate),
      endDate: toDateOnlyIsoUtc(trip.endDate),
      accessExpiresAt: toDateOnlyIsoUtc(trip.accessExpiresAt),
      tripType: trip.tripType,
      style: trip.style,
      budgetLevel: trip.budgetLevel,
      status: trip.status,
      regenCount: trip.regenCount,
      currentVersion: trip.currentVersion,
      isPaid: trip.amountPaid != null,
      userCreditBalanceCents,
      tripPriceCents:
        trip.tripType === "gruppo"
          ? config.billing.priceGroupCents
          : config.billing.priceSoloCoupleCents,
      prefChangedAfterGen: prefChanged,
      isAccessExpired: trip.accessExpiresAt < new Date(),
      days: days.map(
        (d: {
          id: string;
          dayNumber: number;
          unlockDate: Date;
          title: string | null;
          morning: string | null;
          afternoon: string | null;
          evening: string | null;
          restaurants: string | null;
          mapCenterLat: unknown;
          mapCenterLng: unknown;
          zoneFocus: string | null;
          dowWarning: string | null;
          localGem: string | null;
          tips: string | null;
        }) => ({
          id: d.id,
          dayNumber: d.dayNumber,
          unlockDate: toDateOnlyIsoUtc(d.unlockDate),
          title: d.title,
          morning: d.morning,
          afternoon: d.afternoon,
          evening: d.evening,
          restaurants: parseRestaurants(d.restaurants),
          mapCenterLat: decToNumber(d.mapCenterLat),
          mapCenterLng: decToNumber(d.mapCenterLng),
          zoneFocus: d.zoneFocus,
          dowWarning: d.dowWarning,
          localGem: d.localGem,
          dayTips: d.tips,
        })
      ),
      versions,
      activeGeoScore,
      regen: {
        nextVersion: nextV,
        atMax,
        canStartGeneration,
        needsPaidCheckout,
        freeRegenFromPrefChange,
      },
    };
  }

  /**
   * Avvia una nuova generazione Inngest (prima volta o rigenerazione gratuita).
   * Per le versioni a pagamento usare il checkout rigenerazione.
   */
  async requestItineraryGeneration(tripId: string): Promise<{ ok: true }> {
    const user = await this.authService.getOrCreateCurrentUser();
    const trip = await this.tripRepository.findByIdAndOrganizer(
      tripId,
      user.id
    );
    if (!trip) {
      throw new AppError("Trip non trovato", 404, "TRIP_NOT_FOUND");
    }
    if (trip.amountPaid == null) {
      if (config.app.env !== "development") {
        throw new AppError(
          "Pagamento richiesto prima della generazione",
          402,
          "PAYMENT_REQUIRED"
        );
      }
    }

    const rc = trip.regenCount;
    if (!canCreateNewVersion(rc)) {
      throw new AppError(
        "Hai raggiunto il massimo di 7 versioni. Usa il carosello per tornare a una versione salvata.",
        400,
        "REGEN_MAX_VERSIONS"
      );
    }

    if (isPaidRegeneration(rc)) {
      throw new AppError(
        "Per questa rigenerazione è richiesto il pagamento (€1,99). Usa il pulsante dedicato.",
        402,
        "REGEN_PAYMENT_REQUIRED"
      );
    }

    await inngest.send({
      name: "trip/generate.requested",
      data: { tripId, userId: user.id },
    });

    return { ok: true };
  }

  async setActiveTripVersion(
    tripId: string,
    versionNum: number
  ): Promise<{ ok: true }> {
    const user = await this.authService.getOrCreateCurrentUser();
    const result = await this.tripRepository.setActiveVersion(
      tripId,
      user.id,
      versionNum
    );
    if (!result.ok) {
      if (result.reason === "not_found") {
        throw new AppError("Trip non trovato", 404, "TRIP_NOT_FOUND");
      }
      throw new AppError("Versione non trovata", 404, "VERSION_NOT_FOUND");
    }
    return { ok: true };
  }

  async updatePreferences(
    tripId: string,
    data: { style?: string | null; budgetLevel: string },
  ): Promise<{ ok: true }> {
    const user = await this.authService.getOrCreateCurrentUser();
    const result = await this.tripRepository.updatePreferences(
      tripId,
      user.id,
      data,
    );
    if (!result.updated) {
      throw new AppError("Trip non trovato", 404, "TRIP_NOT_FOUND");
    }
    return { ok: true };
  }

  async deleteMyTrip(tripId: string): Promise<{ deleted: boolean }> {
    const user = await this.authService.getOrCreateCurrentUser();
    const result = await this.tripRepository.softDeleteByIdForOrganizer(
      tripId,
      user.id
    );
    if (!result.deleted) {
      throw new AppError("Trip non trovato", 404, "TRIP_NOT_FOUND");
    }
    return { deleted: true };
  }

  async cancelTripWithCredit(
    tripId: string,
  ): Promise<{
    cancelled: true;
    creditAmount: number;
    creditExpiresAt: string;
  }> {
    const user = await this.authService.getOrCreateCurrentUser();
    const result = await this.tripRepository.cancelWithCredit(
      tripId,
      user.id,
    );

    if (!result.ok) {
      if (result.reason === "not_found") {
        throw new AppError("Trip non trovato", 404, "TRIP_NOT_FOUND");
      }
      if (result.reason === "already_started") {
        throw new AppError(
          "Non puoi cancellare un viaggio già iniziato. La cancellazione è possibile solo prima della data di partenza.",
          400,
          "TRIP_ALREADY_STARTED",
        );
      }
      throw new AppError(
        "Questo viaggio è già stato cancellato.",
        400,
        "TRIP_ALREADY_CANCELLED",
      );
    }

    if (result.creditAmount > 0) {
      try {
        await sendTransactionalEmail({
          to: user.email,
          subject: `Viaggio annullato — €${result.creditAmount.toFixed(2)} di credito per te`,
          html: cancelConfirmedHtml({
            destination: result.destination,
            creditAmount: result.creditAmount,
            creditExpiresAt: toDateOnlyIsoUtc(result.creditExpiresAt),
            tripsUrl: `${config.app.baseUrl}/app/trips?new=1`,
          }),
        });
      } catch {
        // email failure non blocca la cancellazione
      }
    }

    return {
      cancelled: true,
      creditAmount: result.creditAmount,
      creditExpiresAt: toDateOnlyIsoUtc(result.creditExpiresAt),
    };
  }
}
