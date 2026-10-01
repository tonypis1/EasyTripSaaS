import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  messagesCreate: vi.fn(),
  loggerWarn: vi.fn(),
  loggerInfo: vi.fn(),
}));

vi.mock("@/lib/ai/anthropic", () => ({
  ANTHROPIC_MODEL: "claude-test",
  // La ricerca usa lo streaming: `finalMessage()` restituisce il messaggio completo.
  anthropic: {
    messages: {
      stream: (...args: unknown[]) => ({
        finalMessage: () => mocks.messagesCreate(...args),
      }),
    },
  },
}));

vi.mock("@/lib/observability", () => ({
  logger: {
    warn: mocks.loggerWarn,
    info: mocks.loggerInfo,
    error: vi.fn(),
  },
}));

import {
  finalAnswerText,
  GroundingService,
} from "@/server/services/trip/groundingService";
import type { VerifiedPoiCacheRepository } from "@/server/repositories/VerifiedPoiCacheRepository";

const groundingPayload = {
  areas: [
    {
      name: "Centro Storico",
      attractions: [{ name: "Colosseo", kind: "monument", note: "n" }],
      restaurants: [{ name: "Trattoria Da Enzo", cuisine: "roman", note: "n" }],
    },
  ],
};

function searchResponse(overrides: Record<string, unknown> = {}) {
  return {
    stop_reason: "end_turn",
    content: [
      { type: "server_tool_use", name: "web_search" },
      {
        type: "web_search_tool_result",
        content: [
          {
            type: "web_search_result",
            url: "https://it.wikipedia.org/wiki/Roma",
            title: "Roma",
          },
          {
            type: "web_search_result",
            url: "javascript:alert(1)",
            title: "evil",
          },
        ],
      },
      { type: "text", text: "Ecco: " },
      { type: "text", text: JSON.stringify(groundingPayload) },
    ],
    ...overrides,
  };
}

function makeRepo(findFresh: unknown = null) {
  return {
    findFresh: vi.fn().mockResolvedValue(findFresh),
    upsert: vi.fn().mockResolvedValue({}),
  } as unknown as VerifiedPoiCacheRepository & {
    findFresh: ReturnType<typeof vi.fn>;
    upsert: ReturnType<typeof vi.fn>;
  };
}

function makeService(
  repo: VerifiedPoiCacheRepository,
  options = { enabled: true, ttlDays: 30 },
) {
  return new GroundingService(repo, options);
}

beforeEach(() => {
  mocks.messagesCreate.mockReset();
  mocks.loggerWarn.mockReset();
  mocks.loggerInfo.mockReset();
});

describe("GroundingService.getGrounding — cache condivisa", () => {
  it("cache hit: ritorna i luoghi cachati senza alcuna chiamata di ricerca (riuso tra utenti)", async () => {
    const fetchedAt = new Date("2026-09-01T10:00:00Z");
    const repo = makeRepo({
      payload: groundingPayload,
      sources: [{ url: "https://it.wikipedia.org/wiki/Roma", title: "Roma" }],
      fetchedAt,
    });

    const result = await makeService(repo).getGrounding("Roma");

    expect(result?.source).toBe("cache");
    expect(result?.grounding.areas[0].attractions[0].name).toBe("Colosseo");
    expect(result?.fetchedAt).toBe(fetchedAt.toISOString());
    expect(mocks.messagesCreate).not.toHaveBeenCalled();
    expect(repo.upsert).not.toHaveBeenCalled();
  });

  it("interroga la cache con la chiave normalizzata (Roma / ROMA / ' roma ' condividono la riga)", async () => {
    const repo = makeRepo({
      payload: groundingPayload,
      sources: [],
      fetchedAt: new Date(),
    });
    const service = makeService(repo);

    await service.getGrounding("Roma");
    await service.getGrounding("  ROMA ");

    expect(repo.findFresh.mock.calls.map((c) => c[0])).toEqual([
      "roma",
      "roma",
    ]);
  });

  it("cache miss: cerca sul web con web_search, salva in cache con il TTL e ritorna i luoghi", async () => {
    mocks.messagesCreate.mockResolvedValue(searchResponse());
    const repo = makeRepo(null);

    const result = await makeService(repo, {
      enabled: true,
      ttlDays: 14,
    }).getGrounding("Roma");

    expect(result?.source).toBe("web");
    expect(result?.grounding.areas[0].name).toBe("Centro Storico");

    const params = mocks.messagesCreate.mock.calls[0][0];
    expect(params.model).toBe("claude-test");
    expect(params.tools).toEqual([
      expect.objectContaining({
        type: "web_search_20250305",
        name: "web_search",
      }),
    ]);
    expect(params.tools[0].max_uses).toBeGreaterThan(0);
    // Timeout, retry e tetto complessivo espliciti: la ricerca non deve poter restare appesa.
    const options = mocks.messagesCreate.mock.calls[0][1];
    expect(options).toMatchObject({ timeout: 60_000, maxRetries: 1 });
    expect(options.signal).toBeInstanceOf(AbortSignal);
    expect(options.signal.aborted).toBe(false);

    expect(repo.upsert).toHaveBeenCalledTimes(1);
    const saved = repo.upsert.mock.calls[0][0];
    expect(saved.destinationKey).toBe("roma");
    expect(saved.ttlDays).toBe(14);
    expect(saved.payload).toEqual(result?.grounding);
  });

  it("salva come fonti solo gli URL http/s dei risultati di ricerca (mai quelli generati dal modello)", async () => {
    mocks.messagesCreate.mockResolvedValue(searchResponse());
    const repo = makeRepo(null);

    const result = await makeService(repo).getGrounding("Roma");

    expect(result?.sources).toEqual([
      { url: "https://it.wikipedia.org/wiki/Roma", title: "Roma" },
    ]);
  });

  it("payload in cache non valido: lo tratta come miss e lo rigenera", async () => {
    mocks.messagesCreate.mockResolvedValue(searchResponse());
    const repo = makeRepo({
      payload: { areas: "corrotto" },
      sources: [],
      fetchedAt: new Date(),
    });

    const result = await makeService(repo).getGrounding("Roma");

    expect(result?.source).toBe("web");
    expect(repo.upsert).toHaveBeenCalledTimes(1);
  });

  it("se la scrittura in cache fallisce ritorna comunque i luoghi verificati", async () => {
    mocks.messagesCreate.mockResolvedValue(searchResponse());
    const repo = makeRepo(null);
    repo.upsert.mockRejectedValue(new Error("db down"));

    const result = await makeService(repo).getGrounding("Roma");

    expect(result?.source).toBe("web");
    expect(mocks.loggerWarn).toHaveBeenCalled();
  });
});

