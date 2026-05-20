/** Header per bypassare Vercel Deployment Protection (job CI `e2e-preview`). */
export function vercelProtectionBypassHeaders(): Record<string, string> {
  const secret = process.env.VERCEL_AUTOMATION_BYPASS_SECRET?.trim();
  if (!secret) return {};
  return {
    "x-vercel-protection-bypass": secret,
    "x-vercel-set-bypass-cookie": "true",
  };
}

/** Unisce Accept-Language con il bypass Vercel (non sovrascrivere solo Accept-Language in newContext). */
export function localeContextHeaders(
  acceptLanguage: string,
): Record<string, string> {
  return {
    "Accept-Language": acceptLanguage,
    ...vercelProtectionBypassHeaders(),
  };
}
