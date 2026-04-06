import { serve } from "inngest/next";
import { inngest } from "@/lib/inngest/client";
import { generateItinerary } from "@/lib/inngest/functions/generate-itinerary";
import { expireTrips } from "@/lib/inngest/functions/expire-trips";
import { creditExpiryReminders } from "@/lib/inngest/functions/credit-expiry-reminders";
import { waitlistDrip } from "@/lib/inngest/functions/waitlist-drip";
import { preTripReminders } from "@/lib/inngest/functions/pre-trip-reminders";
import { postTripFollowup } from "@/lib/inngest/functions/post-trip-followup";

/** Evita risposte GET cached: la sync del Dev Server deve sempre vedere le funzioni aggiornate. */
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [
    generateItinerary,
    expireTrips,
    creditExpiryReminders,
    waitlistDrip,
    preTripReminders,
    postTripFollowup,
  ],
});
