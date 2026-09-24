import { beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";

/**
 * Copre il percorso più critico e, prima di questi test, meno testato del
 * codebase: il fulfillment dei webhook Stripe (pagamento, rigenerazione,
 * riattivazione, scadenza checkout, sync abbonamento) dentro BillingService.
 * Verifica in particolare l'idempotenza (vincolo DB su stripePaymentId,
 * dedup webhook per event.id) introdotta per chiudere la race condition sui
 * pagamenti duplicati.
 */

const mocks = vi.hoisted(() => ({
  paymentCreate: vi.fn(),
  paymentFindFirst: vi.fn(),
  webhookDeliveryCreate: vi.fn(),
  userFindUnique: vi.fn(),
  userFindFirst: vi.fn(),
  userUpdate: vi.fn(),
  creditFindMany: vi.fn(),
  transaction: vi.fn(),
  stripeConstructEvent: vi.fn(),
  stripeCustomersRetrieve: vi.fn(),
  inngestSend: vi.fn(),
  sendTransactionalEmail: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    payment: {
      create: mocks.paymentCreate,
      findFirst: mocks.paymentFindFirst,
    },
    webhookDelivery: {
      create: mocks.webhookDeliveryCreate,
    },
    user: {
      findUnique: mocks.userFindUnique,
      findFirst: mocks.userFindFirst,
      update: mocks.userUpdate,
    },
    credit: {
      findMany: mocks.creditFindMany,
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
    webhooks: { constructEvent: mocks.stripeConstructEvent },
    customers: { retrieve: mocks.stripeCustomersRetrieve },
    checkout: { sessions: { create: vi.fn(), retrieve: vi.fn() } },
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

vi.mock("@/server/di/container", () => ({
  container: { services: { referralService: { tryGrantReward: vi.fn() } } },
}));

import { BillingService } from "@/server/services/billing/billingService";
import { PaymentRepository } from "@/server/repositories/PaymentRepository";
import type { AuthService } from "@/server/services/auth/authService";
import type { TripRepository } from "@/server/repositories/TripRepository";

function p2002() {
  return new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
    code: "P2002",
    clientVersion: "6.19.3",
  });
}

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

function makeService(tripRepoOverrides: Record<string, unknown> = {}) {
  const fakeAuthService = {
    getOrCreateCurrentUser: vi.fn(),
  } as unknown as AuthService;

  const fakeTripRepository = {
    findById: vi.fn(),
    findByIdAndOrganizer: vi.fn(),
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

  return { service, fakeTripRepository };
}

function checkoutCompletedEvent(overrides: Record<string, unknown> = {}) {
  return {
    id: "evt_1",
    type: "checkout.session.completed",
    data: {
      object: {
        id: "cs_1",
        mode: "payment",
        payment_intent: "pi_123",
        amount_total: 399,
        metadata: {
          tripId: "trip1",
          appUserId: "user1",
          paymentType: "purchase",
        },
        ...overrides,
      },
    },
  };
}

beforeEach(() => {
  vi.resetAllMocks();
  mocks.creditFindMany.mockResolvedValue([]);
  mocks.transaction.mockImplementation(async (cb) =>
    cb({ credit: { update: vi.fn() }, user: { update: vi.fn() } }),
  );
});

describe("BillingService.handleStripeWebhook — verifica firma", () => {
  it("lancia 400 MISSING_SIGNATURE senza header firma", async () => {
    const { service } = makeService();
    await expect(service.handleStripeWebhook("{}", null)).rejects.toMatchObject(
      { code: "MISSING_SIGNATURE", statusCode: 400 },
    );
  });

  it("lancia 400 INVALID_SIGNATURE se Stripe non verifica la firma", async () => {
    mocks.stripeConstructEvent.mockImplementation(() => {
      throw new Error("firma non valida");
    });
    const { service } = makeService();
    await expect(
      service.handleStripeWebhook("{}", "sig_bad"),
    ).rejects.toMatchObject({ code: "INVALID_SIGNATURE", statusCode: 400 });
  });
});

describe("BillingService — checkout.session.completed (purchase)", () => {
  it("crea il Payment, marca il trip pagato, invia l'email e innesca la generazione AI", async () => {
    mocks.stripeConstructEvent.mockReturnValue(checkoutCompletedEvent());
    mocks.paymentFindFirst.mockResolvedValue(null);
    mocks.paymentCreate.mockResolvedValue({ id: "pay1" });
    mocks.userFindUnique.mockResolvedValue({
      email: "org@example.com",
      language: "it",
    });

    const { service, fakeTripRepository } = makeService({
      findById: vi.fn().mockResolvedValue(baseTrip()),
    });

    const result = await service.handleStripeWebhook("{}", "sig_ok");

    expect(result).toEqual({ received: true });
    expect(mocks.paymentCreate).toHaveBeenCalledTimes(1);
    expect(mocks.paymentCreate).toHaveBeenCalledWith({
      data: {
        userId: "user1",
        tripId: "trip1",
        type: "purchase",
        stripePaymentId: "pi_123",
        amount: 3.99,
      },
    });
    expect(fakeTripRepository.markAsPaid).toHaveBeenCalledWith("trip1", {
      paymentId: "pi_123",
      amountPaid: 3.99,
    });
    expect(mocks.sendTransactionalEmail).toHaveBeenCalledTimes(1);
    expect(mocks.inngestSend).toHaveBeenCalledWith({
      name: "trip/generate.requested",
      data: { tripId: "trip1" },
    });
  });

  it("non elabora due volte lo stesso pagamento quando una race condition supera il pre-check applicativo (vincolo DB)", async () => {
    // Simula: due delivery concorrenti passano entrambe il `findFirst` (nessuna vede
    // ancora la riga dell'altra) ma solo il primo `create` riesce; il secondo
    // viola il vincolo UNIQUE su stripePaymentId e deve fermarsi PRIMA di
    // qualunque side effect (crediti, markAsPaid, email, inngest).
    mocks.stripeConstructEvent.mockReturnValue(checkoutCompletedEvent());
    mocks.paymentFindFirst.mockResolvedValue(null);
    mocks.paymentCreate
      .mockResolvedValueOnce({ id: "pay1" })
      .mockImplementationOnce(() => {
        throw p2002();
      });
    mocks.userFindUnique.mockResolvedValue({
      email: "org@example.com",
      language: "it",
    });

    const { service, fakeTripRepository } = makeService({
      findById: vi.fn().mockResolvedValue(baseTrip()),
    });

    const first = await service.handleStripeWebhook("{}", "sig_ok");
    const second = await service.handleStripeWebhook("{}", "sig_ok");

    // handleStripeWebhook risponde sempre { received: true } a Stripe per questo
    // evento (il campo `skipped` è visibile solo ai chiamanti diretti di
    // fulfillCheckoutSessionCompleted, es. syncCheckoutSessionAfterRedirect):
    // la prova che la seconda chiamata è stata trattata come duplicato sta
    // nell'assenza dei side effect qui sotto, non nel valore di ritorno.
    expect(first).toEqual({ received: true });
    expect(second).toEqual({ received: true });

    expect(mocks.paymentCreate).toHaveBeenCalledTimes(2);
    expect(fakeTripRepository.markAsPaid).toHaveBeenCalledTimes(1);
    expect(mocks.sendTransactionalEmail).toHaveBeenCalledTimes(1);
    expect(mocks.inngestSend).toHaveBeenCalledTimes(1);
  });

  it("non consuma i crediti due volte quando la race condition colpisce dopo l'applicazione crediti", async () => {
    mocks.stripeConstructEvent.mockReturnValue(
      checkoutCompletedEvent({
        metadata: {
          tripId: "trip1",
          appUserId: "user1",
          paymentType: "purchase",
          creditApplyCents: "200",
        },
      }),
    );
    mocks.paymentFindFirst.mockResolvedValue(null);
    mocks.paymentCreate
      .mockResolvedValueOnce({ id: "pay1" })
      .mockImplementationOnce(() => {
        throw p2002();
      });
    mocks.userFindUnique.mockResolvedValue({
      email: "org@example.com",
      language: "it",
    });
    mocks.creditFindMany.mockResolvedValue([
      {
        id: "credit1",
        amount: 2,
        expiresAt: new Date("2027-01-01"),
      },
    ]);

    const { service } = makeService({
      findById: vi.fn().mockResolvedValue(baseTrip()),
    });

    await service.handleStripeWebhook("{}", "sig_ok");
    await service.handleStripeWebhook("{}", "sig_ok");

    // Il Payment (chiave di idempotenza) viene creato PRIMA di consumare i
    // crediti: la seconda chiamata deve fermarsi senza mai toccare $transaction.
    expect(mocks.transaction).toHaveBeenCalledTimes(1);
  });

  it("lancia 400 INVALID_METADATA se mancano tripId o appUserId", async () => {
    mocks.stripeConstructEvent.mockReturnValue(
      checkoutCompletedEvent({ metadata: { paymentType: "purchase" } }),
    );
    const { service } = makeService();

    await expect(
      service.handleStripeWebhook("{}", "sig_ok"),
    ).rejects.toMatchObject({ code: "INVALID_METADATA", statusCode: 400 });
    expect(mocks.paymentCreate).not.toHaveBeenCalled();
  });

  it("ignora le checkout session in modalità subscription (gestite dal webhook subscription)", async () => {
    mocks.stripeConstructEvent.mockReturnValue(
      checkoutCompletedEvent({ mode: "subscription" }),
    );
    const { service } = makeService();

    const result = await service.handleStripeWebhook("{}", "sig_ok");

    expect(result).toEqual({ received: true });
    expect(mocks.paymentCreate).not.toHaveBeenCalled();
  });

  it("skippa come already_paid se il trip risulta già pagato (nessun nuovo Payment con questo stripePaymentId)", async () => {
    mocks.stripeConstructEvent.mockReturnValue(checkoutCompletedEvent());
    mocks.paymentFindFirst.mockResolvedValue(null);

    const { service, fakeTripRepository } = makeService({
      findById: vi
        .fn()
        .mockResolvedValue(baseTrip({ paymentId: "pi_old", amountPaid: 3.99 })),
    });

    await service.handleStripeWebhook("{}", "sig_ok");

    expect(mocks.paymentCreate).not.toHaveBeenCalled();
    expect(fakeTripRepository.markAsPaid).not.toHaveBeenCalled();
  });
});

describe("BillingService — checkout.session.completed (regen/reactivate)", () => {
  it("regen: crea il Payment e reinnesca trip/generate.requested", async () => {
    mocks.stripeConstructEvent.mockReturnValue(
      checkoutCompletedEvent({
        metadata: { tripId: "trip1", appUserId: "user1", paymentType: "regen" },
      }),
    );
    mocks.paymentFindFirst.mockResolvedValue(null);
    mocks.paymentCreate.mockResolvedValue({ id: "pay1" });

    const { service } = makeService({
      findById: vi.fn().mockResolvedValue(baseTrip({ amountPaid: 3.99 })),
    });

    await service.handleStripeWebhook("{}", "sig_ok");

    expect(mocks.paymentCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        type: "regen",
        stripePaymentId: "pi_123",
      }),
    });
    expect(mocks.inngestSend).toHaveBeenCalledWith({
      name: "trip/generate.requested",
      data: { tripId: "trip1" },
    });
  });

  it("regen: lancia 400 TRIP_NOT_PAID se il viaggio principale non è mai stato acquistato", async () => {
    mocks.stripeConstructEvent.mockReturnValue(
      checkoutCompletedEvent({
        metadata: { tripId: "trip1", appUserId: "user1", paymentType: "regen" },
      }),
    );
    mocks.paymentFindFirst.mockResolvedValue(null);

    const { service } = makeService({
      findById: vi.fn().mockResolvedValue(baseTrip({ amountPaid: null })),
    });

    await expect(
      service.handleStripeWebhook("{}", "sig_ok"),
    ).rejects.toMatchObject({ code: "TRIP_NOT_PAID", statusCode: 400 });
    expect(mocks.paymentCreate).not.toHaveBeenCalled();
  });

  it("reactivate: crea il Payment ed estende l'accesso di 30 giorni", async () => {
    mocks.stripeConstructEvent.mockReturnValue(
      checkoutCompletedEvent({
        metadata: {
          tripId: "trip1",
          appUserId: "user1",
          paymentType: "reactivate",
        },
      }),
    );
    mocks.paymentFindFirst.mockResolvedValue(null);
    mocks.paymentCreate.mockResolvedValue({ id: "pay1" });

    const { service, fakeTripRepository } = makeService({
      findById: vi.fn().mockResolvedValue(baseTrip()),
    });

    await service.handleStripeWebhook("{}", "sig_ok");

    expect(fakeTripRepository.extendAccess).toHaveBeenCalledWith("trip1", 30);
  });

  it("reactivate: non estende l'accesso se il pagamento è già stato elaborato (duplicato)", async () => {
    mocks.stripeConstructEvent.mockReturnValue(
      checkoutCompletedEvent({
        metadata: {
          tripId: "trip1",
          appUserId: "user1",
          paymentType: "reactivate",
        },
      }),
    );
    mocks.paymentFindFirst.mockResolvedValue(null);
    mocks.paymentCreate.mockImplementationOnce(() => {
      throw p2002();
    });

    const { service, fakeTripRepository } = makeService({
      findById: vi.fn().mockResolvedValue(baseTrip()),
    });

    const result = await service.handleStripeWebhook("{}", "sig_ok");

    expect(result).toEqual({ received: true });
    expect(fakeTripRepository.extendAccess).not.toHaveBeenCalled();
  });
});

describe("BillingService — checkout.session.expired", () => {
  function expiredEvent(overrides: Record<string, unknown> = {}) {
    return {
      id: "evt_expired_1",
      type: "checkout.session.expired",
      data: {
        object: {
          id: "cs_1",
          metadata: { tripId: "trip1", paymentType: "purchase" },
          ...overrides,
        },
      },
    };
  }

  it("invia l'email di carrello abbandonato per un trip pending non pagato (prima delivery)", async () => {
    mocks.stripeConstructEvent.mockReturnValue(expiredEvent());
    mocks.webhookDeliveryCreate.mockResolvedValue({ id: "wd1" });
    mocks.userFindUnique.mockResolvedValue({
      email: "org@example.com",
      language: "it",
    });

    const { service } = makeService({
      findById: vi.fn().mockResolvedValue(baseTrip()),
    });

    await service.handleStripeWebhook("{}", "sig_ok");

    expect(mocks.sendTransactionalEmail).toHaveBeenCalledTimes(1);
  });

  it("non invia due volte l'email su redelivery dello stesso evento (dedup per event.id)", async () => {
    mocks.stripeConstructEvent.mockReturnValue(expiredEvent());
    mocks.webhookDeliveryCreate
      .mockResolvedValueOnce({ id: "wd1" })
      .mockImplementationOnce(() => {
        throw p2002();
      });
    mocks.userFindUnique.mockResolvedValue({
      email: "org@example.com",
      language: "it",
    });

    const { service } = makeService({
      findById: vi.fn().mockResolvedValue(baseTrip()),
    });

    await service.handleStripeWebhook("{}", "sig_ok");
    await service.handleStripeWebhook("{}", "sig_ok");

    expect(mocks.sendTransactionalEmail).toHaveBeenCalledTimes(1);
  });

  it("non invia l'email se il trip non è più in stato 'abbandonato' (già pagato)", async () => {
    mocks.stripeConstructEvent.mockReturnValue(expiredEvent());
    mocks.webhookDeliveryCreate.mockResolvedValue({ id: "wd1" });

    const { service } = makeService({
      findById: vi
        .fn()
        .mockResolvedValue(baseTrip({ amountPaid: 3.99, paymentId: "pi_x" })),
    });

    await service.handleStripeWebhook("{}", "sig_ok");

    expect(mocks.sendTransactionalEmail).not.toHaveBeenCalled();
  });
});

describe("BillingService — customer.subscription.updated/deleted", () => {
  function subscriptionEvent(
    type: "customer.subscription.updated" | "customer.subscription.deleted",
    overrides: Record<string, unknown> = {},
  ) {
    return {
      id: "evt_sub_1",
      type,
      data: {
        object: {
          id: "sub_1",
          customer: "cus_1",
          status: "active",
          current_period_end: Math.floor(Date.parse("2026-08-01") / 1000),
          items: { data: [] },
          ...overrides,
        },
      },
    };
  }

  it("attiva il piano 'sub' quando la subscription è active", async () => {
    mocks.stripeConstructEvent.mockReturnValue(
      subscriptionEvent("customer.subscription.updated"),
    );
    mocks.stripeCustomersRetrieve.mockResolvedValue({
      deleted: false,
      email: "org@example.com",
    });
    mocks.userFindFirst.mockResolvedValue({ id: "user1", language: "it" });

    const { service } = makeService();
    await service.handleStripeWebhook("{}", "sig_ok");

    expect(mocks.userUpdate).toHaveBeenCalledWith({
      where: { id: "user1" },
      data: {
        stripeCustomerId: "cus_1",
        planType: "sub",
        subExpiresAt: new Date("2026-08-01T00:00:00.000Z"),
      },
    });
  });

  it("riporta il piano a 'free' quando la subscription è cancellata", async () => {
    mocks.stripeConstructEvent.mockReturnValue(
      subscriptionEvent("customer.subscription.deleted", {
        status: "canceled",
      }),
    );
    mocks.stripeCustomersRetrieve.mockResolvedValue({
      deleted: false,
      email: "org@example.com",
    });
    mocks.userFindFirst.mockResolvedValue({ id: "user1", language: "it" });

    const { service } = makeService();
    await service.handleStripeWebhook("{}", "sig_ok");

    expect(mocks.userUpdate).toHaveBeenCalledWith({
      where: { id: "user1" },
      data: {
        stripeCustomerId: "cus_1",
        planType: "free",
        subExpiresAt: null,
      },
    });
  });

  it("non aggiorna nulla se lo Stripe customer non è più recuperabile (deleted)", async () => {
    mocks.stripeConstructEvent.mockReturnValue(
      subscriptionEvent("customer.subscription.updated"),
    );
    mocks.stripeCustomersRetrieve.mockResolvedValue({ deleted: true });

    const { service } = makeService();
    await service.handleStripeWebhook("{}", "sig_ok");

    expect(mocks.userUpdate).not.toHaveBeenCalled();
  });

  it("non aggiorna nulla se non trova un utente corrispondente", async () => {
    mocks.stripeConstructEvent.mockReturnValue(
      subscriptionEvent("customer.subscription.updated"),
    );
    mocks.stripeCustomersRetrieve.mockResolvedValue({
      deleted: false,
      email: "sconosciuto@example.com",
    });
    mocks.userFindFirst.mockResolvedValue(null);

    const { service } = makeService();
    await service.handleStripeWebhook("{}", "sig_ok");

    expect(mocks.userUpdate).not.toHaveBeenCalled();
  });
});
