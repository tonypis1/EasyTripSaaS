import { expect, test } from "@playwright/test";

test.describe("@smoke", () => {
  test("home or marketing loads @smoke", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("body")).toBeVisible();
  });
});
