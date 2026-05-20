import { expect, test } from "@playwright/test";

test("signup guard redirects anonymous user @smoke", async ({ page }) => {
  await page.goto("/it/app/trips", { waitUntil: "domcontentloaded" });

  // Clerk protegge /app: senza sessione si viene reindirizzati verso hosted sign-in.
  // Non asseriamo su testi/pulsanti del form: con dev keys in CI compare spesso
  // "Rate exceeded." e la UI Clerk non mostra CTA, ma il redirect prova la guard.
  await expect(page).toHaveURL(
    /sign-in|sign-up|clerk\.accounts|accounts\.clerk|clerk\.com/i,
    { timeout: 25_000 },
  );
});
