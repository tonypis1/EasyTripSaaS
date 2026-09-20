import { describe, expect, it, vi } from "vitest";
import Anthropic from "@anthropic-ai/sdk";

vi.mock("@/config/unifiedConfig", () => ({
  config: {
    ai: { anthropicApiKey: "sk-ant-test", anthropicModel: "claude-test" },
  },
}));

import { SYNC_REQUEST_OPTIONS, toAiUnavailableError } from "@/lib/ai/anthropic";

describe("SYNC_REQUEST_OPTIONS", () => {
  it("usa un timeout e un numero di retry bassi, coerenti con una richiesta sincrona user-facing", () => {
    expect(SYNC_REQUEST_OPTIONS).toEqual({ timeout: 20_000, maxRetries: 1 });
  });
});

describe("toAiUnavailableError", () => {
  it("mappa un timeout/errore di connessione su 503 AI_TIMEOUT", () => {
    const err = toAiUnavailableError(new Anthropic.APIConnectionTimeoutError());
    expect(err).toMatchObject({ code: "AI_TIMEOUT", statusCode: 503 });
  });

  it("mappa un APIConnectionError generico su 503 AI_TIMEOUT", () => {
    const err = toAiUnavailableError(
      new Anthropic.APIConnectionError({ message: "network down" }),
    );
    expect(err).toMatchObject({ code: "AI_TIMEOUT", statusCode: 503 });
  });

  it("mappa un altro APIError (rate limit/overload) su 502 AI_UNAVAILABLE", () => {
    const err = toAiUnavailableError(
      new Anthropic.RateLimitError(
        429,
        { type: "error", error: { type: "rate_limit_error", message: "x" } },
        "rate limited",
        new Headers(),
      ),
    );
    expect(err).toMatchObject({ code: "AI_UNAVAILABLE", statusCode: 502 });
  });

  it("mappa un errore non-Anthropic su 500 AI_ERROR generico", () => {
    const err = toAiUnavailableError(new Error("qualcosa di inatteso"));
    expect(err).toMatchObject({ code: "AI_ERROR", statusCode: 500 });
  });
});
