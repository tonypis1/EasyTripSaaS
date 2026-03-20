import { expect, test } from "@playwright/test";

test("signup guard redirects anonymous user", async ({ page }) => {
  await page.goto("/app/trips");

  // Clerk protegge /app: ci aspettiamo redirect verso signin/signup
  await expect(page).toHaveURL(/sign-in|sign-up|clerk/i);

  // Locator user-facing: evitiamo selector fragili
  const hasAuthCta = await page
    .getByRole("button", { name: /sign in|continue|accedi|entra/i })
    .first()
    .isVisible()
    .catch(() => false);

  // In alcuni tenant Clerk il bottone puo' essere un link
  if (!hasAuthCta) {
    await expect(
      page.getByRole("link", { name: /sign in|sign up|accedi|registrati/i }).first()
    ).toBeVisible();
  }
});
