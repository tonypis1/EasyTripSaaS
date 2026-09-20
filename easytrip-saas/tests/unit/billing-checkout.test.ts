import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Copre la creazione delle Checkout Session (percorso billing, prima non
 * testato): lo scenario "crediti coprono tutto" (nessuna chiamata a Stripe),
 * lo scenario Stripe standard, e i guard clause di regen/reactivate.
 */

const mocks = vi.hoisted(() => ({
  paymentCreate: vi.fn(),
  paymentFindFirst: vi.fn(),
  userUpdate: vi.fn(),
  creditFindMany: vi.fn(),
  transaction: vi.fn(),
  tripFindFirst: vi.fn(),
  stripeCheckoutCreate: vi.fn(),
  inngestSend: vi.fn(),
  sendTransactionalEmail: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    payment: {
      create: mocks.paymentCreate,
      findFirst: mocks.paymentFindFirst,
    },
    user: {
      update: mocks.userUpdate,
    },
    credit: {
      findMany: mocks.creditFindMany,
    },
    trip: {
      findFirst: mocks.tripFindFirst,
    },
    $transaction: mocks.transaction,
  },
}));

vi.mock("@/config/unifiedConfig", () => ({
  config: {
    app: { baseUrl: "https://easytripsaas.com" },
    billing: {
      stripeSecretKey: "sk_test_x",
      stripeWebhookSecret: "whsec_test",
      priceSoloCoupleCents: 399,
      priceGroupCents: 699,
      priceRegenCents: 199,
      priceReactivateCents: 290,
      priceLocalPassCents: 399,
      stripeSubscriptionPriceId: null,
      stripePromoCodeNewTripId: null,
      currency: "eur",
    },
  },
}));

vi.mock("@/lib/billing/stripe", () => ({
  stripe: {
    checkout: { sessions: { create: mocks.stripeCheckoutCreate } },
  },
}));

vi.mock("@/lib/inngest/client", () => ({
  inngest: { send: mocks.inngestSend },
}));

vi.mock("@/lib/email/transactional", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/lib/email/transactional")>();
  return { ...actual, sendTransactionalEmail: mocks.sendTransactionalEmail };
});

import { BillingService } from "@/server/services/billing/billingService";
import { PaymentRepository } from "@/server/repositories/PaymentRepository";
import type { AuthService } from "@/server/services/auth/authService";
import type { TripRepository } from "@/server/repositories/TripRepository";

function baseTrip(overrides: Record<string, unknown> = {}) {
  return {
    id: "trip1",
    organizerId: "user1",
    destination: "Roma",
    tripType: "solo",
    localPassCityCount: 0,
    startDate: new Date("2026-06-01"),
    endDate: new Date("2026-06-05"),
    amountPaid: null,
    paymentId: null,
    regenCount: 1,
    accessExpiresAt: new Date("2026-07-01"),
    status: "pending",
    deletedAt: null,
    ...overrides,
  };
}

function baseUser(overrides: Record<string, unknown> = {}) {
  return {
    id: "user1",
    email: "org@example.com",
    language: "it",
    planType: "free",
    subExpiresAt: null,
    ...overrides,
  };
}

function makeService(
  authOverrides: Record<string, unknown> = {},
  tripRepoOverrides: Record<string, unknown> = {},
) {
  const fakeAuthService = {
    getOrCreateCurrentUser: vi.fn().mockResolvedValue(baseUser()),
    ...authOverrides,
  } as unknown as AuthService;

  const fakeTripRepository = {
    findByIdAndOrganizer: vi.fn(),
    findById: vi.fn(),
    markAsPaid: vi.fn(),
    extendAccess: vi.fn(),
    countVersions: vi.fn().mockResolvedValue(0),
    ...tripRepoOverrides,
  } as unknown as TripRepository;

  const paymentRepository = new PaymentRepository();

  const service = new BillingService(
    fakeAuthService,
    fakeTripRepository,
    paymentRepository,
  );

  return { service, fakeTripRepository, fakeAuthService };
}

