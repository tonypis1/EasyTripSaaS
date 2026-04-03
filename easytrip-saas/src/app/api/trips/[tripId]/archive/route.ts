import { container } from "@/server/di/container";

const tripController = container.controllers.tripController;

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ tripId: string }> },
) {
  const { tripId } = await params;
  return tripController.archiveById(tripId);
}
