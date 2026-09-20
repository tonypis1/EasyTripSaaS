import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Le route di checkout Stripe (/api/billing/checkout, regen-checkout,
 * reactivate-checkout, subscribe) creano una vera Stripe Checkout Session
 * per chiamata: prima di questo fix erano prive di rate limiting, a
 * differenza degli altri endpoint AI-heavy/abusabili (generate,
 * live-suggest, join). Questi test verificano che ogni route sia collegata
 * al proprio limiter con la chiave giusta, risponda 401 senza autenticazione
 * e non deleghi mai al controller quando il rate limit scatta.
 */

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  enforceRateLimit: vi.fn(),
  createCheckout: vi.fn(),
  createRegenCheckout: vi.fn(),
  createReactivateCheckout: vi.fn(),
  createSubscriptionCheckout: vi.fn(),
}));

vi.mock("@clerk/nextjs/server", () => ({ auth: mocks.auth }));

vi.mock("@/lib/rate-limit", () => ({
  enforceRateLimit: mocks.enforceRateLimit,
  checkoutLimiter: "checkout-limiter",
  regenCheckoutLimiter: "regen-checkout-limiter",
  reactivateCheckoutLimiter: "reactivate-checkout-limiter",
  subscribeCheckoutLimiter: "subscribe-checkout-limiter",
}));

vi.mock("@/server/di/container", () => ({
  container: {
    controllers: {
      billingController: {
        createCheckout: mocks.createCheckout,
        createRegenCheckout: mocks.createRegenCheckout,
        createReactivateCheckout: mocks.createReactivateCheckout,
        createSubscriptionCheckout: mocks.createSubscriptionCheckout,
      },
    },
  },
}));

import { POST as checkoutPost } from "@/app/api/billing/checkout/route";
import { POST as regenPost } from "@/app/api/billing/regen-checkout/route";
import { POST as reactivatePost } from "@/app/api/billing/reactivate-checkout/route";
import { POST as subscribePost } from "@/app/api/billing/subscribe/route";

const cases = [
  {
    name: "checkout",
    handler: checkoutPost,
    controllerMock: mocks.createCheckout,
    limiter: "checkout-limiter",
    key: "checkout:user1",
  },
  {
    name: "regen-checkout",
    handler: regenPost,
    controllerMock: mocks.createRegenCheckout,
    limiter: "regen-checkout-limiter",
    key: "regen_checkout:user1",
  },
  {
    name: "reactivate-checkout",
    handler: reactivatePost,
    controllerMock: mocks.createReactivateCheckout,
    limiter: "reactivate-checkout-limiter",
    key: "reactivate_checkout:user1",
  },
  {
    name: "subscribe",
    handler: subscribePost,
    controllerMock: mocks.createSubscriptionCheckout,
    limiter: "subscribe-checkout-limiter",
    key: "subscribe:user1",
  },
];

function req() {
  return new Request("http://localhost/api/billing/x", {
    method: "POST",
    body: "{}",
  });
}

beforeEach(() => {
  vi.resetAllMocks();
  mocks.auth.mockResolvedValue({ userId: "user1" });
  mocks.enforceRateLimit.mockResolvedValue(null);
});

describe.each(cases)(
  "$name route",
  ({ handler, controllerMock, limiter, key }) => {
    it("risponde 401 se non autenticato, senza consultare il rate limiter né il controller", async () => {
      mocks.auth.mockResolvedValue({ userId: null });

      const res = await handler(req());

      expect(res.status).toBe(401);
      expect(mocks.enforceRateLimit).not.toHaveBeenCalled();
      expect(controllerMock).not.toHaveBeenCalled();
    });

    it("consulta il proprio limiter con la chiave per-utente attesa", async () => {
      await handler(req());

      expect(mocks.enforceRateLimit).toHaveBeenCalledWith(limiter, key);
    });

    it("risponde con il 429 del rate limiter e non delega al controller", async () => {
      mocks.enforceRateLimit.mockResolvedValue(
        Response.json(
          { ok: false, error: { code: "RATE_LIMITED" } },
          { status: 429 },
        ),
      );

      const res = await handler(req());

      expect(res.status).toBe(429);
      expect(controllerMock).not.toHaveBeenCalled();
    });

    it("delega al controller quando autenticato e non limitato", async () => {
      controllerMock.mockResolvedValue(
        Response.json({ ok: true }, { status: 201 }),
      );
      const request = req();

      const res = await handler(request);

      expect(res.status).toBe(201);
      expect(controllerMock).toHaveBeenCalledWith(request);
    });
  },
);
