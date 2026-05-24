/**
 * Affiliate link generators for EasyTrip.
 *
 * All IDs are public (embedded in visible URLs) — NEXT_PUBLIC_ prefix.
 * If an affiliate ID is not configured, the corresponding function returns null
 * and the UI gracefully hides that link.
 */

const BOOKING_AID = process.env.NEXT_PUBLIC_BOOKING_AID ?? "";
const GYG_PARTNER_ID = process.env.NEXT_PUBLIC_GYG_PARTNER_ID ?? "";
const THEFORK_PARTNER_ID = process.env.NEXT_PUBLIC_THEFORK_PARTNER_ID ?? "";
const VIATOR_PID = process.env.NEXT_PUBLIC_VIATOR_PID ?? "";
const AMAZON_TAG = process.env.NEXT_PUBLIC_AMAZON_TAG ?? "";

export function bookingSearchUrl(params: {
  destination: string;
  checkin?: string;
  checkout?: string;
}): string | null {
  if (!BOOKING_AID) return null;
  const u = new URL("https://www.booking.com/searchresults.html");
  u.searchParams.set("aid", BOOKING_AID);
  u.searchParams.set("ss", params.destination);
  u.searchParams.set("lang", "it");
  if (params.checkin) u.searchParams.set("checkin", params.checkin);
  if (params.checkout) u.searchParams.set("checkout", params.checkout);
  return u.toString();
}

export function getYourGuideUrl(
  query: string,
  destination: string,
): string | null {
  if (!GYG_PARTNER_ID) return null;
  const u = new URL("https://www.getyourguide.com/s/");
  u.searchParams.set("q", `${query} ${destination}`);
  u.searchParams.set("partner_id", GYG_PARTNER_ID);
  return u.toString();
}

export function theForkUrl(
  restaurantName: string,
  city: string,
): string | null {
  if (!THEFORK_PARTNER_ID) return null;
  const u = new URL("https://www.thefork.it/ricerca/risultato");
  u.searchParams.set("queryText", `${restaurantName} ${city}`);
  u.searchParams.set("cc", THEFORK_PARTNER_ID);
  return u.toString();
}

export function viatorUrl(query: string, destination: string): string | null {
  if (!VIATOR_PID) return null;
  const u = new URL("https://www.viator.com/searchResults/all");
  u.searchParams.set("text", `${query} ${destination}`);
  u.searchParams.set("pid", VIATOR_PID);
  return u.toString();
}

export function amazonSearchUrl(query: string): string | null {
  if (!AMAZON_TAG) return null;
  const u = new URL("https://www.amazon.it/s");
  u.searchParams.set("k", query);
  u.searchParams.set("tag", AMAZON_TAG);
  return u.toString();
}

export function hasAnyAffiliate(): boolean {
  return Boolean(
    BOOKING_AID || GYG_PARTNER_ID || THEFORK_PARTNER_ID || VIATOR_PID,
  );
}

export function hasBooking(): boolean {
  return Boolean(BOOKING_AID);
}

export function hasGetYourGuide(): boolean {
  return Boolean(GYG_PARTNER_ID);
}

export function hasTheFork(): boolean {
  return Boolean(THEFORK_PARTNER_ID);
}

export function hasViator(): boolean {
  return Boolean(VIATOR_PID);
}

export type AffiliatePartner =
  | "booking"
  | "gyg"
  | "thefork"
  | "viator"
  | "amazon";

export const PARTNER_LABELS: Record<
  AffiliatePartner,
  { name: string; color: string }
> = {
  booking: {
    name: "Booking.com",
    color: "text-blue-400 border-blue-400/30 bg-blue-500/10",
  },
  gyg: {
    name: "GetYourGuide",
    color: "text-orange-400 border-orange-400/30 bg-orange-500/10",
  },
  thefork: {
    name: "TheFork",
    color: "text-green-400 border-green-400/30 bg-green-500/10",
  },
  viator: {
    name: "Viator",
    color: "text-teal-400 border-teal-400/30 bg-teal-500/10",
  },
  amazon: {
    name: "Amazon",
    color: "text-amber-400 border-amber-400/30 bg-amber-500/10",
  },
};
