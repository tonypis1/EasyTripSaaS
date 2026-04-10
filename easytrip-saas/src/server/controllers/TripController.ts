import { BaseController } from "@/server/controllers/BaseController";
import { TripService } from "@/server/services/trip/tripService";
import { SlotReplaceService } from "@/server/services/trip/slotReplaceService";
import { LiveSuggestService } from "@/server/services/trip/liveSuggestService";
import { AuthService } from "@/server/services/auth/authService";
import {
  createTripSchema,
  replaceSlotSchema,
  setActiveVersionSchema,
  updatePreferencesSchema,
  liveSuggestSchema,
} from "@/server/validators/trip.schema";
import { AppError } from "@/server/errors/AppError";

export class TripController extends BaseController {
  constructor(
    private readonly tripService: TripService,
    private readonly authService: AuthService,
    private readonly slotReplaceService: SlotReplaceService,
    private readonly liveSuggestService: LiveSuggestService,
  ) {
    super();
  }

  async create(req: Request) {
    try {
      const body = await req.json();
      const input = createTripSchema.parse(body);
      const trip = await this.tripService.createTrip(input);
      return this.ok(trip, 201);
    } catch (error) {
      if (error instanceof SyntaxError) {
        return this.fail(
          new AppError("Body JSON non valido", 400, "INVALID_JSON"),
          "TripController.create",
        );
      }
      return this.fail(error, "TripController.create");
    }
  }

  async list() {
    try {
      const trips = await this.tripService.listMyTrips();
      return this.ok(trips);
    } catch (error) {
      return this.fail(error, "TripController.list");
    }
  }

  async getById(tripId: string) {
    try {
      const trip = await this.tripService.getTripDetail(tripId);
      return this.ok(trip);
    } catch (error) {
      return this.fail(error, "TripController.getById");
    }
  }

  async deleteById(tripId: string) {
    try {
      const result = await this.tripService.cancelTripWithCredit(tripId);
      return this.ok({
        ok: true,
        cancelled: true,
        creditAmount: result.creditAmount,
        creditExpiresAt: result.creditExpiresAt,
      });
    } catch (error) {
      return this.fail(error, "TripController.deleteById");
    }
  }

  async archiveById(tripId: string) {
    try {
      await this.tripService.deleteMyTrip(tripId);
      return this.ok({ archived: true });
    } catch (error) {
      return this.fail(error, "TripController.archiveById");
    }
  }

  async requestGeneration(tripId: string) {
    try {
      const result = await this.tripService.requestItineraryGeneration(tripId);
      return this.ok(result, 202);
    } catch (error) {
      return this.fail(error, "TripController.requestGeneration");
    }
  }

  async setActiveVersion(tripId: string, req: Request) {
    try {
      const body = await req.json();
      const { versionNum } = setActiveVersionSchema.parse(body);
      const result = await this.tripService.setActiveTripVersion(
        tripId,
        versionNum,
      );
      return this.ok(result);
    } catch (error) {
      if (error instanceof SyntaxError) {
        return this.fail(
          new AppError("Body JSON non valido", 400, "INVALID_JSON"),
          "TripController.setActiveVersion",
        );
      }
      return this.fail(error, "TripController.setActiveVersion");
    }
  }

  async replaceSlot(tripId: string, req: Request) {
    try {
      const body = await req.json();
      const parsed = replaceSlotSchema.parse(body);
      const user = await this.authService.getOrCreateCurrentUser();
      const result = await this.slotReplaceService.replaceSlot({
        organizerId: user.id,
        tripId,
        dayId: parsed.dayId,
        slot: parsed.slot,
        lat: parsed.lat ?? null,
        lng: parsed.lng ?? null,
      });
      return this.ok(result);
    } catch (error) {
      if (error instanceof SyntaxError) {
        return this.fail(
          new AppError("Body JSON non valido", 400, "INVALID_JSON"),
          "TripController.replaceSlot",
        );
      }
      return this.fail(error, "TripController.replaceSlot");
    }
  }

  async liveSuggest(tripId: string, req: Request) {
    try {
      const body = await req.json();
      const parsed = liveSuggestSchema.parse(body);
      const user = await this.authService.getOrCreateCurrentUser();
      const result = await this.liveSuggestService.suggest({
        organizerId: user.id,
        tripId,
        dayId: parsed.dayId,
        lat: parsed.lat,
        lng: parsed.lng,
        reason: parsed.reason,
        currentSlot: parsed.currentSlot ?? null,
      });
      return this.ok(result);
    } catch (error) {
      if (error instanceof SyntaxError) {
        return this.fail(
          new AppError("Body JSON non valido", 400, "INVALID_JSON"),
          "TripController.liveSuggest",
        );
      }
      return this.fail(error, "TripController.liveSuggest");
    }
  }

  async updatePreferences(tripId: string, req: Request) {
    try {
      const body = await req.json();
      const parsed = updatePreferencesSchema.parse(body);
      const result = await this.tripService.updatePreferences(tripId, parsed);
      return this.ok(result);
    } catch (error) {
      if (error instanceof SyntaxError) {
        return this.fail(
          new AppError("Body JSON non valido", 400, "INVALID_JSON"),
          "TripController.updatePreferences",
        );
      }
      return this.fail(error, "TripController.updatePreferences");
    }
  }

  async getInviteLink(tripId: string) {
    try {
      const result = await this.tripService.getInviteLink(tripId);
      return this.ok(result);
    } catch (error) {
      return this.fail(error, "TripController.getInviteLink");
    }
  }

  async getTripByToken(token: string) {
    try {
      const result = await this.tripService.getTripByToken(token);
      return this.ok(result);
    } catch (error) {
      return this.fail(error, "TripController.getTripByToken");
    }
  }

  async joinTripByToken(token: string) {
    try {
      const result = await this.tripService.joinTripByToken(token);
      return this.ok(result);
    } catch (error) {
      return this.fail(error, "TripController.joinTripByToken");
    }
  }
}
