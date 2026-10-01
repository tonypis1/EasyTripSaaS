import { describe, expect, it } from "vitest";
import {
  CONSENT_MAX_AGE_MS,
  CONSENT_STORAGE_KEY,
  readConsent,
  shouldStartAnalytics,
  writeConsent,
} from "@/lib/analytics/consent";
import { POSTHOG_INIT_OPTIONS } from "@/lib/analytics/posthog-options";

function memoryStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
    data,
  };
}

const NOW = Date.UTC(2026, 9, 1);

describe("consenso ai cookie di analisi", () => {
  it("nessuna scelta salvata: null (il banner va mostrato)", () => {
    expect(readConsent(memoryStorage(), NOW)).toBeNull();
    expect(readConsent(null, NOW)).toBeNull();
  });

  it("salva e rilegge la scelta con la data", () => {
    const storage = memoryStorage();
    expect(writeConsent(storage, "denied", NOW)).toBe(true);
    expect(JSON.parse(storage.data.get(CONSENT_STORAGE_KEY)!)).toEqual({
      value: "denied",
      at: NOW,
    });
    expect(readConsent(storage, NOW + 1000)).toBe("denied");
  });

  it("la scelta scade dopo 6 mesi: il banner ricompare", () => {
    const storage = memoryStorage();
    writeConsent(storage, "granted", NOW);
    expect(readConsent(storage, NOW + CONSENT_MAX_AGE_MS)).toBe("granted");
    expect(readConsent(storage, NOW + CONSENT_MAX_AGE_MS + 1)).toBeNull();
    expect(CONSENT_MAX_AGE_MS).toBeGreaterThanOrEqual(
      180 * 24 * 60 * 60 * 1000,
    );
  });

  it("valori illeggibili, sconosciuti o con data nel futuro valgono come nessuna scelta", () => {
    for (const raw of [
      "{rotto",
      JSON.stringify({ value: "maybe", at: NOW }),
      JSON.stringify({ value: "granted" }),
      JSON.stringify({ value: "granted", at: NOW + 60_000 }),
    ]) {
      expect(
        readConsent(memoryStorage({ [CONSENT_STORAGE_KEY]: raw }), NOW),
      ).toBeNull();
    }
  });

  it("storage che lancia (navigazione privata, bloccato): nessun errore, nessuna scelta", () => {
    const broken = {
      getItem: () => {
        throw new Error("SecurityError");
      },
      setItem: () => {
        throw new Error("QuotaExceededError");
      },
    };
    expect(readConsent(broken, NOW)).toBeNull();
    expect(writeConsent(broken, "granted", NOW)).toBe(false);
  });

  it("gli analytics partono solo con consenso esplicito e chiave configurata", () => {
    expect(shouldStartAnalytics("granted", true)).toBe(true);
    expect(shouldStartAnalytics("denied", true)).toBe(false);
    expect(shouldStartAnalytics(null, true)).toBe(false);
    expect(shouldStartAnalytics("granted", false)).toBe(false);
  });

  it("le opzioni di PostHog restano quelle di prima (nessuna pageview automatica)", () => {
    expect(POSTHOG_INIT_OPTIONS).toMatchObject({
      person_profiles: "identified_only",
      capture_pageview: false,
    });
  });
});
