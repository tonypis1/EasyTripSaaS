import { expect, test } from "@playwright/test";
import {
  enterHomeViaLocaleDetection,
  expectGuestHomeInLocale,
  gotoHomePath,
  localeHomeAssertionTimeout,
} from "./helpers/locale-home";
import { localeBrowserContextOptions } from "./helpers/locale-context";

/**
 * E2E: rilevamento automatico della lingua del browser.
 *
 * next-intl legge l'header `Accept-Language` al primo ingresso su `/` e redireziona
 * al prefisso locale corretto. Una volta scelto un locale, viene salvato nel cookie
 * `NEXT_LOCALE` e quel cookie prevale sulle visite successive.
 *
 * I marker testuali sono presi da `messages/<locale>.json` alla chiave
 * `home.hero.titleLine1`, che è una stringa univoca per ogni lingua.
 */

const HERO_MARKERS: Record<"it" | "en" | "es" | "fr" | "de", string> = {
  it: "Itinerari AI per viaggi brevi.",
  en: "AI itineraries for short trips.",
  es: "Itinerarios con IA para viajes cortos.",
  fr: "Itinéraires IA pour voyages courts.",
  de: "KI-Reiserouten für Kurztrips.",
};

test.describe("@smoke locale auto-detection", () => {
  // Stesso file: in parallelo ogni test apre un browser context e colpisce `npm run dev`
  // in modo pesante. Serial + timeout 60s riduce timeout flakies su newPage/goto sotto carico.
  test.describe.configure({ mode: "serial" });
  test.setTimeout(60_000);

  test("tedesco → redirect a /de e pagina in tedesco", async ({ browser }) => {
    const context = await browser.newContext(
      localeBrowserContextOptions("de-DE,de;q=0.9,en;q=0.5"),
    );
    const page = await context.newPage();
    await enterHomeViaLocaleDetection(page, /\/de(\/|$)/, "/de");
    await expectGuestHomeInLocale(page, HERO_MARKERS.de, "de");

    await context.close();
  });

  test("inglese (en-US) → redirect a /en e pagina in inglese", async ({
    browser,
  }) => {
    const context = await browser.newContext(
      localeBrowserContextOptions("en-US,en;q=0.9"),
    );
    const page = await context.newPage();
    await enterHomeViaLocaleDetection(page, /\/en(\/|$)/, "/en");
    await expectGuestHomeInLocale(page, HERO_MARKERS.en, "en");

    await context.close();
  });

  test("francese → redirect a /fr e pagina in francese", async ({
    browser,
  }) => {
    const context = await browser.newContext(
      localeBrowserContextOptions("fr-FR,fr;q=0.9,en;q=0.4"),
    );
    const page = await context.newPage();
    await enterHomeViaLocaleDetection(page, /\/fr(\/|$)/, "/fr");
    await expectGuestHomeInLocale(page, HERO_MARKERS.fr, "fr");

    await context.close();
  });

  test("spagnolo → redirect a /es e pagina in spagnolo", async ({
    browser,
  }) => {
    const context = await browser.newContext(
      localeBrowserContextOptions("es-ES,es;q=0.9,en;q=0.4"),
    );
    const page = await context.newPage();
    await enterHomeViaLocaleDetection(page, /\/es(\/|$)/, "/es");
    await expectGuestHomeInLocale(page, HERO_MARKERS.es, "es");

    await context.close();
  });

  test("lingua non supportata (ja) → fallback al defaultLocale (it)", async ({
    browser,
  }) => {
    const context = await browser.newContext(
      localeBrowserContextOptions("ja-JP,ja;q=0.9"),
    );
    const page = await context.newPage();
    await enterHomeViaLocaleDetection(page, /\/it(\/|$)/, "/it");
    await expectGuestHomeInLocale(page, HERO_MARKERS.it, "it");

    await context.close();
  });

  test("cookie NEXT_LOCALE prevale sull'Accept-Language del browser", async ({
    browser,
    baseURL,
  }) => {
    // Il browser dice "de" ma il cookie dice "en": deve vincere il cookie.
    const url = new URL(baseURL ?? "http://127.0.0.1:3000");
    const context = await browser.newContext(
      localeBrowserContextOptions("de-DE,de;q=0.9"),
    );

    await context.addCookies([
      {
        name: "NEXT_LOCALE",
        value: "en",
        domain: url.hostname,
        path: "/",
        httpOnly: false,
        secure: url.protocol === "https:",
        sameSite: "Lax",
      },
    ]);

    const page = await context.newPage();
    await enterHomeViaLocaleDetection(page, /\/en(\/|$)/, "/en");
    await expectGuestHomeInLocale(page, HERO_MARKERS.en, "en");

    await context.close();
  });
});

test.describe("LocaleSwitcher", () => {
  test.setTimeout(60_000);

  test("cambiare lingua aggiorna URL, DOM e scrive cookie NEXT_LOCALE", async ({
    browser,
  }) => {
    const context = await browser.newContext(
      localeBrowserContextOptions("it-IT,it;q=0.9"),
    );
    const page = await context.newPage();
    await enterHomeViaLocaleDetection(page, /\/it(\/|$)/, "/it");
    await expectGuestHomeInLocale(page, HERO_MARKERS.it, "it");

    // Il LocaleSwitcher è un menu custom (bottone con aria-label tradotta) +
    // listbox. In italiano l’etichetta è "Lingua".
    const trigger = page.getByLabel("Lingua").first();
    await expect(trigger).toBeVisible();
    await trigger.click();
    await expect(page.getByRole("listbox")).toBeVisible();
    // `window.location.assign` = navigazione piena: await insieme a waitForURL evita
    // asserzioni sul documento vecchio o su uno stato intermedio sotto carico in dev.
    const navTimeout = 30_000;
    await Promise.all([
      page.waitForURL(/\/en(\/|$)/, { timeout: navTimeout }),
      page.getByRole("option", { name: /Inglese/i }).click(),
    ]);
    await page.waitForLoadState("domcontentloaded");
    await expect(page.locator("html")).toHaveAttribute("lang", "en", {
      timeout: navTimeout,
    });
    // toContainText sull’h1 è più robusto di getByText su una stringa piena (nodi sotto <br/>, ecc.).
    await expect(page.getByRole("heading", { level: 1 })).toContainText(
      /AI itineraries for short trips/i,
      { timeout: navTimeout },
    );

    const cookies = await context.cookies();
    const localeCookie = cookies.find((c) => c.name === "NEXT_LOCALE");
    expect(localeCookie?.value).toBe("en");

    await context.close();
  });
});