beforeEach(() => {
  vi.resetAllMocks();
  mocks.creditFindMany.mockResolvedValue([]);
  mocks.tripFindFirst.mockResolvedValue(null);
  mocks.transaction.mockImplementation(async (cb) =>
    cb({ credit: { update: vi.fn() }, user: { update: vi.fn() } }),
  );
});

describe("BillingService.createCheckoutSession", () => {
  it("lancia 404 se il trip non appartiene all'utente", async () => {
    const { service } = makeService(undefined, {
      findByIdAndOrganizer: vi.fn().mockResolvedValue(null),
    });

    await expect(
      service.createCheckoutSession({ tripId: "trip1" }),
    ).rejects.toMatchObject({ code: "TRIP_NOT_FOUND", statusCode: 404 });
  });

  it("scenario A — i crediti coprono l'intero importo: nessuna chiamata a Stripe, Payment 'credit_full', trip marcato pagato", async () => {
    mocks.creditFindMany.mockResolvedValue([
      { id: "credit1", amount: 3.99, expiresAt: new Date("2027-01-01") },
    ]);
    mocks.paymentCreate.mockResolvedValue({ id: "pay1" });

    const { service, fakeTripRepository } = makeService(undefined, {
      findByIdAndOrganizer: vi.fn().mockResolvedValue(baseTrip()),
    });

    const result = await service.createCheckoutSession({ tripId: "trip1" });

    expect(result.fullyPaidByCredit).toBe(true);
    expect(mocks.stripeCheckoutCreate).not.toHaveBeenCalled();
    expect(mocks.transaction).toHaveBeenCalledTimes(1);
    expect(mocks.paymentCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        type: "purchase",
        amount: 0,
        stripePaymentId: expect.stringContaining("credit_full_trip1_"),
      }),
    });
    expect(fakeTripRepository.markAsPaid).toHaveBeenCalledTimes(1);
    expect(mocks.inngestSend).toHaveBeenCalledWith({
      name: "trip/generate.requested",
      data: { tripId: "trip1" },
    });
  });

  it("scenario B — nessun credito disponibile: crea una Stripe Checkout Session per l'importo pieno", async () => {
    mocks.creditFindMany.mockResolvedValue([]);
    mocks.stripeCheckoutCreate.mockResolvedValue({
      id: "cs_1",
      url: "https://checkout.stripe.com/cs_1",
    });

    const { service } = makeService(undefined, {
      findByIdAndOrganizer: vi.fn().mockResolvedValue(baseTrip()),
    });

    const result = await service.createCheckoutSession({ tripId: "trip1" });

    expect(mocks.paymentCreate).not.toHaveBeenCalled();
    expect(result.checkoutUrl).toBe("https://checkout.stripe.com/cs_1");
    expect(result.amountCents).toBe(399);
    expect(mocks.stripeCheckoutCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: "payment",
        metadata: expect.objectContaining({
          tripId: "trip1",
          appUserId: "user1",
          paymentType: "purchase",
        }),
      }),
    );
  });

  it("scenario C — crediti parziali: sconta l'importo Stripe e passa creditApplyCents nei metadata", async () => {
    mocks.creditFindMany.mockResolvedValue([
      { id: "credit1", amount: 2, expiresAt: new Date("2027-01-01") },
    ]);
    mocks.stripeCheckoutCreate.mockResolvedValue({
      id: "cs_1",
      url: "https://checkout.stripe.com/cs_1",
    });

    const { service } = makeService(undefined, {
      findByIdAndOrganizer: vi.fn().mockResolvedValue(baseTrip()),
    });

    const result = await service.createCheckoutSession({ tripId: "trip1" });

    // Prezzo solo/coppia 399c − 200c di credito = 199c da pagare su Stripe.
    expect(result.amountCents).toBe(199);
    expect(result.creditAppliedCents).toBe(200);
    expect(mocks.stripeCheckoutCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: expect.objectContaining({ creditApplyCents: "200" }),
      }),
    );
    // Con crediti parziali applicati, i crediti non vengono ancora consumati
    // qui: il consumo avviene nel fulfillment webhook dopo il pagamento Stripe.
    expect(mocks.transaction).not.toHaveBeenCalled();
  });
});

