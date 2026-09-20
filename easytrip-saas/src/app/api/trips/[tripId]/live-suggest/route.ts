import { container } from "@/server/di/container";
import { auth } from "@clerk/nextjs/server";
import { enforceRateLimit, liveSuggestLimiter } from "@/lib/rate-limit";

const tripController = container.controllers.tripController;

/**
 * Margine sopra il timeout/retry Anthropic per-richiesta (SYNC_REQUEST_OPTIONS
 * in @/lib/ai/anthropic: 20s di timeout, 1 retry => ~40s nel caso peggiore).
 * Senza questo la route usava il maxDuration di default della piattaforma,
 * che poteva essere inferiore e uccidere la funzione a metà di un retry.
 */
export const maxDuration = 45;

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
