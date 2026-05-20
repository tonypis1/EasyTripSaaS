import { vercelProtectionBypassHeaders } from "./helpers/vercel-bypass";

/**
 * Risveglia il deploy Preview Vercel prima degli smoke E2E.
 * Usa `redirect: "manual"`: con `follow` next-intl + bypass Vercel creano loop
 * ("redirect count exceeded" in Node fetch).
 */
export default async function globalSetup(): Promise<void> {
  const baseURL = process.env.E2E_BASE_URL?.replace(/\/$/, "");
  if (!baseURL || !/vercel\.app/i.test(baseURL)) return;

  const headers = vercelProtectionBypassHeaders();
  if (Object.keys(headers).length === 0) return;

  try {
    const res = await fetch(`${baseURL}/it`, {
      headers: {
        ...headers,
        "Accept-Language": "it-IT,it;q=0.9",
      },
      redirect: "manual",
    });
    if (res.status >= 400) {
      console.warn(`[e2e warmup] /it → HTTP ${res.status}`);
    }
  } catch (err) {
    console.warn("[e2e warmup] /it failed:", err);
  }
}
