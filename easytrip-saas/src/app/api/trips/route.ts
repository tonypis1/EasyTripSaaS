import { container } from "@/server/di/container";
import { TripController } from "@/server/controllers/TripController";

const tripController = new TripController(container.services.tripService);

export async function GET() {
  return tripController.list();
}

export async function POST(req: Request) {
  return tripController.create(req);
}

