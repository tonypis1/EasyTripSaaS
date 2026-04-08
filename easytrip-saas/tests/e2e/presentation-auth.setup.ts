import { clerk, clerkSetup } from "@clerk/testing/playwright";
import { expect, test as setup } from "@playwright/test";
import * as fs from "fs";
import * as path from "path";

const authFile = path.join(process.cwd(), "e2e", ".auth", "user.json");

/**
 * Crea `e2e/.auth/user.json` per `screenshots:presentation`.
 * Usa @clerk/testing (Testing Token): niente flusso Google nel browser automatizzato.
 */
setup("clerk session → e2e/.auth/user.json", async ({ page }) => {
  const email = process.env.E2E_CLERK_USER_EMAIL?.trim();
  if (!email) {
    throw new Error(
      "Imposta E2E_CLERK_USER_EMAIL (email dell'utente Clerk in istanza dev/test).",
    );
  }

  await clerkSetup();

  await page.goto("/", { waitUntil: "domcontentloaded" });

  const password = process.env.E2E_CLERK_USER_PASSWORD;
  if (password) {
    await clerk.signIn({
      page,
      signInParams: {
        strategy: "password",
        identifier: email,
        password,
      },
    });
  } else {
    await clerk.signIn({ page, emailAddress: email });
  }

  await page.goto("/app", { waitUntil: "domcontentloaded" });
  await expect(
    page.getByRole("heading", { name: /la tua dashboard/i }),
  ).toBeVisible({ timeout: 30_000 });

  fs.mkdirSync(path.dirname(authFile), { recursive: true });
  await page.context().storageState({ path: authFile });
});
