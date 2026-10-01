import { expect, test } from "@playwright/test";
import { isVercelPreviewBaseUrl } from "./helpers/vercel-bypass";

/** Richieste verso PostHog (cloud UE/US o un host configurato). */
const POSTHOG_REQUEST = /posthog\.com|\/(?:e|i\/v0\/e|decide|flags)\/?\?/;

test.describe("@smoke informativa privacy", () => {
  test("/it/privacy e /en/privacy si caricano con il titolo @smoke", async ({
    page,
  }) => {
    await page.goto("/it/privacy");
    await expect(
      page.getByRole("heading", { level: 1, name: "Informativa privacy" }),
    ).toBeVisible();
    await expect(page.locator("#cookie")).toBeVisible();

    await page.goto("/en/privacy");
    await expect(
      page.getByRole("heading", { level: 1, name: "Privacy policy" }),
    ).toBeVisible();
  });
});

test.describe("@smoke banner cookie", () => {
  // Il banner dipende dalla chiave PostHog del deploy: lo verifichiamo sul
  // server locale (chiave segnaposto in playwright.config.ts).
  test.skip(
    isVercelPreviewBaseUrl(),
    "Il banner dipende dalla configurazione PostHog del deploy",
  );

  test("prima visita: banner visibile e nessuna richiesta a PostHog @smoke", async ({
    page,
  }) => {
    const posthogRequests: string[] = [];
    page.on("request", (req) => {
      if (POSTHOG_REQUEST.test(req.url())) posthogRequests.push(req.url());
    });

    await page.goto("/it");
    const banner = page.getByTestId("cookie-banner");
    await expect(banner).toBeVisible();
    await expect(page.getByTestId("cookie-accept")).toBeVisible();
    await expect(page.getByTestId("cookie-reject")).toBeVisible();

    await page.waitForLoadState("networkidle");
    expect(posthogRequests).toEqual([]);
  });

  test("Rifiuta: il banner sparisce e non ricompare dopo il reload; il footer lo riapre @smoke", async ({
    page,
  }) => {
    await page.goto("/it");
    await page.getByTestId("cookie-reject").click();
    await expect(page.getByTestId("cookie-banner")).toBeHidden();

    await page.reload();
    await expect(page.locator("body")).toBeVisible();
    await expect(page.getByTestId("cookie-banner")).toBeHidden();

    await page.getByTestId("cookie-preferences").first().click();
    await expect(page.getByTestId("cookie-banner")).toBeVisible();
  });

  test("Accetta: il banner sparisce e la scelta resta salvata @smoke", async ({
    page,
  }) => {
    // Con la chiave segnaposto non deve partire nessun invio reale.
    await page.route(POSTHOG_REQUEST, (route) => route.abort());

    await page.goto("/it");
    await page.getByTestId("cookie-accept").click();
    await expect(page.getByTestId("cookie-banner")).toBeHidden();

    const stored = await page.evaluate(() =>
      window.localStorage.getItem("easytrip_analytics_consent_v1"),
    );
    expect(JSON.parse(stored ?? "{}")).toMatchObject({ value: "granted" });

    await page.reload();
    await expect(page.getByTestId("cookie-banner")).toBeHidden();
  });
});
