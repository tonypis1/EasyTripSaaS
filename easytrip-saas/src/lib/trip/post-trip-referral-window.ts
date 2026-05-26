/** Finestra promozionale referral dopo la fine del viaggio (72h da endDate). */

const POST_TRIP_REFERRAL_WINDOW_MS = 72 * 60 * 60 * 1000;

export type PostTripReferralWindow = {
  active: boolean;
  expiresAt: Date | null;
};

function parseEndDate(endDate: string | Date | null | undefined): Date | null {
  if (endDate == null) return null;
  const end = typeof endDate === "string" ? new Date(endDate) : endDate;
  if (Number.isNaN(end.getTime())) return null;
  return end;
}

/** Il viaggio è terminato (ora >= fine giorno di endDate, confronto su timestamp). */
export function isTripEnded(
  endDate: string | Date | null | undefined,
  now: Date = new Date(),
): boolean {
  const end = parseEndDate(endDate);
  if (!end) return false;
  return now.getTime() >= end.getTime();
}

/**
 * Finestra referral attiva: da endDate (incluso) fino a endDate + 72h.
 * Indipendente da accessExpiresAt (end + 1 giorno calendario).
 */
export function getPostTripReferralWindow(
  endDate: string | Date | null | undefined,
  now: Date = new Date(),
): PostTripReferralWindow {
  const end = parseEndDate(endDate);
  if (!end) return { active: false, expiresAt: null };

  const expiresAt = new Date(end.getTime() + POST_TRIP_REFERRAL_WINDOW_MS);
  const active =
    now.getTime() >= end.getTime() && now.getTime() < expiresAt.getTime();

  return { active, expiresAt: active ? expiresAt : null };
}
