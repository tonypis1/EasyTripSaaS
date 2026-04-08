/**
 * Esporta presentation.html in PDF (Chromium headless, come Stampa → Salva come PDF).
 * Richiede: npx playwright install chromium
 */
const fs = require("fs");
const path = require("path");
const { pathToFileURL } = require("url");

async function main() {
  const { chromium } = require("playwright");

  const root = path.join(__dirname, "..");
  const htmlPath = path.join(root, "presentation.html");
  const outDir = path.join(root, "docs");
  const outPdf = path.join(outDir, "presentation.pdf");

  if (!fs.existsSync(htmlPath)) {
    console.error("Manca presentation.html in:", root);
    process.exit(1);
  }

  fs.mkdirSync(outDir, { recursive: true });

  const fileUrl = pathToFileURL(htmlPath).href;

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.setViewportSize({ width: 1280, height: 900 });

  await page.goto(fileUrl, { waitUntil: "load", timeout: 120_000 });

  await page.waitForFunction(() => document.fonts.ready).catch(() => {});
  await page.waitForTimeout(1500);
  await page
    .waitForSelector(".mermaid svg", { timeout: 60_000 })
    .catch(() => {
      console.warn(
        "Mermaid: SVG non trovato in tempo; il PDF potrebbe avere il diagramma vuoto.",
      );
    });
  await page.waitForTimeout(500);

  await page.pdf({
    path: outPdf,
    format: "A4",
    printBackground: true,
    margin: { top: "12mm", right: "12mm", bottom: "14mm", left: "12mm" },
  });

  await browser.close();

  console.log("PDF salvato:", outPdf);
}

main().catch((err) => {
  console.error(err);
  if (
    String(err.message || err).includes("Executable doesn't exist") ||
    String(err).includes("chromium")
  ) {
    console.error("\nEsegui: npx playwright install chromium\n");
  }
  process.exit(1);
});
