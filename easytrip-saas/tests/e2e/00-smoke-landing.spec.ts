import { expect, test } from "@playwright/test";

test.describe("@smoke", () => {
  test("home redirects to default locale @smoke", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("body")).toBeVisible();
    await expect(page).toHaveURL(/\/(it|en|es|fr|de)(\/|$)/);
  });

  test("italian home loads @smoke", async ({ page }) => {
    await page.goto("/it");
    await expect(page.locator("body")).toBeVisible();
    await expect(page).toHaveURL(/\/it(\/|$)/);
  });

  test("english home loads @smoke", async ({ page }) => {
    await page.goto("/en");
    await expect(page.locator("body")).toBeVisible();
    await expect(page).toHaveURL(/\/en(\/|$)/);
  });
});
