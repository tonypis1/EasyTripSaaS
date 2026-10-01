import { container } from "@/server/di/container";
import { auth } from "@clerk/nextjs/server";
import { enforceRateLimit, replaceSlotLimiter } from "@/lib/rate-limit";

const tripController = container.controllers.tripController;

/**
 * Margine sopra il caso peggiore di SlotReplaceService: fino a 2 chiamate
 * Anthropic sequenziali (tentativo + un'eventuale riparazione, v.
 * generateWithRepair in @/lib/ai/repairLoop), ciascuna con
 * SYNC_REQUEST_OPTIONS (35s di timeout, 1 retry => ~70s nel caso peggiore
 * per singola chiamata) => ~140s nel caso peggiore assoluto. Il caso tipico
 * misurato con l'API reale è 9-18s.
 * Senza questo la route usava il maxDuration di default della piattaforma,
 * che poteva essere inferiore e uccidere la funzione a metà di un tentativo.
 */
export const maxDuration = 150;

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
