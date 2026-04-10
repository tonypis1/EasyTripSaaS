import { container } from "@/server/di/container";
import { auth } from "@clerk/nextjs/server";

const tripController = container.controllers.tripController;

/**
 * POST /api/trips/[tripId]/active-version
 * Body: { "versionNum": 1 }
 * Carosello: attiva una versione salvata senza nuova generazione.
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

  return tripController.setActiveVersion(tripId, req);
}
