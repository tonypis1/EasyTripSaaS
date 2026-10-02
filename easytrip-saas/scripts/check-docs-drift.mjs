#!/usr/bin/env node
/**
 * EasyTrip — controllo drift documentazione/codice sul modello Anthropic.
 *
 * Il modello di default vive in `src/config/unifiedConfig.ts`
 * (`env.ANTHROPIC_MODEL ?? "<default>"`). Documentazione e `.env.example`
 * citano quel valore a mano: senza un controllo, ogni bump del modello lascia
 * riferimenti obsoleti (es. `claude-sonnet-4-20250514` nei docs mentre il
 * codice usava già `claude-sonnet-5`). Questo script fallisce (exit 1) se
 * un qualunque ID di modello Claude citato nei file monitorati è diverso dal
 * default del codice.
 *
 * Uso:
 *   node scripts/check-docs-drift.mjs
 */

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = join(fileURLToPath(new URL(".", import.meta.url)), "..");
const CONFIG_FILE = join(ROOT, "src", "config", "unifiedConfig.ts");

/** File/cartelle monitorati (relativi a easytrip-saas/). */
const DOC_DIRS = ["architecture-docs", "docs"];
const DOC_FILES = [".env.example", "README.md"];

const DEFAULT_MODEL_RE = /ANTHROPIC_MODEL\s*\?\?\s*["']([^"']+)["']/;
const MODEL_ID_RE =
  /claude-(?:opus|sonnet|haiku|fable|mythos)-\d+(?:-[0-9a-z]+)*/g;

/** Estrae il modello di default dal sorgente di unifiedConfig.ts (null se non trovato). */
export function extractDefaultModel(configSource) {
  return DEFAULT_MODEL_RE.exec(configSource)?.[1] ?? null;
}

/**
 * Ritorna gli ID di modello Claude citati in `text` che differiscono da
 * `defaultModel`, con numero di riga (1-based).
 */
export function findModelDrift(text, defaultModel) {
  const drift = [];
  const lines = text.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    for (const match of lines[i].matchAll(MODEL_ID_RE)) {
      if (match[0] !== defaultModel) {
        drift.push({ line: i + 1, model: match[0] });
      }
    }
  }
  return drift;
}

function* walkMarkdown(dir) {
  if (!existsSync(dir)) return;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) yield* walkMarkdown(full);
    else if (entry.name.endsWith(".md")) yield full;
  }
}

function monitoredFiles() {
  const files = DOC_FILES.map((f) => join(ROOT, f)).filter(existsSync);
  for (const dir of DOC_DIRS) files.push(...walkMarkdown(join(ROOT, dir)));
  return files;
}

function main() {
  const defaultModel = extractDefaultModel(readFileSync(CONFIG_FILE, "utf8"));
  if (!defaultModel) {
    console.error(
      `✗ Impossibile leggere il modello di default da ${relative(ROOT, CONFIG_FILE)} (pattern: ANTHROPIC_MODEL ?? "...").`,
    );
    process.exit(1);
  }

  console.log(`Modello di default nel codice: ${defaultModel}`);

  let failures = 0;
  for (const file of monitoredFiles()) {
    for (const { line, model } of findModelDrift(
      readFileSync(file, "utf8"),
      defaultModel,
    )) {
      failures++;
      console.error(
        `✗ ${relative(ROOT, file)}:${line} cita ${model}, ma il default nel codice è ${defaultModel}`,
      );
    }
  }

  if (failures > 0) {
    console.error(
      `\n${failures} riferimento/i obsoleto/i: aggiorna la documentazione (o il default in unifiedConfig.ts).`,
    );
    process.exit(1);
  }
  console.log("✓ Nessun drift: docs e .env.example allineati al codice.");
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  main();
}
