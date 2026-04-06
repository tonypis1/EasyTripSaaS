import { container } from "@/server/di/container";

const tripController = container.controllers.tripController;

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  return tripController.getTripByToken(token);
}

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  return tripController.joinTripByToken(token);
}
