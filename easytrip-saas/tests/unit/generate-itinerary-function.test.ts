import { beforeEach, describe, expect, it, vi } from "vitest";
import { NonRetriableError } from "inngest";

/**
 * Job `generate-itinerary` con la generazione a blocchi: uno step per
 * chiamata al modello, giorni salvati in ordine, ed errore definitivo quando
 * un blocco esaurisce i tentativi (rieseguire il job rigiocherebbe gli stessi
 * esiti memorizzati).
 */

const mocks = vi.hoisted(() => ({
  messagesCreate: vi.fn(),
  tripFindUnique: vi.fn(),
  tripUpdate: vi.fn(),
  versionUpdateMany: vi.fn(),
  versionFindFirst: vi.fn(),
  versionCreate: vi.fn(),
  dayDeleteMany: vi.fn(),
  dayCreate: vi.fn(),
  sendTransactionalEmail: vi.fn(),
}));

vi.mock("@/lib/ai/anthropic", () => ({
  ANTHROPIC_MODEL: "claude-test",
  anthropic: {
    messages: {
      stream: (...args: unknown[]) => ({
        finalMessage: () => mocks.messagesCreate(...args),
      }),
    },
  },
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    trip: { findUnique: mocks.tripFindUnique, update: mocks.tripUpdate },
    tripVersion: {
      updateMany: mocks.versionUpdateMany,
      findFirst: mocks.versionFindFirst,
      create: mocks.versionCreate,
    },
    day: { deleteMany: mocks.dayDeleteMany, create: mocks.dayCreate },
  },
}));

vi.mock("@/config/unifiedConfig", () => ({
  config: {
    app: { baseUrl: "https://easytrip.test" },
    ai: { groundingEnabled: false, groundingTtlDays: 30 },
  },
}));

vi.mock("@/lib/observability", () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}));

vi.mock("@/lib/email/transactional", () => ({
  sendTransactionalEmail: mocks.sendTransactionalEmail,
  itineraryReadyHtml: () => "<html/>",
  itineraryReadyMemberHtml: () => "<html/>",
}));

type StepTools = {
  run: (id: string, fn: () => Promise<unknown>) => Promise<unknown>;
};
type InngestHandler = (args: {
  event: unknown;
  events: unknown[];
  step: StepTools;
}) => Promise<unknown>;

/** `InngestFunction.fn` è privato solo nei tipi: a runtime è una proprietà dell'istanza. */
function getHandler(inngestFunction: unknown): InngestHandler {
  return (inngestFunction as { fn: InngestHandler }).fn;
}

function slot(title: string, startTime: string, endTime: string) {
  return {
    title,
    place: "Centro",
    why: "Perché sì",
    startTime,
    endTime,
    durationMin: 120,
    googleMapsQuery: `${title} Roma`,
    bookingLink: null,
    tips: ["Vai presto"],
    lat: 41.9,
    lng: 12.45,
  };
}

function day(n: number) {
  return {
    dayNumber: n,
    title: `Giorno ${n}`,
    morning: slot(`Museo ${n}`, "09:00", "11:00"),
    afternoon: slot(`Parco ${n}`, "14:00", "16:00"),
    evening: slot(`Belvedere ${n}`, "18:00", "20:00"),
    zoneFocus: `Zona ${n}`,
    dowWarning: "",
    localGem: "Gem",
    tips: "Consigli",
    mapCenterLat: 41.9,
    mapCenterLng: 12.45,
    restaurants: [
      {
        meal: "pranzo",
        name: `Trattoria ${n}`,
        cuisine: "locale",
        why: "Buona",
        budgetHint: "€15",
        distance: "100m",
        reservationNeeded: false,
        reservationTip: "",
      },
      {
        meal: "cena",
        name: `Osteria ${n}`,
        cuisine: "locale",
        why: "Buona",
        budgetHint: "€25",
        distance: "100m",
        reservationNeeded: false,
        reservationTip: "",
      },
    ],
  };
}

type Params = { messages: { content: { text: string }[] }[] };

/** Risponde con i giorni chiesti nel blocco "GIORNI DA GENERARE"; `wrong(first)` = risposta sbagliata. */
function answerRequestedDays(wrong: (first: number) => boolean = () => false) {
  return (params: Params) => {
    const block = params.messages[0].content
      .map((b) => b.text)
      .find((t) => t.startsWith("SEZIONE — GIORNI DA GENERARE"))!;
    const m = block.match(/"dayNumber" (?:da (\d+) a (\d+)|= (\d+))/)!;
    const first = Number(m[1] ?? m[3]);
    const last = Number(m[2] ?? m[3]);
    const numbers = Array.from({ length: last - first + 1 }, (_, i) =>
      wrong(first) ? i + 1 : first + i,
    );
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            optimizationScore: 8,
            days: numbers.map(day),
          }),
        },
      ],
    };
  };
}

