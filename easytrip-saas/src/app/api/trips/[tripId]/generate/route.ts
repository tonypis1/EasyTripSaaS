import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { inngest } from "@/lib/inngest/client";
import { logger } from "@/lib/observability";

/**
 * POST /api/trips/[tripId]/generate
 * Avvia la generazione dell'itinerario inviando un evento a Inngest.
 * Usa questo endpoint dopo aver creato un Trip (es. da webhook Stripe).
 */
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ tripId: string }> }
) {
  const { tripId } = await params;

  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
  }

  if (!tripId) {
    return NextResponse.json(
      { error: "tripId richiesto" },
      { status: 400 }
    );
  }

  try {
    await inngest.send({
      name: "trip/generate.requested",
      data: { tripId, userId },
    });

    return NextResponse.json({
      ok: true,
      message: "Generazione avviata",
      tripId,
    });
  } catch (err) {
    logger.error("Errore invio evento Inngest", err, { tripId, userId });
    return NextResponse.json(
      { error: "Errore nell'avvio della generazione" },
      { status: 500 }
    );
  }
}
