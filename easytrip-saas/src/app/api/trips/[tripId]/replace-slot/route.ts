import { container } from "@/server/di/container";
import { auth } from "@clerk/nextjs/server";

const tripController = container.controllers.tripController;

/**
 * POST /api/trips/[tripId]/replace-slot
 * Body: { "dayId", "slot": "morning"|"afternoon"|"evening", "lat"?, "lng"? }
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ tripId: string }> }
) {
  const { tripId } = await params;

  const { userId } = await auth();
  if (!userId) {
    return Response.json({ ok: false, error: { message: "Non autenticato" } }, { status: 401 });
  }

  return tripController.replaceSlot(tripId, req);
}
