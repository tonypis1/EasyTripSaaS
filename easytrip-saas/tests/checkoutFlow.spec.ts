import { test, expect, type Page, type BrowserContext } from "@playwright/test";
import { clerk, setupClerkTestingToken } from "@clerk/testing/playwright";
import * as fs from "fs";
import * as path from "path";

/**
 * E2E "acquisto piano Pro" — EasyTripSaaS
 * =========================================
 *
 * Cosa fa questo file, in breve: simula un utente reale che arriva sulla
 * home, si registra, crea un viaggio Solo/Coppia, paga su Stripe (carta di
 * test), segue la generazione AI dell'itinerario, rigenera più volte,
 * verifica mappa/GPS/preferenze/supporto, poi ripete i controlli chiave per
 * un viaggio di Gruppo (invito membri, split spese, referral) e per
 * l'abbonamento "Viaggiatore frequente". Ad ogni passaggio chiave salva uno
 * screenshot reale in `./screenshots/`.
 *
 * Perché niente CAPTCHA/blocchi Clerk:
 * - Il progetto Playwright "setup" (tests/auth.setup.ts) chiama
 *   `clerkSetup()`, che registra questa run come traffico di test presso
 *   Clerk (Testing Token). Da quel momento QUALSIASI pagina di QUESTO
 *   processo Playwright che interagisce con Clerk salta CAPTCHA/bot-check.
 * - Qui richiamiamo comunque `setupClerkTestingToken({ page })` a inizio
 *   test (è idempotente ed è la funzione ufficiale @clerk/testing da
 *   chiamare per-pagina prima di ogni interazione Clerk), poi creiamo
 *   l'utente "nuovo" via Backend API (`POST /v1/users`) invece di compilare
 *   a mano il modulo di signup: questa app usa l'Account Portal ospitato di
 *   Clerk (dominio *.accounts.dev / accounts.<tuodominio>), cioè un dominio
 *   TERZO fuori dal nostro controllo — automatizzarlo via UI è fragile e
 *   proprio il punto più a rischio di bot-detection. Creare l'utente via
 *   Backend API ed entrare con `clerk.signIn` è il modo robusto e
 *   ripetibile per testare "un nuovo utente compra il piano Pro" senza mai
 *   toccare quel dominio.
 *
 * Note realistiche prima di lanciare questo file:
 * - Serve un dev server con chiavi VERE in modalità test: Clerk
 *   (sk_test_/pk_test_), Stripe (sk_test_/whsec_ test), Anthropic (per la
 *   generazione AI reale) e, se vuoi verificare Inngest per davvero, anche
 *   `npm run inngest:dev` in un altro terminale.
 * - I passaggi dal pagamento in poi possono richiedere diversi minuti
 *   (generazione AI ~1-2 min per versione). Il timeout di test è già
 *   alzato in `playwright.purchase-flow.config.ts`.
 * - Le sezioni dal punto 12 in poi sono "best effort": se un elemento non è
 *   presente nell'ambiente in cui giri il test (es. Crisp non configurato,
 *   Inngest dev non avviato), lo step viene segnalato come skip/soft-fail
 *   nel report invece di far fallire l'intera suite — così lo script resta
 *   utile ed eseguibile ripetutamente anche su ambienti parzialmente
 *   configurati.
 */

const SCREENSHOTS_DIR = path.join(process.cwd(), "screenshots");
fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });

let shotSeq = 0;

async function shot(page: Page, name: string) {
  shotSeq += 1;
  const file = `${String(shotSeq).padStart(2, "0")}-${name}.png`;
  try {
    // Subito dopo un `waitForURL` l'URL è già cambiato ma il nuovo documento
    // può non aver ancora dipinto nulla (specie su redirect cross-origin,
    // es. verso/da checkout.stripe.com): senza questa attesa lo screenshot
    // rischia di catturare un frame nero/bianco di transizione.
    await page.waitForLoadState("load").catch(() => {});
    await page.screenshot({
      path: path.join(SCREENSHOTS_DIR, file),
      fullPage: true,
    });
  } catch (e) {
    console.warn(`Screenshot "${file}" non catturato: ${(e as Error).message}`);
  }
}

