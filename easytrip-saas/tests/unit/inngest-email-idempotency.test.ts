import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Le funzioni Inngest testate qui inviano email in loop (promemoria,
 * follow-up, nurture, scadenza crediti). Il pattern corretto è "uno step per
 * destinatario": se il processo crasha a metà elenco, Inngest ripete solo
 * gli step non ancora completati con successo, senza reinviare le email già
 * partite. Questi test simulano un crash a metà esecuzione riusando la
 * stessa cache di step tra due invocazioni della funzione, esattamente come
 * farebbe Inngest tra un tentativo e il retry successivo.
 */

const mocks = vi.hoisted(() => ({
  tripFindMany: vi.fn(),
  userFindMany: vi.fn(),
  userUpdate: vi.fn(),
  creditFindMany: vi.fn(),
  sendTransactionalEmail: vi.fn(),
  sendMarketingEmail: vi.fn(),
  loggerError: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    trip: { findMany: mocks.tripFindMany },
    user: { findMany: mocks.userFindMany, update: mocks.userUpdate },
    credit: { findMany: mocks.creditFindMany },
  },
}));

vi.mock("@/config/unifiedConfig", () => ({
  config: { app: { baseUrl: "https://easytrip.test" } },
}));

vi.mock("@/lib/observability", () => ({
  logger: { error: mocks.loggerError, warn: vi.fn(), info: vi.fn() },
}));

vi.mock("@/lib/email/transactional", () => ({
  sendTransactionalEmail: mocks.sendTransactionalEmail,
  sendMarketingEmail: mocks.sendMarketingEmail,
  preTripCountdownHtml: () => "<html/>",
  tripStartTodayHtml: () => "<html/>",
  postTripFeedbackHtml: () => "<html/>",
  postTripReengageHtml: () => "<html/>",
  nurtureNoTripHtml: () => "<html/>",
  creditExpiryReminderHtml: () => "<html/>",
}));

type StepTools = {
  run: (id: string, fn: () => Promise<unknown>) => Promise<unknown>;
};
type InngestHandler = (args: { step: StepTools }) => Promise<unknown>;

/**
 * `InngestFunction.fn` è privato solo a livello di tipi TS; a runtime è una
 * proprietà pubblica dell'istanza (vedi `createFunction`). Questo helper
 * isola l'unico cast necessario per invocare l'handler direttamente nei
 * test, senza passare per il runtime completo di Inngest.
 */
function getHandler(inngestFunction: unknown): InngestHandler {
  return (inngestFunction as { fn: InngestHandler }).fn;
}

/** Step harness che memoizza i risultati per id, come fa davvero Inngest. */
function makeStep(cache: Map<string, unknown>, crashAfterCalls = Infinity) {
  let calls = 0;
  return {
    run: async (id: string, fn: () => Promise<unknown>) => {
      if (cache.has(id)) return cache.get(id);
      calls++;
      if (calls > crashAfterCalls) {
        throw new Error(`simulated crash before step "${id}"`);
      }
      const result = await fn();
      cache.set(id, result);
      return result;
    },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.sendTransactionalEmail.mockResolvedValue(undefined);
  mocks.sendMarketingEmail.mockResolvedValue(undefined);
  mocks.userUpdate.mockResolvedValue({});
});

