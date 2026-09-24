import Anthropic from "@anthropic-ai/sdk";
import { config } from "@/config/unifiedConfig";
import { AppError } from "@/server/errors/AppError";

export const anthropic = new Anthropic({
  apiKey: config.ai.anthropicApiKey,
});

export const ANTHROPIC_MODEL = config.ai.anthropicModel;

/**
 * Opzioni per-richiesta per le chiamate sincrone, user-facing (live-suggest,
 * slot-replace): senza queste, un tentativo lento o bloccato lasciava la
 * richiesta HTTP in attesa fino al timeout di default dell'SDK (10 minuti),
 * ben oltre il maxDuration della route — il chiamante restava bloccato senza
 * alcuna degradazione controllata. Un solo retry (non il default 2 dell'SDK)
 * per restare abbondantemente sotto il maxDuration della route anche nel
 * caso peggiore (timeout + un retry).
 *
 * Non si applica a generate-itinerary (ItineraryGenerationService): quella
 * gira dentro un job Inngest con un proprio timeout (15 minuti) e già un suo
 * loop di retry/riparazione applicativo — un timeout così basso la
 * interromperebbe inutilmente su generazioni lunghe ma legittime.
 */
export const SYNC_REQUEST_OPTIONS = { timeout: 20_000, maxRetries: 1 };

/**
 * Traduce un errore SDK Anthropic (timeout, connessione, overload/rate
 * limit) in un AppError con status code e messaggio adatti a una risposta
 * HTTP, invece di farlo propagare come errore generico verso
 * BaseController.fail() (500 INTERNAL_ERROR, loggato come un bug applicativo
 * invece che come un problema temporaneo del provider AI).
 */
export function toAiUnavailableError(error: unknown): AppError {
  if (
    error instanceof Anthropic.APIConnectionTimeoutError ||
    error instanceof Anthropic.APIConnectionError
  ) {
    return new AppError(
      "Il servizio AI non risponde, riprova tra poco",
      503,
      "AI_TIMEOUT",
    );
  }
  if (error instanceof Anthropic.APIError) {
    return new AppError(
      "Il servizio AI è temporaneamente non disponibile, riprova tra poco",
      502,
      "AI_UNAVAILABLE",
    );
  }
  return new AppError(
    "Errore imprevisto durante la generazione AI",
    500,
    "AI_ERROR",
  );
}
