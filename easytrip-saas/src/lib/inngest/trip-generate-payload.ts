export const TRIP_GENERATE_EVENT = "trip/generate.requested" as const;

/**
 * Evento della prima generazione dopo l'acquisto. Webhook Stripe e sync al
 * ritorno da Checkout arrivano quasi insieme e possono inviarlo entrambi (il
 * secondo vede il viaggio pagato ma ancora senza versioni, perché la
 * generazione dura ~90s): con lo stesso `id` Inngest scarta i duplicati entro
 * 24h. `initial` fa prenotare al generatore solo la v1 (vedi
 * `riserva-version-num` in generate-itinerary.ts).
 */
export function initialTripGenerateEvent(tripId: string) {
  return {
    name: TRIP_GENERATE_EVENT,
    id: `trip-generate-initial-${tripId}`,
    data: { tripId, initial: true },
  };
}

type MinimalEvt = {
  name?: string;
  data?: unknown;
};

/**
 * Legge tripId / userId / initial da event.data, incluso il caso raro data.data (SDK/executor legacy).
 */
function readTripGenerateFields(data: unknown): {
  tripId?: string;
  userId?: string;
  initial?: boolean;
} {
  if (!data || typeof data !== "object") return {};
  const o = data as Record<string, unknown>;
  let tripId: string | undefined;
  let userId: string | undefined;
  let initial = o.initial === true;

  const t0 = o.tripId ?? o.trip_id;
  const u0 = o.userId ?? o.user_id;
  if (typeof t0 === "string" && t0.length > 0) tripId = t0;
  if (typeof u0 === "string" && u0.length > 0) userId = u0;

  if (!tripId && o.data != null && typeof o.data === "object") {
    const n = o.data as Record<string, unknown>;
    const t1 = n.tripId ?? n.trip_id;
    const u1 = n.userId ?? n.user_id;
    if (typeof t1 === "string" && t1.length > 0) tripId = t1;
    if (typeof u1 === "string" && u1.length > 0) userId = u1;
    initial ||= n.initial === true;
  }

  return { tripId, userId, initial };
}

/**
 * Risolve tripId (e opz. userId) dal contesto Inngest.
 * Utile quando il trigger mostrato è `inngest/function.invoked` ma il payload utile
 * è in `events[0]` (evento reale `trip/generate.requested`).
 */
export function resolveTripGeneratePayload(
  event: MinimalEvt,
  events: readonly MinimalEvt[],
): { tripId: string; userId?: string; initial: boolean } {
  const chain: MinimalEvt[] = [event, ...events];

  const preferGenerate = chain.filter((e) => e?.name === TRIP_GENERATE_EVENT);
  const rest = chain.filter((e) => e?.name !== TRIP_GENERATE_EVENT);
  const ordered = [...preferGenerate, ...rest];

  for (const e of ordered) {
    const { tripId, userId, initial } = readTripGenerateFields(e?.data);
    if (tripId) return { tripId, userId, initial: initial === true };
  }

  throw new Error(
    [
      "tripId mancante nell'evento Inngest (event.data.tripId undefined).",
      `Trigger ricevuto: "${event?.name ?? "sconosciuto"}".`,
      "Se nell'UI Inngest hai usato «Invoke» sulla funzione, non viene passato il payload:",
      `usa «Send event» con nome "${TRIP_GENERATE_EVENT}" e corpo JSON, ad es.:`,
      '{ "name": "trip/generate.requested", "data": { "tripId": "ID_VIAGGIO" } }',
    ].join(" "),
  );
}
