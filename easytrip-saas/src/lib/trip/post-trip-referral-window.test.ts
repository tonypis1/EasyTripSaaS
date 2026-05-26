import { describe, expect, it } from "vitest";
import {
  getPostTripReferralWindow,
  isTripEnded,
} from "@/lib/trip/post-trip-referral-window";

const MS_HOUR = 60 * 60 * 1000;

describe("post-trip-referral-window", () => {
  const end = new Date(Date.UTC(2026, 5, 10, 18, 0, 0));

  it("isTripEnded is false before endDate", () => {
    const before = new Date(end.getTime() - MS_HOUR);
    expect(isTripEnded(end, before)).toBe(false);
  });

  it("isTripEnded is true at endDate", () => {
    expect(isTripEnded(end, end)).toBe(true);
  });

  it("getPostTripReferralWindow inactive before trip ends", () => {
    const before = new Date(end.getTime() - MS_HOUR);
    const w = getPostTripReferralWindow(end, before);
    expect(w.active).toBe(false);
    expect(w.expiresAt).toBeNull();
  });

  it("getPostTripReferralWindow active just after end", () => {
    const after = new Date(end.getTime() + MS_HOUR);
    const w = getPostTripReferralWindow(end, after);
    expect(w.active).toBe(true);
    expect(w.expiresAt?.getTime()).toBe(end.getTime() + 72 * MS_HOUR);
  });

  it("getPostTripReferralWindow inactive after 72h", () => {
    const late = new Date(end.getTime() + 73 * MS_HOUR);
    const w = getPostTripReferralWindow(end, late);
    expect(w.active).toBe(false);
    expect(w.expiresAt).toBeNull();
  });

  it("getPostTripReferralWindow inactive at exactly 72h boundary", () => {
    const boundary = new Date(end.getTime() + 72 * MS_HOUR);
    const w = getPostTripReferralWindow(end, boundary);
    expect(w.active).toBe(false);
  });

  it("handles ISO string endDate", () => {
    const iso = "2026-06-10T18:00:00.000Z";
    const after = new Date(Date.UTC(2026, 5, 10, 19, 0, 0));
    expect(getPostTripReferralWindow(iso, after).active).toBe(true);
  });

  it("returns inactive for null endDate", () => {
    expect(getPostTripReferralWindow(null).active).toBe(false);
    expect(isTripEnded(null)).toBe(false);
  });
});
