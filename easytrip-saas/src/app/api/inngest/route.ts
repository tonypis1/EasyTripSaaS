import { serve } from "inngest/next";
import { inngest } from "@/lib/inngest/client";
import { generateItinerary } from "@/lib/inngest/functions/generate-itinerary";

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [generateItinerary],
});
