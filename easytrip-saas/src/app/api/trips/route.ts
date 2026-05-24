import { container } from "@/server/di/container";

const tripController = container.controllers.tripController;

export async function GET() {
  return tripController.list();
}

export async function POST(req: Request) {
  return tripController.create(req);
}
