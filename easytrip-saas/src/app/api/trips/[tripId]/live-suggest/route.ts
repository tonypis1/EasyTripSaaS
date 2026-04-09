import { container } from "@/server/di/container";
import { auth } from "@clerk/nextjs/server";
import { enforceRateLimit, liveSuggestLimiter } from "@/lib/rate-limit";

const tripController = container.controllers.tripController;

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
    liveSuggestLimiter,
    `live:${userId}:${tripId}`,
  );
  if (rl) return rl;

  return tripController.liveSuggest(tripId, req);
}
