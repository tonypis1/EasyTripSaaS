import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

/**
 * Rate limiting opzionale via Upstash Redis.
 * Senza `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` le funzioni `enforce*` non applicano limiti
 * (utile in sviluppo locale senza Redis).
 *
 * @see architecture-docs/12_DEPLOYMENT.md
 */

const redis =
  process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
    ? new Redis({
        url: process.env.UPSTASH_REDIS_REST_URL,
        token: process.env.UPSTASH_REDIS_REST_TOKEN,
      })
    : null;

function createLimiter(
  prefix: string,
  requests: number,
  window: `${number} ${"s" | "m" | "h" | "d"}`,
): Ratelimit | null {
  if (!redis) return null;
  return new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(requests, window),
    prefix: `easytrip:${prefix}`,
    analytics: true,
  });
}

/** GET /api/join/[token] — mitiga enumerazione token */
export const joinGetLimiter = createLimiter("join_get", 60, "1 m");

/** POST /api/join/[token] */
export const joinPostLimiter = createLimiter("join_post", 30, "1 m");

export const referralTrackLimiter = createLimiter("referral_track", 30, "1 m");

/** Generazione / AI-heavy (per utente autenticato) */
export const tripGenerateLimiter = createLimiter("trip_generate", 15, "1 m");
export const liveSuggestLimiter = createLimiter("live_suggest", 30, "1 m");
export const replaceSlotLimiter = createLimiter("replace_slot", 40, "1 m");

export function getClientIp(req: Request): string {
  const xf = req.headers.get("x-forwarded-for");
  if (xf) {
    const first = xf.split(",")[0]?.trim();
    if (first) return first;
  }
  const realIp = req.headers.get("x-real-ip");
  if (realIp) return realIp.trim();
  return "unknown";
}

/**
 * @returns `Response` 429 se limitato, altrimenti `null` (procedi).
 */
export async function enforceRateLimit(
  limiter: Ratelimit | null,
  key: string,
): Promise<Response | null> {
  if (!limiter) return null;

  const { success, limit, remaining, reset } = await limiter.limit(key);
  if (success) return null;

  const retryAfterSec = Math.max(1, Math.ceil((reset - Date.now()) / 1000));

  return Response.json(
    {
      ok: false,
      error: {
        message: "Troppe richieste. Riprova tra poco.",
        code: "RATE_LIMITED",
        limit,
        remaining,
      },
    },
    {
      status: 429,
      headers: {
        "Retry-After": String(retryAfterSec),
        "X-RateLimit-Limit": String(limit),
        "X-RateLimit-Remaining": String(remaining),
      },
    },
  );
}