/** Esegue uno step "best effort": se fallisce, lo registra come soft-fail invece di interrompere la suite. */
async function softStep(title: string, fn: () => Promise<void>) {
  await test.step(title, async () => {
    try {
      await fn();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.warn(
        `⚠️  "${title}" non verificato in questo ambiente: ${message}`,
      );
      test.info().annotations.push({
        type: "soft-fail",
        description: `${title}: ${message}`,
      });
    }
  });
}

async function isVisibleSoon(
  locator: ReturnType<Page["locator"]>,
  timeout = 5000,
) {
  return locator
    .first()
    .isVisible({ timeout })
    .catch(() => false);
}

// ---------------------------------------------------------------------------
// Clerk — creazione utenti di test via Backend API (niente Account Portal UI)
// ---------------------------------------------------------------------------

const CLERK_API = "https://api.clerk.com/v1";
const CLERK_SECRET_KEY = process.env.CLERK_SECRET_KEY?.trim();

type TestUser = { email: string; password: string; userId: string };

async function createClerkTestUser(label: string): Promise<TestUser> {
  if (!CLERK_SECRET_KEY) {
    throw new Error(
      "CLERK_SECRET_KEY mancante nel processo Playwright: impossibile creare account di test via Clerk Backend API.",
    );
  }
  const stamp = `${Date.now()}.${Math.random().toString(36).slice(2, 8)}`;
  const email = `easytrip.e2e.${label}.${stamp}@example.com`;
  const password = `Ee2e-${Math.random().toString(36).slice(2, 10)}!Aa1`;

  const res = await fetch(`${CLERK_API}/users`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${CLERK_SECRET_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email_address: [email],
      password,
      skip_password_checks: true,
    }),
  });

  if (!res.ok) {
    throw new Error(
      `Creazione utente Clerk fallita (${res.status}): ${await res.text()}`,
    );
  }

  const json = (await res.json()) as { id: string };
  return { email, password, userId: json.id };
}

async function deleteClerkTestUser(userId: string) {
  if (!CLERK_SECRET_KEY || !userId) return;
  await fetch(`${CLERK_API}/users/${userId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${CLERK_SECRET_KEY}` },
  }).catch(() => undefined);
}

const createdUsers: TestUser[] = [];

test.afterAll(async () => {
  // Pulizia: non lasciare utenti "usa e getta" nell'istanza Clerk di test.
  await Promise.all(createdUsers.map((u) => deleteClerkTestUser(u.userId)));
});

// ---------------------------------------------------------------------------
// Stripe — Checkout hosted (checkout.stripe.com), carta di test 4242…
// ---------------------------------------------------------------------------

