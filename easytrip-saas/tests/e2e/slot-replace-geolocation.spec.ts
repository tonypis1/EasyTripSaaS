import { expect, test } from "@playwright/test";

const authState = process.env.E2E_AUTH_STORAGE_STATE;
const tripId = process.env.E2E_TRIP_ID;

test.describe("slot replace with geolocation", () => {
  test.skip(!authState || !tripId, "Set E2E_AUTH_STORAGE_STATE and E2E_TRIP_ID");

  test.use({ storageState: authState! });

  test.beforeEach(async ({ context, baseURL }) => {
    if (!baseURL) return;
    await context.grantPermissions(["geolocation"], { origin: baseURL });
    await context.setGeolocation({ latitude: 41.9028, longitude: 12.4964 });
  });

  test("trip detail loads with geo permission", async ({ page }) => {
    await page.goto(`/app/trips/${tripId}`);
    await expect(page.locator("body")).toBeVisible();
  });
});
