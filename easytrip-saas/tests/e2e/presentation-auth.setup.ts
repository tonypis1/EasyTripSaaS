import { clerk, clerkSetup } from "@clerk/testing/playwright";
import { expect, test as setup, type Page } from "@playwright/test";
import * as fs from "fs";
import * as path from "path";

const authFile = path.join(process.cwd(), "e2e", ".auth", "user.json");

function pathnameIsApp(url: string | URL): boolean {
  try {
    const u = typeof url === "string" ? new URL(url) : url;
    const p = u.pathname.replace(/\/$/, "") || "/";
    return p === "/app" || p.startsWith("/app/");
  } catch {
    return false;
  }
}

/** Evita NS_BINDING_ABORTED (Firefox) se goto(/app) compete con un redirect Clerk già in corso. */
async function ensureOnAppDashboard(page: Page) {
  try {
    await page.waitForURL((u) => pathnameIsApp(u), { timeout: 25_000 });
    return;
  } catch {
    // Restiamo fuori da /app: naviga esplicitamente, con retry su navigazione abortita.
  }

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      await page.goto("/app", { waitUntil: "load", timeout: 90_000 });
      return;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (
        (msg.includes("NS_BINDING_ABORTED") || msg.includes("net::ERR_ABORTED")) &&
        pathnameIsApp(page.url())
      ) {
        return;
      }
      if (
        (msg.includes("NS_BINDING_ABORTED") || msg.includes("net::ERR_ABORTED")) &&
        attempt < 2
      ) {
        await page.waitForTimeout(1500);
        continue;
      }
      throw e;
    }
  }
}

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
  try {
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
  } catch (e) {
    const detail = e instanceof Error ? e.message : String(e);
    throw new Error(
      [
        "Sign-in Clerk per E2E fallito.",
        "Verifica: (1) in Clerk Dashboard → Users esiste un utente con questa email nello stesso progetto delle chiavi in .env;",
        "(2) chiavi dev/test (pk_test_ / sk_test_) coerenti;",
        "(3) se usi E2E_CLERK_USER_PASSWORD, l'account deve avere password (non solo OAuth); altrimenti rimuovi la password e usa il flusso email-only;",
        "(4) riavvia `npm run dev` dopo aver aggiunto 127.0.0.1 in next.config allowedDevOrigins se vedi errori su /_next.",
        `Errore originale: ${detail}`,
      ].join(" "),
    );
  }

  await ensureOnAppDashboard(page);
  await expect(
    page.getByRole("heading", { name: /la tua dashboard/i }),
  ).toBeVisible({ timeout: 30_000 });

  fs.mkdirSync(path.dirname(authFile), { recursive: true });
  await page.context().storageState({ path: authFile });
});