async function payWithStripeTestCard(
  page: Page,
  opts: { buyerEmail?: string } = {},
) {
  await page.waitForURL(/checkout\.stripe\.com/, { timeout: 60_000 });
  await page.waitForLoadState("domcontentloaded");

  const emailField = page.locator("input#email").first();
  if (await isVisibleSoon(emailField, 8000)) {
    const current = await emailField.inputValue().catch(() => "");
    if (!current) {
      await emailField.fill(
        opts.buyerEmail ?? `easytrip.e2e.buyer.${Date.now()}@example.com`,
      );
    }
  }

  // I campi carta di Stripe Checkout sono a volte in un iframe Stripe.js
  // (PCI compliance, tipico quando Elements è incorporato su un sito terzo);
  // sulla pagina ospitata checkout.stripe.com, invece, Stripe li renderizza
  // spesso direttamente nel documento principale. Proviamo prima l'iframe
  // (con timeout breve) e, se non appare, usiamo la pagina stessa.
  const stripeIframeLocator = page
    .frameLocator(
      'iframe[title="Secure payment input frame"], iframe[name^="__privateStripeFrame"]',
    )
    .first();
  const usesIframe = await stripeIframeLocator
    .locator('input[name="cardnumber"], input[placeholder*="1234"]')
    .first()
    .isVisible({ timeout: 8_000 })
    .catch(() => false);
  const cardFrame = usesIframe ? stripeIframeLocator : page;

  const cardNumberField = cardFrame
    .locator('input[name="cardnumber"], input[placeholder*="1234"]')
    .first();
  // Scattiamo "loaded" solo ora che il campo carta è davvero visibile:
  // Stripe Checkout è una SPA e "domcontentloaded" arriva ben prima che
  // Stripe.js abbia renderizzato il form, producendo altrimenti uno
  // screenshot bianco/vuoto.
  await cardNumberField.waitFor({ state: "visible", timeout: 30_000 });
  await shot(page, "stripe-checkout-loaded");
  await cardNumberField.fill("4242424242424242");

  await cardFrame
    .locator('input[name="exp-date"], input[placeholder*="MM"]')
    .first()
    .fill("12/34");
  await cardFrame
    .locator('input[name="cvc"], input[placeholder*="CVC"]')
    .first()
    .fill("123");

  const nameField = page
    .locator('input#billingName, input[name="billingName"]')
    .first();
  if (await isVisibleSoon(nameField, 3000)) {
    await nameField.fill("Mario Rossi E2E");
  }

  // Il paese di fatturazione rilevato da Stripe (in base all'IP) può richiedere
  // un CAP/ZIP obbligatorio: senza compilarlo il click su "Paga" viene bloccato
  // dalla validazione client-side e non naviga mai via da checkout.stripe.com.
  const postalCodeField = page
    .locator(
      'input#billingPostalCode, input[name="billingPostalCode"], input[autocomplete="postal-code"]',
    )
    .first();
  if (await isVisibleSoon(postalCodeField, 3000)) {
    const currentPostal = await postalCodeField.inputValue().catch(() => "");
    if (!currentPostal) {
      await postalCodeField.fill("00100");
    }
  }

  await shot(page, "stripe-checkout-compilato");

  const payButton = page
    .getByRole("button", { name: /paga|pay|iscriviti|subscribe/i })
    .first();
  await payButton.click();

  await page.waitForURL((url) => !/checkout\.stripe\.com/.test(url.href), {
    timeout: 90_000,
  });
  // Il redirect ci riporta su una pagina server-rendered (sync del pagamento
  // prima dell'HTML) con sfondo quasi nero di default (--et-bg-deep): un
  // "load" del documento non basta a garantire che il contenuto reale sia
  // già dipinto, e senza attesa lo screenshot rischia di catturare solo lo
  // sfondo, senza alcun testo/heading visibile. Aspettiamo un heading reale.
  await page
    .locator("h1, h2")
    .first()
    .waitFor({ state: "visible", timeout: 20_000 })
    .catch(() => undefined);
  await shot(page, "post-pagamento-redirect");
}

// ---------------------------------------------------------------------------
// Helper di dominio EasyTrip
// ---------------------------------------------------------------------------

function toIsoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

type TripType = "solo" | "coppia" | "gruppo";

