import { describe, expect, it } from "vitest";
import {
  addCalendarDaysUtc,
  dayOfWeekItalian,
  inclusiveCalendarDaysBetweenUtc,
  toDateOnlyIsoUtc,
} from "@/lib/calendar-date";

describe("calendar-date", () => {
  it("toDateOnlyIsoUtc formats UTC date", () => {
    const d = new Date(Date.UTC(2026, 2, 30));
    expect(toDateOnlyIsoUtc(d)).toBe("2026-03-30");
  });

  it("inclusiveCalendarDaysBetweenUtc counts inclusive days", () => {
    const a = new Date(Date.UTC(2026, 2, 24));
    const b = new Date(Date.UTC(2026, 2, 27));
    expect(inclusiveCalendarDaysBetweenUtc(a, b)).toBe(4);
  });

  it("inclusiveCalendarDaysBetweenUtc same day is 1", () => {
    const d = new Date(Date.UTC(2026, 0, 1));
    expect(inclusiveCalendarDaysBetweenUtc(d, d)).toBe(1);
  });

  it("addCalendarDaysUtc crosses month boundary", () => {
    const start = new Date(Date.UTC(2026, 0, 30));
    const next = addCalendarDaysUtc(start, 5);
    expect(toDateOnlyIsoUtc(next)).toBe("2026-02-04");
  });

  it("dayOfWeekItalian returns Italian weekday (UTC)", () => {
    const mon = new Date(Date.UTC(2026, 3, 6));
    expect(dayOfWeekItalian(mon)).toBe("lunedì");
  });
});