describe("preTripReminders — idempotenza invii", () => {
  it("un crash a metà elenco non fa reinviare le email già partite al retry", async () => {
    const { preTripReminders } =
      await import("@/lib/inngest/functions/pre-trip-reminders");

    mocks.tripFindMany.mockResolvedValueOnce([
      {
        id: "t1",
        destination: "Roma",
        organizer: { email: "a@x.it", language: "it" },
      },
      {
        id: "t2",
        destination: "Parigi",
        organizer: { email: "b@x.it", language: "it" },
      },
    ]);
    mocks.tripFindMany.mockResolvedValueOnce([]);

    const cache = new Map<string, unknown>();

    // Primo tentativo: crash dopo il load + il primo invio (2 step completati).
    const attempt1 = makeStep(cache, 2);
    await expect(
      getHandler(preTripReminders)({ step: attempt1 }),
    ).rejects.toThrow(/simulated crash/);
    expect(mocks.sendTransactionalEmail).toHaveBeenCalledTimes(1);

    // Retry: la cache mantiene gli step già riusciti (load + primo invio),
    // quindi la findMany del trip load NON viene richiamata di nuovo e la
    // seconda email viene inviata una sola volta.
    const attempt2 = makeStep(cache);
    const result = await getHandler(preTripReminders)({ step: attempt2 });

    // 2 query totali (countdown + start-today), ciascuna eseguita una sola
    // volta: quella già risolta prima del crash non viene ripetuta al retry.
    expect(mocks.tripFindMany).toHaveBeenCalledTimes(2);
    expect(mocks.sendTransactionalEmail).toHaveBeenCalledTimes(2);
    expect(mocks.sendTransactionalEmail.mock.calls.map((c) => c[0].to)).toEqual(
      ["a@x.it", "b@x.it"],
    );
    expect(result).toMatchObject({ countdownSent: 2, todaySent: 0 });
  });

  it("usa uno step id univoco per trip (countdown-3d / start-today)", async () => {
    const { preTripReminders } =
      await import("@/lib/inngest/functions/pre-trip-reminders");

    mocks.tripFindMany.mockResolvedValueOnce([
      {
        id: "t1",
        destination: "Roma",
        organizer: { email: "a@x.it", language: "it" },
      },
    ]);
    mocks.tripFindMany.mockResolvedValueOnce([
      {
        id: "t2",
        destination: "Milano",
        organizer: { email: "b@x.it", language: "it" },
      },
    ]);

    const ids: string[] = [];
    const step = {
      run: async (id: string, fn: () => Promise<unknown>) => {
        ids.push(id);
        return fn();
      },
    };

    await getHandler(preTripReminders)({ step });

    expect(ids).toEqual([
      "load-countdown-trips",
      "countdown-3d:t1",
      "load-start-today-trips",
      "start-today:t2",
    ]);
  });
});

describe("postTripFollowup — idempotenza e dedup", () => {
  it("un crash a metà elenco non fa reinviare le email di feedback già partite", async () => {
    const { postTripFollowup } =
      await import("@/lib/inngest/functions/post-trip-followup");

    mocks.tripFindMany.mockResolvedValueOnce([
      {
        id: "t1",
        destination: "Roma",
        organizer: { email: "a@x.it", language: "it", referralCode: null },
      },
      {
        id: "t2",
        destination: "Parigi",
        organizer: { email: "b@x.it", language: "it", referralCode: null },
      },
    ]);
    mocks.tripFindMany.mockResolvedValueOnce([]);

    const cache = new Map<string, unknown>();

    const attempt1 = makeStep(cache, 2);
    await expect(
      getHandler(postTripFollowup)({ step: attempt1 }),
    ).rejects.toThrow(/simulated crash/);
    expect(mocks.sendTransactionalEmail).toHaveBeenCalledTimes(1);

    const attempt2 = makeStep(cache);
    const result = await getHandler(postTripFollowup)({ step: attempt2 });

    // 2 query totali (feedback + reengage), ciascuna eseguita una sola
    // volta: quella già risolta prima del crash non viene ripetuta al retry.
    expect(mocks.tripFindMany).toHaveBeenCalledTimes(2);
    expect(mocks.sendTransactionalEmail).toHaveBeenCalledTimes(2);
    expect(result).toMatchObject({ feedbackSent: 2, reengageSent: 0 });
  });

  it("nel reengage-14d deduplica per email PRIMA di creare gli step (un solo invio per organizzatore)", async () => {
    const { postTripFollowup } =
      await import("@/lib/inngest/functions/post-trip-followup");

    mocks.tripFindMany.mockResolvedValueOnce([]); // feedback-1d
    mocks.tripFindMany.mockResolvedValueOnce([
      {
        id: "t1",
        organizer: { email: "same@x.it", language: "it", referralCode: null },
      },
      {
        id: "t2",
        organizer: { email: "same@x.it", language: "it", referralCode: null },
      },
      {
        id: "t3",
        organizer: { email: "other@x.it", language: "it", referralCode: null },
      },
    ]);

    const ids: string[] = [];
    const step = {
      run: async (id: string, fn: () => Promise<unknown>) => {
        ids.push(id);
        return fn();
      },
    };

    const result = await getHandler(postTripFollowup)({ step });

    expect(ids).toEqual([
      "load-feedback-trips",
      "load-reengage-trips",
      "reengage-14d:t1",
      "reengage-14d:t3",
    ]);
    expect(mocks.sendTransactionalEmail).toHaveBeenCalledTimes(2);
    expect(result).toMatchObject({ feedbackSent: 0, reengageSent: 2 });
  });
});

