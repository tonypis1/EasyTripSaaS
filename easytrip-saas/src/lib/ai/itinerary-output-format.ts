import { jsonSchemaOutputFormat } from "@/lib/ai/structured-output";
import {
  DaySlotSchema,
  ModelResponseSchema,
  RestaurantEntrySchema,
} from "@/lib/itinerary-model-schema";

/**
 * Formato Structured Outputs della generazione dell'itinerario. Slot e
 * ristorante stanno in `$defs`: inline (3 slot + ristoranti per giorno) lo
 * schema supera il limite di complessità della grammatica e l'API risponde 400.
 */
export const ITINERARY_OUTPUT_FORMAT = jsonSchemaOutputFormat(
  ModelResponseSchema,
  { slot: DaySlotSchema, restaurant: RestaurantEntrySchema },
);