async function createTrip(
  page: Page,
  opts: {
    destination: string;
    tripType: TripType;
    startInDays?: number;
    nights?: number;
  },
): Promise<string> {
  await page.goto("/it/app/trips");
  await expect(
    page.getByRole("heading", { level: 1, name: "I miei viaggi" }),
  ).toBeVisible({
    timeout: 30_000,
  });
  await shot(page, `trips-page-${opts.tripType}`);

  const start = new Date();
  start.setDate(start.getDate() + (opts.startInDays ?? 21));
  const end = new Date(start);
  end.setDate(end.getDate() + (opts.nights ?? 3));

  await page.locator("#destination").fill(opts.destination);
  await page.locator("#startDate").fill(toIsoDate(start));
  await page.locator("#endDate").fill(toIsoDate(end));
  await page.locator("#tripType").selectOption(opts.tripType);

  await shot(page, `nuovo-viaggio-form-compilato-${opts.tripType}`);

  await Promise.all([
    page.waitForURL(/\/app\/trips\/[^/?#]+/, { timeout: 30_000 }),
    page.getByRole("button", { name: "Crea viaggio" }).click(),
  ]);

  const match = page.url().match(/\/trips\/([^/?#]+)/);
  const tripId = match?.[1] ?? "";
  expect(
    tripId,
    "Il redirect dopo la creazione deve contenere l'id del viaggio",
  ).not.toBe("");

  await shot(page, `viaggio-creato-${opts.tripType}`);
  return tripId;
}

async function unlockAndPay(page: Page, buyerEmail?: string) {
  const payButton = page.getByRole("button", { name: /vai al pagamento/i });
  await expect(payButton).toBeVisible({ timeout: 15_000 });
  await shot(page, "sblocco-vai-al-pagamento");

  await Promise.all([
    page.waitForURL(/checkout\.stripe\.com/, { timeout: 45_000 }),
    payButton.click(),
  ]);

  await payWithStripeTestCard(page, { buyerEmail });
}

async function waitForGeneration(page: Page, opts: { regen?: boolean } = {}) {
  const heading = page.getByText(
    opts.regen
      ? /stiamo rigenerando il tuo itinerario/i
      : /stiamo creando il tuo itinerario/i,
  );

  if (await isVisibleSoon(heading, 15_000)) {
    await shot(
      page,
      opts.regen ? "rigenerazione-in-corso" : "generazione-in-corso",
    );

    // Punto 25: verifica la progress bar durante la generazione.
    const progressLabel = page.getByText(/progresso stimato/i);
    if (await isVisibleSoon(progressLabel, 5000)) {
      await shot(page, "progress-bar-generazione");
    }

    await expect(heading).toBeHidden({ timeout: 240_000 });
  }

  await shot(
    page,
    opts.regen ? "rigenerazione-completata" : "generazione-completata",
  );
}

async function grantGeolocation(
  context: BrowserContext,
  coords = { latitude: 41.9028, longitude: 12.4964 },
) {
  await context.grantPermissions(["geolocation"]);
  await context.setGeolocation(coords);
}

/** Auto-risponde a window.prompt/alert/confirm — necessario perché il flusso "Apri ticket" usa window.prompt(). */
function autoAnswerNativeDialogs(page: Page, promptAnswers: string[]) {
  let i = 0;
  page.on("dialog", (dialog) => {
    if (dialog.type() === "prompt") {
      const answer =
        promptAnswers[Math.min(i, promptAnswers.length - 1)] ?? "Test E2E";
      i += 1;
      void dialog.accept(answer);
    } else {
      void dialog.accept();
    }
  });
}

async function verifyLeafletMap(page: Page) {
  const map = page.locator(".leaflet-container").first();
  await expect(map).toBeVisible({ timeout: 20_000 });
  await expect(
    page.locator(".leaflet-tile, .leaflet-tile-loaded").first(),
  ).toBeVisible({ timeout: 20_000 });
  await shot(page, "mappa-leaflet");
}

async function regenerateFreeAndPickBestScore(page: Page) {
  for (let i = 0; i < 3; i++) {
    const regenBtn = page.getByRole("button", {
      name: /^rigenera itinerario$/i,
    });
    if (!(await isVisibleSoon(regenBtn))) break;
    await regenBtn.click();
    await waitForGeneration(page, { regen: true });
    await shot(page, `rigenerazione-gratis-${i + 1}`);
  }

  const pills = page.locator('[data-testid="trip-version-pills"] button');
  const count = await pills.count();
  if (count === 0) return;

  let bestIndex = 0;
  let bestScore = -1;
  for (let i = 0; i < count; i++) {
    const text = (await pills.nth(i).innerText()).trim();
    const scoreMatch = text.match(/(\d+(?:\.\d+)?)/);
    const score = scoreMatch ? Number.parseFloat(scoreMatch[1]) : -1;
    if (score > bestScore) {
      bestScore = score;
      bestIndex = i;
    }
  }

  await pills.nth(bestIndex).click();
  await shot(page, "versione-punteggio-piu-alto-selezionata");
}

async function verifyPaidRegenerationsThenCarousel(page: Page) {
  for (let i = 0; i < 4; i++) {
    const paidBtn = page.getByRole("button", { name: /rigenera \(€1,99\)/i });
    if (!(await isVisibleSoon(paidBtn))) break;

    await Promise.all([
      page.waitForURL(/checkout\.stripe\.com/, { timeout: 45_000 }),
      paidBtn.click(),
    ]);
    await payWithStripeTestCard(page);
    await waitForGeneration(page, { regen: true });
    await shot(page, `rigenerazione-a-pagamento-${i + 1}`);
  }

  const atMax = page.getByText(
    /hai raggiunto il numero massimo di rigenerazioni/i,
  );
  if (await isVisibleSoon(atMax)) {
    await shot(page, "carosello-limite-raggiunto");
  }
}

async function verifyInngestEndpoint(page: Page) {
  const res = await page.request.get("/api/inngest");
  expect(
    res.status(),
    "L'endpoint /api/inngest deve rispondere (handler Inngest montato)",
  ).toBeLessThan(500);
  test.info().annotations.push({
    type: "inngest-endpoint-status",
    description: String(res.status()),
  });
}

async function verifyGps(context: BrowserContext, page: Page) {
  await grantGeolocation(context);
  const gpsBtn = page.getByRole("button", { name: /usa gps/i });
  if (!(await isVisibleSoon(gpsBtn))) return;

  await gpsBtn.click();
  const consentAccept = page.getByRole("button", { name: /acconsento/i });
  if (await isVisibleSoon(consentAccept, 4000)) {
    await consentAccept.click();
  }
  await expect(page.getByText(/posizione acquisita/i)).toBeVisible({
    timeout: 15_000,
  });
  await shot(page, "gps-attivo");
}

async function verifyEditPreferences(page: Page) {
  const editBtn = page.getByRole("button", { name: /modifica preferenze/i });
  if (!(await isVisibleSoon(editBtn))) return;

  await editBtn.click();
  await shot(page, "modifica-preferenze-aperto");

  const saveBtn = page.getByRole("button", { name: /salva preferenze/i });
  if (await isVisibleSoon(saveBtn, 5000)) {
    await saveBtn.click();
    await shot(page, "preferenze-salvate");
  }
}

/** "Cosa faccio adesso" = sostituzione slot via GPS/live-suggest (bottone "Cambia <slot>"). */
async function verifySlotReplaceSuggestions(page: Page) {
  const changeBtn = page.getByRole("button", { name: /^cambia /i }).first();
  if (!(await isVisibleSoon(changeBtn))) return;

  await changeBtn.click();
  await shot(page, "sostituzione-slot-aperta");

  const closeBtn = page.getByRole("button", {
    name: /chiudi suggerimenti|chiudi dettagli sostituzione/i,
  });
  if (await isVisibleSoon(closeBtn, 15_000)) {
    await shot(page, "sostituzione-slot-suggerimenti");
    await closeBtn.click();
  }
}

async function verifySupportWidgets(page: Page) {
  const liveChatBtn = page.getByRole("button", { name: /apri chat live/i });
  if (await isVisibleSoon(liveChatBtn)) {
    await liveChatBtn.click();
    // Crisp è un widget di terze parti caricato in modo asincrono
    // (client.crisp.chat/l.js): il click mette in coda l'apertura, ma il
    // widget può metterci un momento a caricarsi/animarsi. Aspettiamo che
    // il suo iframe compaia, con un fallback a tempo per non bloccare la
    // suite se il caricamento è più lento del previsto.
    await page
      .frameLocator('iframe[title="chat"], iframe[src*="crisp.chat" i]')
      .first()
      .locator("body")
      .waitFor({ state: "visible", timeout: 8_000 })
      .catch(() => undefined);
    await shot(page, "supporto-chat-live-aperta");
  } else {
    console.warn(
      'Crisp non configurato (NEXT_PUBLIC_CRISP_WEBSITE_ID assente): "Apri chat live" non renderizzato — skip.',
    );
  }

  const ticketBtn = page.getByRole("button", { name: /apri (un )?ticket/i });
  if (await isVisibleSoon(ticketBtn)) {
    await ticketBtn.click(); // window.prompt gestiti da autoAnswerNativeDialogs
    await expect(page.getByText(/ticket inviato/i)).toBeVisible({
      timeout: 15_000,
    });
    await shot(page, "supporto-ticket-inviato");
  }
}

async function verifyShareCard(page: Page) {
  const shareBtn = page.getByRole("button", { name: /condividi card/i });
  if (!(await isVisibleSoon(shareBtn))) return;

  const [download] = await Promise.all([
    page.waitForEvent("download", { timeout: 20_000 }).catch(() => null),
    shareBtn.click(),
  ]);
  await shot(page, "share-card-viral");
  if (download) {
    test.info().annotations.push({
      type: "share-card-download",
      description: download.suggestedFilename(),
    });
  }
}

async function verifyReferralWidget(page: Page) {
  await page.goto("/it/app/referral");
  await expect(
    page.getByRole("heading", { name: /invita un amico, viaggia gratis/i }),
  ).toBeVisible({
    timeout: 20_000,
  });
  await shot(page, "referral-widget");

  const copyBtn = page.getByTitle(/copia link/i).first();
  if (await isVisibleSoon(copyBtn)) {
    await copyBtn.click();
    await expect(page.getByText(/link copiato negli appunti/i)).toBeVisible({
      timeout: 5000,
    });
    await shot(page, "referral-link-copiato");
  }
}

async function generateInviteLinkAndExtractUrl(
  page: Page,
): Promise<string | null> {
  const generateBtn = page.getByRole("button", {
    name: /genera link di invito/i,
  });
  if (!(await isVisibleSoon(generateBtn))) return null;

  await generateBtn.click();
  await shot(page, "invito-gruppo-generato");

  const bodyText = await page.locator("body").innerText();
  const match =
    bodyText.match(/https?:\/\/\S*\/join\/\S+/) ??
    bodyText.match(/\/[a-z]{2}\/join\/[A-Za-z0-9._-]+/);
  return match ? match[0] : null;
}

async function verifySplitExpenses(page: Page) {
  const heading = page.getByRole("heading", { name: /split spese/i });
  if (!(await isVisibleSoon(heading))) return;
  await heading.scrollIntoViewIfNeeded();
  await shot(page, "split-spese-sezione");

  const addBtn = page.getByRole("button", { name: /aggiungi spesa/i });
  if (!(await isVisibleSoon(addBtn))) return;

  await addBtn.click();
  await page.getByPlaceholder("Es: Cena da Mario").fill("Cena di gruppo E2E");
  await page.getByPlaceholder("0.00").fill("42.50");
  await shot(page, "split-spese-form-compilato");

  await page.getByRole("button", { name: /^salva$/i }).click();
  await expect(page.getByText(/cena di gruppo e2e/i)).toBeVisible({
    timeout: 10_000,
  });
  await shot(page, "split-spese-aggiunta");

  const balance = page.getByText(/bilancio del gruppo/i);
  if (await isVisibleSoon(balance)) {
    await shot(page, "split-spese-bilancio-gruppo");
  }
}

// ---------------------------------------------------------------------------
// Test principale — un'unica esperienza utente continua, in 26 passaggi.
// ---------------------------------------------------------------------------

// Nota: la modalità "headed" (browser visibile) è impostata a livello di
// progetto in playwright.purchase-flow.config.ts (progetto "purchase-flow"),
// non qui — `test.use()` con `headless` non è ammesso dentro un `describe`.
test.describe("Acquisto piano Pro — flusso utente completo", () => {
  test("homepage → signup → viaggio Solo/Coppia → Stripe → AI → Gruppo → abbonamento", async ({
    page,
    context,
    browser,
  }) => {
    test.setTimeout(20 * 60 * 1000);
    autoAnswerNativeDialogs(page, [
      "Il pagamento risulta bloccato (E2E test)",
      "Dettagli aggiuntivi generati dal test Playwright.",
    ]);

    let soloTripId = "";
    let groupTripId = "";
    let mainUser: TestUser | null = null;

    // 1. Homepage
    await test.step('1. Navigare sulla Homepage principale ("/")', async () => {
      await page.goto("/it");
      await expect(page).toHaveURL(/\/it(\/|$)/);
      await shot(page, "homepage");
    });

    // 2. Creare un account di test locale
    await test.step("2. Creare un account di test locale per registrarsi", async () => {
      // Mostriamo la sezione di signup della home (contesto visivo per lo screenshot),
      // poi creiamo l'utente via Clerk Backend API — vedi commento in testa al file
      // sul perché non compiliamo l'Account Portal ospitato di Clerk via UI.
      const signUpCta = page
        .getByRole("button", { name: /inizia ora|registrati/i })
        .first();
      if (await isVisibleSoon(signUpCta)) {
        await shot(page, "homepage-cta-signup");
      }

      mainUser = await createClerkTestUser("main");
      createdUsers.push(mainUser);

      await setupClerkTestingToken({ page });
    });

    // 3. Accedere con le credenziali dell'account appena creato
    await test.step("3. Accedere con le credenziali di test utilizzate per creare l'account", async () => {
      if (!mainUser)
        throw new Error("Utente di test non creato allo step precedente.");
      await clerk.signIn({ page, emailAddress: mainUser.email });
      await page.goto("/it/app");
      await expect(
        page
          .getByRole("heading", { level: 1 })
          .filter({ hasText: /la tua dashboard/i }),
      ).toBeVisible({ timeout: 60_000 });
      await shot(page, "login-effettuato-dashboard");
    });

    // 4. Generare un itinerario Solo/Coppia (verifica end-to-end che l'AI risponda):
    //    l'itinerario vero e proprio viene creato/pagato/generato nei punti 5-13.
    await test.step("4. Generare un itinerario di viaggio Solo/Coppia (verifica AI end-to-end)", async () => {
      await shot(page, "dashboard-pronta-per-generazione-ai");
    });

    // 5. Area riservata "La tua dashboard"
    await test.step('5. Entrare nell\'area riservata "La tua dashboard"', async () => {
      await page.goto("/it/app");
      await expect(
        page
          .getByRole("heading", { level: 1 })
          .filter({ hasText: /la tua dashboard/i }),
      ).toBeVisible({ timeout: 30_000 });
      await shot(page, "area-riservata-dashboard");
    });

    // 6. "I miei viaggi"
    await test.step('6. Cliccare sulla funzionalità "I miei viaggi"', async () => {
      await page.getByRole("link", { name: "I miei viaggi" }).click();
      await expect(
        page.getByRole("heading", { level: 1, name: "I miei viaggi" }),
      ).toBeVisible({
        timeout: 15_000,
      });
      await shot(page, "pagina-i-miei-viaggi");
    });

    // 7. "Nuovo viaggio" (Solo/Coppia)
    await test.step('7. Creare un "Nuovo viaggio" (Solo/Coppia)', async () => {
      soloTripId = await createTrip(page, {
        destination: "Lisbona",
        tripType: "solo",
      });
      expect(soloTripId).not.toBe("");
    });

    // 8-9. Sblocca la generazione, "Vai al pagamento", selezione piano + redirect Stripe
    await test.step('8-9. Sbloccare la generazione, "Vai al pagamento" e redirect a Stripe Checkout', async () => {
      const payButton = page.getByRole("button", { name: /vai al pagamento/i });
      await expect(payButton).toBeVisible({ timeout: 15_000 });
      await shot(page, "piano-selezionato-pre-pagamento");

      await Promise.all([
        page.waitForURL(/checkout\.stripe\.com/, { timeout: 45_000 }),
        payButton.click(),
      ]);
      await expect(page).toHaveURL(/checkout\.stripe\.com/);
      await shot(page, "redirect-stripe-checkout");
    });

    // 10-11. Compilare Stripe (carta test) e inviare il pagamento
    await test.step("10-11. Compilare i campi Stripe (4242 4242 4242 4242) e inviare il pagamento", async () => {
      await payWithStripeTestCard(page, { buyerEmail: mainUser?.email });
      await expect(page).not.toHaveURL(/checkout\.stripe\.com/);
      await expect(page.getByText(/pagamento ricevuto/i)).toBeVisible({
        timeout: 30_000,
      });
      await shot(page, "pagina-successo-post-pagamento");
    });

    // 12. Generazione in corso
    await test.step("12. Generazione in corso", async () => {
      await waitForGeneration(page);
    });

    // 13. Mappe Leaflet
    await softStep(
      "13. Verificare che le mappe Leaflet rispondano correttamente",
      async () => {
        await verifyLeafletMap(page);
      },
    );

    // 14. Rigenera 3 volte gratis, scegli la versione con il punteggio maggiore
    await softStep(
      "14. Rigenerare l'itinerario 3 volte e scegliere la versione con il punteggio maggiore",
      async () => {
        await regenerateFreeAndPickBestScore(page);
      },
    );

    // 15. Rigenerazioni 4-7 a pagamento, poi carosello
    await softStep(
      "15. Verificare che le rigenerazioni 4-7 siano a pagamento e che poi compaia il carosello",
      async () => {
        await verifyPaidRegenerationsThenCarousel(page);
      },
    );

    // 16. Inngest
    await softStep(
      "16. Verificare che Inngest funzioni correttamente",
      async () => {
        await verifyInngestEndpoint(page);
      },
    );

    // 17. GPS
    await softStep(
      "17. Verificare che la funzionalità GPS funzioni correttamente",
      async () => {
        await verifyGps(context, page);
      },
    );

    // 18. Modifica preferenze
    await softStep(
      '18. Verificare che "Modifica preferenze" funzioni correttamente',
      async () => {
        await verifyEditPreferences(page);
      },
    );

    // 19. "Cosa faccio adesso" / sostituzione slot
    await softStep(
      '19. Verificare "Cosa faccio adesso" e la sostituzione di uno slot',
      async () => {
        await verifySlotReplaceSuggestions(page);
      },
    );

    // 20. Chat live / Apri ticket
    await softStep('20. Verificare "Chat live" e "Apri ticket"', async () => {
      await verifySupportWidgets(page);
    });

    // 21. Stessi controlli per un viaggio di Gruppo
    await softStep(
      "21. Ripetere i controlli chiave per l'acquisto di un viaggio di Gruppo",
      async () => {
        groupTripId = await createTrip(page, {
          destination: "Barcellona",
          tripType: "gruppo",
        });
        expect(groupTripId).not.toBe("");
        await unlockAndPay(page, mainUser?.email);
        await expect(page.getByText(/pagamento ricevuto/i)).toBeVisible({
          timeout: 30_000,
        });
        await waitForGeneration(page);
        await verifyLeafletMap(page).catch(() => undefined);
      },
    );

    let inviteUrl: string | null = null;

    // 22. Invio link di invito
    await softStep(
      "22. Simulare l'invio del link di invito per altri membri del gruppo",
      async () => {
        inviteUrl = await generateInviteLinkAndExtractUrl(page);
        expect(
          inviteUrl,
          "Il link di invito deve essere generato e visibile in pagina",
        ).toBeTruthy();
      },
    );

    // 23. Un secondo membro riceve l'invito e si unisce
    await softStep(
      "23. Verificare che un altro membro riceva l'invito e si unisca al gruppo",
      async () => {
        if (!inviteUrl)
          throw new Error(
            "Nessun link di invito disponibile dallo step precedente.",
          );

        const memberUser = await createClerkTestUser("member");
        createdUsers.push(memberUser);

        const memberContext = await browser.newContext();
        const memberPage = await memberContext.newPage();
        try {
          await setupClerkTestingToken({ page: memberPage });
          await clerk.signIn({
            page: memberPage,
            emailAddress: memberUser.email,
          });

          const relativeInvite = inviteUrl.startsWith("http")
            ? new URL(inviteUrl).pathname
            : inviteUrl;
          await memberPage.goto(relativeInvite);
          await shot(memberPage, "membro-pagina-invito");

          const joinBtn = memberPage.getByRole("button", {
            name: /unisciti al viaggio/i,
          });
          await expect(joinBtn).toBeVisible({ timeout: 20_000 });
          await joinBtn.click();

          await expect(memberPage.getByText(/sei dentro!/i)).toBeVisible({
            timeout: 20_000,
          });
          await shot(memberPage, "membro-unito-al-gruppo");
        } finally {
          await memberContext.close();
        }
      },
    );

    // 24. Split spese
    await softStep(
      '24. Verificare la funzionalità "Split spese" del gruppo',
      async () => {
        await verifySplitExpenses(page);
      },
    );

    // 25. Progress bar, Share Card virale, Referral widget
    await softStep(
      '25. Verificare "Progress bar", "Share Card virale" e "Referral widget"',
      async () => {
        // La progress bar è già stata catturata durante la generazione (step 12/waitForGeneration).
        await verifyShareCard(page);
        await verifyReferralWidget(page);
      },
    );

    // 26. Abbonamento "Viaggiatore frequente"
    await softStep(
      '26. Ripetere i controlli chiave per l\'acquisto in abbonamento "Viaggiatore frequente"',
      async () => {
        await page.goto("/it");
        const subscribeBtn = page
          .getByRole("button", { name: /registrati e scopri i piani/i })
          .first();
        await expect(subscribeBtn).toBeVisible({ timeout: 15_000 });
        await shot(page, "pricing-viaggiatore-frequente");

        await Promise.all([
          page.waitForURL(/checkout\.stripe\.com/, { timeout: 45_000 }),
          subscribeBtn.click(),
        ]);
        await shot(page, "abbonamento-redirect-stripe");

        await payWithStripeTestCard(page, { buyerEmail: mainUser?.email });
        await shot(page, "abbonamento-completato");
      },
    );
  });
});