function trip() {
  return {
    id: "trip1",
    destination: "Roma",
    startDate: new Date("2026-06-01T00:00:00.000Z"),
    endDate: new Date("2026-06-10T00:00:00.000Z"),
    tripType: "coppia",
    style: null,
    budgetLevel: "moderate",
    regenCount: 0,
    usedZones: null,
    localPassCityCount: 0,
    interests: [],
    pace: null,
    mobilityNeeds: [],
    dietaryRestrictions: [],
    organizer: { language: "it", email: null },
    members: [],
  };
}

/** Step che memorizza gli esiti per id, come Inngest, e registra gli id eseguiti. */
function makeStep() {
  const ids: string[] = [];
  const memo = new Map<string, unknown>();
  return {
    ids,
    step: {
      run: async (id: string, fn: () => Promise<unknown>) => {
        if (memo.has(id)) return memo.get(id);
        ids.push(id);
        const result = await fn();
        memo.set(
          id,
          result === undefined ? undefined : structuredClone(result),
        );
        return result;
      },
    },
  };
}

const event = { name: "trip/generate.requested", data: { tripId: "trip1" } };

beforeEach(() => {
  vi.resetAllMocks();
  mocks.tripFindUnique.mockResolvedValue(trip());
  mocks.tripUpdate.mockResolvedValue({ regenCount: 1 });
  mocks.versionUpdateMany.mockResolvedValue({ count: 0 });
  mocks.versionFindFirst.mockResolvedValue(null);
  mocks.versionCreate.mockResolvedValue({ id: "v1" });
  mocks.dayDeleteMany.mockResolvedValue({ count: 0 });
  mocks.dayCreate.mockResolvedValue({});
});

describe("generate-itinerary — viaggio lungo a blocchi", () => {
  it("10 giorni: uno step per blocco, giorni salvati 1..10 con la data di sblocco giusta", async () => {
    mocks.messagesCreate.mockImplementation(answerRequestedDays());
    const { generateItinerary } =
      await import("@/lib/inngest/functions/generate-itinerary");
    const { ids, step } = makeStep();

    const result = await getHandler(generateItinerary)({
      event,
      events: [event],
      step,
    });

    expect(ids.filter((id) => id.includes("-giorni-"))).toEqual([
      "genera-giorni-1-4-1",
      "genera-giorni-5-7-1",
      "genera-giorni-8-10-1",
    ]);
    expect(mocks.messagesCreate).toHaveBeenCalledTimes(3);
    const created = mocks.dayCreate.mock.calls.map((c) => c[0].data);
    expect(created.map((d) => d.dayNumber)).toEqual([
      1, 2, 3, 4, 5, 6, 7, 8, 9, 10,
    ]);
    expect(created[9].unlockDate).toEqual(new Date("2026-06-10T00:00:00.000Z"));
    expect(result).toMatchObject({ tripId: "trip1", daysCreated: 10 });
  });

  it("un blocco senza risposta valida dopo i tentativi: errore definitivo (NonRetriableError), nessuna versione creata", async () => {
    mocks.messagesCreate.mockImplementation(
      answerRequestedDays((first) => first === 5),
    );
    const { generateItinerary } =
      await import("@/lib/inngest/functions/generate-itinerary");
    const { ids, step } = makeStep();

    const error = await getHandler(generateItinerary)({
      event,
      events: [event],
      step,
    }).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(NonRetriableError);
    expect((error as Error).message).toMatch(/dopo 3 tentativi \(giorni 5-7\)/);
    expect(ids).toContain("ripara-giorni-5-7-2");
    expect(ids).toContain("genera-giorni-5-7-3");
    expect(ids).not.toContain("genera-giorni-8-10-1");
    expect(ids).not.toContain("riserva-version-num");
    expect(mocks.dayCreate).not.toHaveBeenCalled();
  });

  it("un errore dell'API resta ritentabile (non diventa NonRetriableError)", async () => {
    mocks.messagesCreate.mockRejectedValue(new Error("overloaded_error"));
    const { generateItinerary } =
      await import("@/lib/inngest/functions/generate-itinerary");
    const { step } = makeStep();

    const error = await getHandler(generateItinerary)({
      event,
      events: [event],
      step,
    }).catch((e: unknown) => e);

    expect(error).not.toBeInstanceOf(NonRetriableError);
    expect((error as Error).message).toBe("overloaded_error");
  });
});
