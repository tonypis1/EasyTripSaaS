import { container } from "@/server/di/container";
import { AppError } from "@/server/errors/AppError";

/**
 * GET /api/trips/[tripId]/calendar.ics
 * Scarica l'itinerario attivo come file .ics (RFC 5545), importabile in
 * Google Calendar/Apple Calendar/Outlook. Autenticazione e visibilità
 * (organizer o membro del trip) sono già applicate da
 * TripService.getTripDetail (usato internamente da getTripIcsExport).
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ tripId: string }> },
) {
  try {
    const { tripId } = await params;
    const { filename, content } =
      await container.services.tripService.getTripIcsExport(tripId);

    return new Response(content, {
      status: 200,
      headers: {
        "Content-Type": "text/calendar; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    if (error instanceof AppError) {
      return new Response(error.message, { status: error.statusCode });
    }
    return new Response("Impossibile generare il file calendario", {
      status: 500,
    });
  }
}
