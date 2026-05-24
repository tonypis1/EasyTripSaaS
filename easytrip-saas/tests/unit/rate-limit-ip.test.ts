import { describe, expect, it } from "vitest";
import { getClientIp } from "@/lib/rate-limit";

describe("getClientIp", () => {
  it("preferisce il primo IP in x-forwarded-for", () => {
    const req = new Request("http://127.0.0.1/api", {
      headers: { "x-forwarded-for": "203.0.113.1, 10.0.0.1" },
    });
    expect(getClientIp(req)).toBe("203.0.113.1");
  });

  it("usa x-real-ip se assente x-forwarded-for", () => {
    const req = new Request("http://127.0.0.1/api", {
      headers: { "x-real-ip": "198.51.100.2" },
    });
    expect(getClientIp(req)).toBe("198.51.100.2");
  });

  it("ritorna unknown senza header", () => {
    expect(getClientIp(new Request("http://127.0.0.1"))).toBe("unknown");
  });
});
