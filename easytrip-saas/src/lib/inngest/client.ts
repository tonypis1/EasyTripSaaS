import { Inngest } from "inngest";

/**
 * In locale (`npm run dev`) serve la modalità **dev** di Inngest:
 * - `inngest.send()` invia gli eventi al Dev Server (es. porta 8288)
 * - `serve()` registra le funzioni sul Dev Server, così l’evento `trip/generate.requested`
 *   può avviare davvero `generate-itinerary`.
 *
 * Senza questo, con solo INNGEST_EVENT_KEY / SIGNING_KEY nel `.env`, l’SDK resta in
 * modalità **cloud**: il cloud ha le funzioni, ma il Dev Server locale no →
 * «No functions triggered by this event» su http://localhost:8288.
 */
const isLocalNextDev = process.env.NODE_ENV === "development";

export const inngest = new Inngest({
  id: "easytrip",
  name: "EasyTrip",
  isDev: isLocalNextDev,
});
