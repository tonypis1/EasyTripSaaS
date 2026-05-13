import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { getSecurityHeaderList } from "./security-headers";

function getCsp(): string {
  const header = getSecurityHeaderList().find(
    (h) => h.key === "Content-Security-Policy",
  );
  if (!header) throw new Error("CSP header non presente");
  return header.value;
}

const ORIGINAL_ENV = { ...process.env };

beforeEach(() => {
  delete process.env.NEXT_PUBLIC_CLERK_FRONTEND_API_ORIGIN;
  delete process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
  delete process.env.NEXT_PUBLIC_CLERK_ACCOUNT_PORTAL_ORIGIN;
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

describe("CSP — Clerk Frontend API", () => {
  it("usa NEXT_PUBLIC_CLERK_FRONTEND_API_ORIGIN come override esplicito", () => {
    process.env.NEXT_PUBLIC_CLERK_FRONTEND_API_ORIGIN =
      "https://clerk.override.example";
    process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY =
      "pk_live_Y2xlcmsuZWFzeXRyaXBzYWFzLmNvbSQ";

    const csp = getCsp();

    expect(csp).toContain("https://clerk.override.example");
    expect(csp).not.toContain("https://clerk.easytripsaas.com");
  });

  it("deriva l'origine dal publishable key live quando manca l'override", () => {
    // base64("clerk.easytripsaas.com$") === "Y2xlcmsuZWFzeXRyaXBzYWFzLmNvbSQ="
    process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY =
      "pk_live_Y2xlcmsuZWFzeXRyaXBzYWFzLmNvbSQ";

    const csp = getCsp();

    expect(csp).toContain("https://clerk.easytripsaas.com");

    expect(csp).toMatch(/script-src[^;]*https:\/\/clerk\.easytripsaas\.com/i);
    expect(csp).toMatch(/connect-src[^;]*https:\/\/clerk\.easytripsaas\.com/i);
    expect(csp).toMatch(/frame-src[^;]*https:\/\/clerk\.easytripsaas\.com/i);
  });

  it("non aggiunge il dominio derivato se publishable key è malformato", () => {
    process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY = "not-a-real-key";

    const csp = getCsp();

    expect(csp).not.toContain("https://clerk.easytripsaas.com");
    expect(csp).toContain("https://*.clerk.com");
  });

  it("non aggiunge dominio se il base64 decodifica una stringa senza punto", () => {
    process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY = "pk_live_aGVsbG8k";

    const csp = getCsp();

    expect(csp).not.toMatch(/https:\/\/hello\b/i);
    expect(csp).toContain("https://*.clerk.com");
  });

  it("mantiene gli asset PostHog in connect-src", () => {
    const csp = getCsp();

    expect(csp).toMatch(/connect-src[^;]*https:\/\/eu-assets\.i\.posthog\.com/);
    expect(csp).toMatch(/connect-src[^;]*https:\/\/us-assets\.i\.posthog\.com/);
  });
});
