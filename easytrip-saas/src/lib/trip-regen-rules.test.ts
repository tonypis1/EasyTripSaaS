import { describe, expect, it } from "vitest";
import {
  canCreateNewVersion,
  isFreeRegeneration,
  isPaidRegeneration,
  nextVersionNum,
} from "./trip-regen-rules";

describe("trip-regen-rules", () => {
  it("nextVersionNum incrementa da regenCount", () => {
    expect(nextVersionNum(0)).toBe(1);
    expect(nextVersionNum(3)).toBe(4);
  });

  it("isFreeRegeneration per prossima versione 2-4", () => {
    expect(isFreeRegeneration(0)).toBe(false); // next 1 (prima versione / acquisto)
    expect(isFreeRegeneration(1)).toBe(true); // next 2
    expect(isFreeRegeneration(2)).toBe(true); // next 3
    expect(isFreeRegeneration(3)).toBe(true); // next 4
    expect(isFreeRegeneration(4)).toBe(false); // next 5 (a pagamento)
  });

  it("isPaidRegeneration per versioni 5-7", () => {
    expect(isPaidRegeneration(4)).toBe(true); // next 5
    expect(isPaidRegeneration(6)).toBe(true); // next 7
  });

  it("canCreateNewVersion fino a 7", () => {
    expect(canCreateNewVersion(6)).toBe(true); // next 7
    expect(canCreateNewVersion(7)).toBe(false); // next 8
  });
});
