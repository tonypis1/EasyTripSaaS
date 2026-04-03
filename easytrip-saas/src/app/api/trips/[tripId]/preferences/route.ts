import { container } from "@/server/di/container";
import { auth } from "@clerk/nextjs/server";

const tripController = container.controllers.tripController;

/**
 * PATCH /api/trips/[tripId]/preferences
 * Body: { "style": "foodie", "budgetLevel": "premium" }
 */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ tripId: string }> }
) {
  const { tripId } = await params;

  const { userId } = await auth();
  if (!userId) {
    return Response.json({ ok: false, error: { message: "Non autenticato" } }, { status: 401 });
  }

  return tripController.updatePreferences(tripId, req);
}
