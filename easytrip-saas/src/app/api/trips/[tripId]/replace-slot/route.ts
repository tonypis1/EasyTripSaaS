import { container } from "@/server/di/container";
import { auth } from "@clerk/nextjs/server";
import { enforceRateLimit, replaceSlotLimiter } from "@/lib/rate-limit";

const tripController = container.controllers.tripController;

/**
 * POST /api/trips/[tripId]/replace-slot
 * Body: { "dayId", "slot": "morning"|"afternoon"|"evening", "lat"?, "lng"? }
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ tripId: string }> },
) {
  const { tripId } = await params;

  const { userId } = await auth();
  if (!userId) {
    return Response.json(
      { ok: false, error: { message: "Non autenticato" } },
      { status: 401 },
    );
  }

  const rl = await enforceRateLimit(
    replaceSlotLimiter,
    `slot:${userId}:${tripId}`,
  );
  if (rl) return rl;

  return tripController.replaceSlot(tripId, req);
}
