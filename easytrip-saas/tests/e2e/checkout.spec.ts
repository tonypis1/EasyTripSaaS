import { expect, test } from "@playwright/test";

const authState = process.env.E2E_AUTH_STORAGE_STATE;
const tripId = process.env.E2E_TRIP_ID;

test.describe("checkout flow", () => {
  test.skip(
    !authState || !tripId,
    "Set E2E_AUTH_STORAGE_STATE and E2E_TRIP_ID",
  );

  test.use({ storageState: authState! });

  test("user can start checkout from trip detail", async ({ page }) => {
    await page.goto(`/app/trips/${tripId}`);

    await expect(
      page.getByRole("button", { name: /vai al pagamento/i }),
    ).toBeVisible();

    await Promise.all([
      page.waitForURL(/checkout\.stripe\.com|stripe/i),
      page.getByRole("button", { name: /vai al pagamento/i }).click(),
    ]);

    await expect(page).toHaveURL(/checkout\.stripe\.com|stripe/i);
  });
});
