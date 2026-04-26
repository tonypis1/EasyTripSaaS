/**
 * URL delle pagine Account Portal (hosting Clerk) per link diretti.
 * Usati come fallback affidabile quando serve navigare senza dipendere da clerk-js caricato.
 *
 * @see https://clerk.com/docs/guides/account-portal/direct-links (redirect_url)
 */

function trimSlash(s: string): string {
  return s.replace(/\/$/, "");
}

/** Es. https://accounts.tuodominio.com/sign-up */
export function clerkAccountPortalSignUpPageUrl(): string | null {
  const full = process.env.NEXT_PUBLIC_CLERK_SIGN_UP_URL?.trim();
  if (full) return trimSlash(full);
  const origin = process.env.NEXT_PUBLIC_CLERK_ACCOUNT_PORTAL_ORIGIN?.trim();
  if (!origin) return null;
  try {
    const u = new URL(origin);
    if (u.protocol !== "https:") return null;
    return `${trimSlash(u.origin)}/sign-up`;
  } catch {
    return null;
  }
}

/** Es. https://accounts.tuodominio.com/sign-in */
export function clerkAccountPortalSignInPageUrl(): string | null {
  const full = process.env.NEXT_PUBLIC_CLERK_SIGN_IN_URL?.trim();
  if (full) return trimSlash(full);
  const origin = process.env.NEXT_PUBLIC_CLERK_ACCOUNT_PORTAL_ORIGIN?.trim();
  if (!origin) return null;
  try {
    const u = new URL(origin);
    if (u.protocol !== "https:") return null;
    return `${trimSlash(u.origin)}/sign-in`;
  } catch {
    return null;
  }
}

/** Aggiunge `redirect_url` richiesto dal portal per tornare all’app dopo il flusso. */
export function accountPortalUrlWithReturn(
  portalPageBase: string,
  returnAbsoluteUrl: string,
): string {
  const page = new URL(portalPageBase);
  page.searchParams.set("redirect_url", returnAbsoluteUrl);
  return page.toString();
}
