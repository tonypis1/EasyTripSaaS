import { container } from "@/server/di/container";
import { auth } from "@clerk/nextjs/server";

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

  return tripController.liveSuggest(tripId, req);
}