describe("GroundingService.getGrounding — pause_turn", () => {
  it("riprende il turno server-side interrotto rimandando il turno parziale dell'assistente", async () => {
    const partial = [{ type: "server_tool_use", name: "web_search" }];
    mocks.messagesCreate
      .mockResolvedValueOnce({ stop_reason: "pause_turn", content: partial })
      .mockResolvedValueOnce(searchResponse());
    const repo = makeRepo(null);

    const result = await makeService(repo).getGrounding("Roma");

    expect(result?.source).toBe("web");
    expect(mocks.messagesCreate).toHaveBeenCalledTimes(2);
    const secondMessages = mocks.messagesCreate.mock.calls[1][0].messages;
    expect(secondMessages.at(-1)).toEqual({
      role: "assistant",
      content: partial,
    });
  });

  it("dopo troppe riprese rinuncia (null) invece di ciclare all'infinito", async () => {
    mocks.messagesCreate.mockResolvedValue({
      stop_reason: "pause_turn",
      content: [],
    });
    const repo = makeRepo(null);

    expect(await makeService(repo).getGrounding("Roma")).toBeNull();
    expect(mocks.messagesCreate).toHaveBeenCalledTimes(4);
    expect(repo.upsert).not.toHaveBeenCalled();
  });
});

describe("GroundingService.getGrounding — degradazione (non lancia mai)", () => {
  it("kill switch: con il grounding disattivato non tocca né cache né API", async () => {
    const repo = makeRepo(null);

    const result = await makeService(repo, {
      enabled: false,
      ttlDays: 30,
    }).getGrounding("Roma");

    expect(result).toBeNull();
    expect(repo.findFresh).not.toHaveBeenCalled();
    expect(mocks.messagesCreate).not.toHaveBeenCalled();
  });

  it("destinazione senza lettere/numeri: salta il grounding invece di usare una chiave vuota", async () => {
    const repo = makeRepo(null);

    expect(await makeService(repo).getGrounding("!!!")).toBeNull();
    expect(repo.findFresh).not.toHaveBeenCalled();
  });

  it("errore dell'API (es. tool non disponibile): ritorna null, logga e non scrive in cache", async () => {
    mocks.messagesCreate.mockRejectedValue(
      new Error("400 web_search non supportato"),
    );
    const repo = makeRepo(null);

    expect(await makeService(repo).getGrounding("Roma")).toBeNull();
    expect(mocks.loggerWarn).toHaveBeenCalled();
    expect(repo.upsert).not.toHaveBeenCalled();
  });

  it("risposta non JSON: ritorna null e non avvelena la cache condivisa", async () => {
    mocks.messagesCreate.mockResolvedValue({
      stop_reason: "end_turn",
      content: [{ type: "text", text: "Non ho trovato nulla." }],
    });
    const repo = makeRepo(null);

    expect(await makeService(repo).getGrounding("Roma")).toBeNull();
    expect(repo.upsert).not.toHaveBeenCalled();
  });

  it("ignora le note di avanzamento scritte tra una ricerca e l'altra (anche con parentesi graffe)", async () => {
    // Forma reale osservata con web_search: testo intermedio, altre ricerche, poi il JSON finale.
    mocks.messagesCreate.mockResolvedValue({
      stop_reason: "end_turn",
      content: [
        { type: "server_tool_use", name: "web_search" },
        { type: "web_search_tool_result", content: [] },
        { type: "text", text: "Ora cerco i ristoranti {Centro, Monti}." },
        { type: "server_tool_use", name: "web_search" },
        { type: "web_search_tool_result", content: [] },
        { type: "thinking", thinking: "assemblo" },
        { type: "text", text: JSON.stringify(groundingPayload) },
      ],
    });

    const result = await makeService(makeRepo(null)).getGrounding("Roma");

    expect(result?.grounding.areas[0].name).toBe("Centro Storico");
  });

  it("errore di lettura dalla cache: ritorna null senza lanciare", async () => {
    const repo = makeRepo(null);
    repo.findFresh.mockRejectedValue(new Error("db down"));

    expect(await makeService(repo).getGrounding("Roma")).toBeNull();
  });
});

describe("finalAnswerText", () => {
  const text = (t: string) => ({ type: "text", text: t, citations: null });
  const tool = {
    type: "server_tool_use",
    id: "x",
    name: "web_search",
    input: {},
  };

  it("prende solo i blocchi di testo dopo l'ultimo blocco non testuale, uniti", () => {
    const content = [text("nota {"), tool, text('{"a":'), text("1}")];
    expect(finalAnswerText(content as never)).toBe('{"a":1}');
  });

  it("stringa vuota se la risposta non termina con del testo", () => {
    expect(finalAnswerText([text("x"), tool] as never)).toBe("");
    expect(finalAnswerText([])).toBe("");
  });
});
