import type { PostHogConfig } from "posthog-js";

export const POSTHOG_KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY ?? "";
export const POSTHOG_HOST =
  process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://eu.i.posthog.com";

/**
 * Opzioni di `posthog.init`, usate solo dopo il consenso ai cookie di analisi
 * (vedi `src/lib/analytics/consent.ts`): prima di allora PostHog non viene
 * inizializzato e non salva nulla nel browser.
 */
export const POSTHOG_INIT_OPTIONS: Partial<PostHogConfig> = {
  api_host: POSTHOG_HOST,
  person_profiles: "identified_only",
  capture_pageview: false,
  capture_pageleave: true,
};
