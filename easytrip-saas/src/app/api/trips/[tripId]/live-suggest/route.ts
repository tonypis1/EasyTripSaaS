import { container } from "@/server/di/container";
import { auth } from "@clerk/nextjs/server";
import { enforceRateLimit, liveSuggestLimiter } from "@/lib/rate-limit";

const tripController = container.controllers.tripController;

/**
 * Margine sopra il caso peggiore di LiveSuggestService: fino a 2 chiamate
 * Anthropic sequenziali (tentativo + un'eventuale riparazione, v.
 * generateWithRepair in @/lib/ai/repairLoop), ciascuna con
 * SYNC_REQUEST_OPTIONS (20s di timeout, 1 retry => ~40s nel caso peggiore
 * per singola chiamata) => ~80s nel caso peggiore assoluto.
 * Senza questo la route usava il maxDuration di default della piattaforma,
 * che poteva essere inferiore e uccidere la funzione a metà di un tentativo.
 */
export const maxDuration = 85;

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