describe("nurtureNoTrip — idempotenza invio + aggiornamento flag DB", () => {
  it("un crash a metà elenco non fa reinviare l'email né riscrivere il flag già salvato", async () => {
    const { nurtureNoTrip } =
      await import("@/lib/inngest/functions/nurture-no-trip");

    mocks.userFindMany.mockResolvedValueOnce([
      { id: "u1", email: "a@x.it", language: "it" },
      { id: "u2", email: "b@x.it", language: "it" },
    ]);
    mocks.userFindMany.mockResolvedValueOnce([]);

    const cache = new Map<string, unknown>();

    const attempt1 = makeStep(cache, 2);
    await expect(getHandler(nurtureNoTrip)({ step: attempt1 })).rejects.toThrow(
      /simulated crash/,
    );
    expect(mocks.sendMarketingEmail).toHaveBeenCalledTimes(1);
    expect(mocks.userUpdate).toHaveBeenCalledTimes(1);

    const attempt2 = makeStep(cache);
    const result = await getHandler(nurtureNoTrip)({ step: attempt2 });

    // 2 query totali (fase d3 + fase d7), ciascuna eseguita una sola volta.
    expect(mocks.userFindMany).toHaveBeenCalledTimes(2);
    expect(mocks.sendMarketingEmail).toHaveBeenCalledTimes(2);
    expect(mocks.userUpdate).toHaveBeenCalledTimes(2);
    expect(result).toMatchObject({ nurtureD3: 2, nurtureD7: 0 });
  });
});

describe("creditExpiryReminders — step id univoco per credito", () => {
  it("usa l'id del credito nella chiave dello step, non solo l'utente (più crediti stesso utente)", async () => {
    const { creditExpiryReminders } =
      await import("@/lib/inngest/functions/credit-expiry-reminders");

    mocks.creditFindMany.mockResolvedValueOnce([
      {
        id: "c1",
        amount: 10,
        expiresAt: new Date("2026-01-01T00:00:00Z"),
        user: { email: "a@x.it", language: "it" },
      },
      {
        id: "c2",
        amount: 20,
        expiresAt: new Date("2026-01-01T00:00:00Z"),
        user: { email: "a@x.it", language: "it" },
      },
    ]);
    mocks.creditFindMany.mockResolvedValueOnce([]);
    mocks.creditFindMany.mockResolvedValueOnce([]);

    const ids: string[] = [];
    const step = {
      run: async (id: string, fn: () => Promise<unknown>) => {
        ids.push(id);
        return fn();
      },
    };

    const result = await getHandler(creditExpiryReminders)({ step });

    expect(ids).toEqual([
      "load-credits-30d",
      "remind-30d:c1",
      "remind-30d:c2",
      "load-credits-7d",
      "load-credits-1d",
    ]);
    expect(mocks.sendTransactionalEmail).toHaveBeenCalledTimes(2);
    expect(result).toEqual({ sent: 2 });
  });
});