describe("BillingService.createRegenCheckoutSession", () => {
  it("lancia 400 TRIP_NOT_PAID se il viaggio principale non è mai stato acquistato", async () => {
    const { service } = makeService(undefined, {
      findByIdAndOrganizer: vi
        .fn()
        .mockResolvedValue(baseTrip({ amountPaid: null })),
    });

    await expect(
      service.createRegenCheckoutSession({ tripId: "trip1" }),
    ).rejects.toMatchObject({ code: "TRIP_NOT_PAID", statusCode: 400 });
    expect(mocks.stripeCheckoutCreate).not.toHaveBeenCalled();
  });

  it("lancia 400 REGEN_NOT_PAID_TIER per le rigenerazioni gratuite (versioni 2-4)", async () => {
    const { service } = makeService(undefined, {
      findByIdAndOrganizer: vi.fn().mockResolvedValue(
        baseTrip({ amountPaid: 3.99, regenCount: 1 }), // nextVersionNum = 2 → gratis
      ),
    });

    await expect(
      service.createRegenCheckoutSession({ tripId: "trip1" }),
    ).rejects.toMatchObject({ code: "REGEN_NOT_PAID_TIER", statusCode: 400 });
  });

  it("crea la Checkout Session per le rigenerazioni a pagamento (versioni 5-7)", async () => {
    mocks.stripeCheckoutCreate.mockResolvedValue({
      id: "cs_regen",
      url: "https://checkout.stripe.com/cs_regen",
    });

    const { service } = makeService(undefined, {
      findByIdAndOrganizer: vi.fn().mockResolvedValue(
        baseTrip({ amountPaid: 3.99, regenCount: 4 }), // nextVersionNum = 5 → a pagamento
      ),
    });

    const result = await service.createRegenCheckoutSession({
      tripId: "trip1",
    });

    expect(result.amountCents).toBe(199);
    expect(mocks.stripeCheckoutCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: expect.objectContaining({ paymentType: "regen" }),
      }),
    );
  });
});

describe("BillingService.createReactivateCheckoutSession", () => {
  it("lancia 400 ACCESS_STILL_ACTIVE se l'accesso non è ancora scaduto", async () => {
    const { service } = makeService(undefined, {
      findByIdAndOrganizer: vi
        .fn()
        .mockResolvedValue(
          baseTrip({ accessExpiresAt: new Date(Date.now() + 86_400_000) }),
        ),
    });

    await expect(
      service.createReactivateCheckoutSession({ tripId: "trip1" }),
    ).rejects.toMatchObject({ code: "ACCESS_STILL_ACTIVE", statusCode: 400 });
  });

  it("crea la Checkout Session di riattivazione quando l'accesso è scaduto", async () => {
    mocks.stripeCheckoutCreate.mockResolvedValue({
      id: "cs_reactivate",
      url: "https://checkout.stripe.com/cs_reactivate",
    });

    const { service } = makeService(undefined, {
      findByIdAndOrganizer: vi
        .fn()
        .mockResolvedValue(
          baseTrip({ accessExpiresAt: new Date(Date.now() - 86_400_000) }),
        ),
    });

    const result = await service.createReactivateCheckoutSession({
      tripId: "trip1",
    });

    expect(result.amountCents).toBe(290);
    expect(mocks.stripeCheckoutCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: expect.objectContaining({ paymentType: "reactivate" }),
      }),
    );
  });
});
