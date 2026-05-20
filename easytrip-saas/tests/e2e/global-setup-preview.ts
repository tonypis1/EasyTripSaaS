import { vercelProtectionBypassHeaders } from "./helpers/vercel-bypass";

/**
 * Risveglia il deploy Preview Vercel prima degli smoke E2E.
 * Il primo test del run (locale-detection) altrimenti vede spesso la pagina Chromium
 * "This page couldn't load" mentre i test successivi passano (server già caldo).
 */
export default async function globalSetup(): Promise<void> {
  const baseURL = process.env.E2E_BASE_URL?.replace(/\/$/, "");
  if (!baseURL || !/vercel\.app/i.test(baseURL)) return;

  const headers = vercelProtectionBypassHeaders();
  if (Object.keys(headers).length === 0) return;

  const paths = [
    { path: "/", acceptLanguage: "it-IT,it;q=0.9" },
    { path: "/it", acceptLanguage: "it-IT,it;q=0.9" },
    { path: "/en", acceptLanguage: "en-US,en;q=0.9" },
    { path: "/de", acceptLanguage: "de-DE,de;q=0.9" },
  ] as const;

  for (const { path, acceptLanguage } of paths) {
    try {
      const res = await fetch(`${baseURL}${path}`, {
        headers: {
          ...headers,
          "Accept-Language": acceptLanguage,
        },
        redirect: "follow",
      });
      if (!res.ok) {
        console.warn(`[e2e warmup] ${path} → HTTP ${res.status}`);
      }
    } catch (err) {
      console.warn(`[e2e warmup] ${path} failed:`, err);
    }
    await new Promise((r) => setTimeout(r, 500));
  }
}
