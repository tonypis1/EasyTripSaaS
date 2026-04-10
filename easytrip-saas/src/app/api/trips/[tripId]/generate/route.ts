import { container } from "@/server/di/container";
import { auth } from "@clerk/nextjs/server";
import { enforceRateLimit, tripGenerateLimiter } from "@/lib/rate-limit";

const tripController = container.controllers.tripController;

/**
 * POST /api/trips/[tripId]/generate
 * Avvia generazione / rigenerazione gratuita (Inngest). Per versioni a pagamento usare checkout rigenerazione.
 */
export async function POST(
  _req: Request,
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
    tripGenerateLimiter,
    `gen:${userId}:${tripId}`,
  );
  if (rl) return rl;

  if (!tripId) {
    return Response.json(
      { ok: false, error: { message: "tripId richiesto" } },
      { status: 400 },
    );
  }

  return tripController.requestGeneration(tripId);
}
