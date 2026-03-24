import { BaseController } from "@/server/controllers/BaseController";
import { TripService } from "@/server/services/trip/tripService";
import { createTripSchema } from "@/server/validators/trip.schema";
import { AppError } from "@/server/errors/AppError";

export class TripController extends BaseController {
  constructor(private readonly tripService: TripService) {
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
          "TripController.create"
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
      await this.tripService.deleteMyTrip(tripId);
      return this.ok({ deleted: true });
    } catch (error) {
      return this.fail(error, "TripController.deleteById");
    }
  }
}

