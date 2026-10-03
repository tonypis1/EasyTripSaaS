import { describe, expect, it, vi } from "vitest";
import type { Ratelimit } from "@upstash/ratelimit";
import { enforceRateLimit } from "@/lib/rate-limit";

/**
 * Le route chiamano `enforceRateLimit` fuori dal try/catch del controller:
 * se Upstash lanciava, la route rispondeva 500 con body vuoto e il client
 * mostrava "Errore di rete durante il checkout". Ora il limiter è fail-open.
 */

function fakeLimiter(limit: ReturnType<typeof vi.fn>): Ratelimit {
  return { limit } as unknown as Ratelimit;
}

describe("enforceRateLimit", () => {
  it("procede (null) se il limiter non è configurato", async () => {
    expect(await enforceRateLimit(null, "checkout:user1")).toBeNull();
  });

  it("procede (null) se la richiesta è entro il limite", async () => {
    const limit = vi.fn().mockResolvedValue({
      success: true,
      limit: 10,
      remaining: 9,
      reset: Date.now() + 60_000,
    });

    expect(
      await enforceRateLimit(fakeLimiter(limit), "checkout:user1"),
    ).toBeNull();
    expect(limit).toHaveBeenCalledWith("checkout:user1");
  });

  it("risponde 429 JSON se il limite è superato", async () => {
    const limit = vi.fn().mockResolvedValue({
      success: false,
      limit: 10,
      remaining: 0,
      reset: Date.now() + 30_000,
    });

    const res = await enforceRateLimit(fakeLimiter(limit), "checkout:user1");

    expect(res?.status).toBe(429);
    expect(res?.headers.get("Retry-After")).toBeTruthy();
    const json = await res?.json();
    expect(json).toMatchObject({
      ok: false,
      error: { code: "RATE_LIMITED" },
    });
  });

  it("è fail-open e logga l'errore se Upstash non risponde", async () => {
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});
    const limit = vi
      .fn()
      .mockRejectedValue(new Error("ERR max requests limit exceeded"));

    await expect(
      enforceRateLimit(fakeLimiter(limit), "checkout:user1"),
    ).resolves.toBeNull();
    expect(consoleError).toHaveBeenCalledTimes(1);
    expect(String(consoleError.mock.calls[0]?.[0])).toContain("fail-open");

    consoleError.mockRestore();
  });
});
