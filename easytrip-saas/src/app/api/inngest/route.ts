import { serve } from "inngest/next";
import { inngest } from "@/lib/inngest/client";
import { generateItinerary } from "@/lib/inngest/functions/generate-itinerary";

/** Evita risposte GET cached: la sync del Dev Server deve sempre vedere le funzioni aggiornate. */
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [generateItinerary],
});
