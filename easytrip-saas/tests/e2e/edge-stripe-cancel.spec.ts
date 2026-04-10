import { expect, test } from "@playwright/test";

const authState = process.env.E2E_AUTH_STORAGE_STATE;
const tripId = process.env.E2E_TRIP_ID;

test.describe("Stripe checkout edge cases", () => {
  test.skip(
    !authState || !tripId,
    "Set E2E_AUTH_STORAGE_STATE and E2E_TRIP_ID",
  );

  test.use({ storageState: authState! });

  test("user can leave Stripe checkout via browser back", async ({ page }) => {
    await page.goto(`/app/trips/${tripId}`);

    const payBtn = page.getByRole("button", { name: /vai al pagamento/i });
    const visible = await payBtn.isVisible().catch(() => false);
    if (!visible) {
      test.skip(true, "No checkout button — trip may not need payment");
      return;
    }

    await Promise.all([
      page.waitForURL(/checkout\.stripe\.com|stripe/i),
      payBtn.click(),
    ]);

    await page.goBack();
    await expect(page).toHaveURL(new RegExp(`/app/trips/${tripId}`));
  });
});
