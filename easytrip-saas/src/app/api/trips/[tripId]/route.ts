import { container } from "@/server/di/container";

const tripController = container.controllers.tripController;

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ tripId: string }> }
) {
  const { tripId } = await params;
  return tripController.getById(tripId);
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ tripId: string }> }
) {
  const { tripId } = await params;
  return tripController.deleteById(tripId);
}
