import { describe, expect, it } from "vitest";
import { AI_LOCATION_DECIMALS, roundCoordForAi } from "./geo-privacy";

describe("roundCoordForAi", () => {
  it("riduce la precisione a 3 decimali", () => {
    expect(roundCoordForAi(41.902783)).toBe(41.903);
    expect(roundCoordForAi(12.496366)).toBe(12.496);
  });

  it("allinea AI_LOCATION_DECIMALS", () => {
    expect(AI_LOCATION_DECIMALS).toBe(3);
  });
});
