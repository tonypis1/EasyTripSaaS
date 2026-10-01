import { serve } from "inngest/next";
import { inngest } from "@/lib/inngest/client";
import { generateItinerary } from "@/lib/inngest/functions/generate-itinerary";
import { expireTrips } from "@/lib/inngest/functions/expire-trips";
import { creditExpiryReminders } from "@/lib/inngest/functions/credit-expiry-reminders";
import { preTripReminders } from "@/lib/inngest/functions/pre-trip-reminders";
import { postTripFollowup } from "@/lib/inngest/functions/post-trip-followup";
import { dataRetentionPurge } from "@/lib/inngest/functions/data-retention";
import { nurtureNoTrip } from "@/lib/inngest/functions/nurture-no-trip";
import { slotProposalExpiry } from "@/lib/inngest/functions/slot-proposal-expiry";

/** Evita risposte GET cached: la sync del Dev Server deve sempre vedere le funzioni aggiornate. */
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
/**
 * Ogni step Inngest è una richiesta a questa route. Gli step più lunghi, con
 * l'API reale: una chiamata di generazione (~2 minuti per 3 giorni; ogni
 * tentativo o riparazione è uno step a sé) e la ricerca di grounding (tetto
 * 200s). Senza un valore esplicito valeva il default della piattaforma, che
 * può essere più basso.
 */
export const maxDuration = 300;

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [
    generateItinerary,
    expireTrips,
    creditExpiryReminders,
    preTripReminders,
    postTripFollowup,
    dataRetentionPurge,
    nurtureNoTrip,
    slotProposalExpiry,
  ],
});
