import { expect, test } from "@playwright/test";

const authState = process.env.E2E_AUTH_STORAGE_STATE;
const tripId = process.env.E2E_TRIP_ID;

test.describe("carousel version pills (visual)", () => {
  test.skip(!authState || !tripId, "Set E2E_AUTH_STORAGE_STATE and E2E_TRIP_ID");

  test.use({ storageState: authState! });

  test("version pills layout snapshot @visual", async ({ page }) => {
    await page.goto(`/app/trips/${tripId}`);

    const pills = page.getByTestId("trip-version-pills");
    const visible = await pills.isVisible().catch(() => false);
    if (!visible) {
      test.skip(true, "Trip has no versions yet — cannot snapshot carousel");
      return;
    }

    await expect(pills).toBeVisible();
    const box = await pills.boundingBox();
    expect(box).toBeTruthy();
    expect(box!.width).toBeGreaterThan(40);

    if (!process.env.CI) {
      await expect(pills).toHaveScreenshot("version-pills.png", {
        maxDiffPixelRatio: 0.02,
        animations: "disabled",
      });
    }
  });
});
