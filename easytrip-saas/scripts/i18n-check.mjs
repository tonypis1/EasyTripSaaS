#!/usr/bin/env node
/**
 * EasyTrip — controllo coerenza chiavi i18n.
 *
 * Confronta le chiavi di traduzione effettivamente usate nel codice
 * (chiamate a useTranslations / getTranslations di next-intl) con il
 * contenuto dei file messages/*.json. Fallisce (exit 1) se una chiave
 * usata nel codice non esiste in uno o più locali.
 *
 * Uso:
 *   node scripts/i18n-check.mjs              # check standard, fallisce se mancano chiavi
 *   node scripts/i18n-check.mjs --unused     # mostra anche le chiavi presenti ma non usate
 *   node scripts/i18n-check.mjs --strict     # fallisce anche per chiavi inutilizzate
 *   node scripts/i18n-check.mjs --json       # output strutturato (per CI / script)
 *
 * Limitazioni note:
 *   - Le chiamate con chiave dinamica (es. t(SLOT_KEYS[key])) non sono
 *     risolvibili staticamente: vengono ignorate dal check "missing" e
 *     elencate in fondo al report come info.
 *   - L'estrazione è basata su regex robuste, non su un AST completo:
 *     copre i pattern usati nella codebase (~99%) ma non casi esotici
 *     come destrutturazione (`const { t } = useTranslations(...)`).
 */

import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

// ── Setup ─────────────────────────────────────────────────────────────────
const ROOT = join(fileURLToPath(new URL(".", import.meta.url)), "..");
const SRC_DIR = join(ROOT, "src");
const MESSAGES_DIR = join(ROOT, "messages");

const args = process.argv.slice(2);
const showUnused = args.includes("--unused") || args.includes("--strict");
const strict = args.includes("--strict");
const asJson = args.includes("--json");

// Helper plurale italiano (1 → singolare, altrimenti plurale)
const plIt = (n, sing, plur) => (n === 1 ? sing : plur);

// ── Walker file sorgente ──────────────────────────────────────────────────
const SRC_EXT = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"]);
const IGNORE_DIRS = new Set([
  "node_modules",
  ".next",
  "dist",
  "build",
  ".git",
  "coverage",
  "__snapshots__",
  ".turbo",
]);

function* walkSourceFiles(dir) {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const e of entries) {
    const fullPath = join(dir, e.name);
    if (e.isDirectory()) {
      if (IGNORE_DIRS.has(e.name)) continue;
      yield* walkSourceFiles(fullPath);
    } else if (e.isFile()) {
      const dot = e.name.lastIndexOf(".");
      const ext = dot >= 0 ? e.name.slice(dot) : "";
      if (SRC_EXT.has(ext)) yield fullPath;
    }
  }
}

// ── Estrazione chiavi dal codice ──────────────────────────────────────────
//
// Trova: const <id> = (await )?(useTranslations|getTranslations)(<arg>?)
// Casi <arg>:
//   nessun argomento
//   "namespace" | 'namespace' | `namespace` (senza interpolazione)
//   { namespace: "ns", ... }   (forma oggetto di getTranslations)
const BINDING_RE = new RegExp(
  [
    "(?:const|let|var)\\s+",
    "([A-Za-z_$][\\w$]*)",
    "\\s*=\\s*(?:await\\s+)?(?:useTranslations|getTranslations)\\s*\\(",
    "\\s*",
    "(?:",
    '"([^"]*)"',
    "|'([^']*)'",
    "|`([^`$]*)`",
    "|\\{[^}]*?namespace\\s*:\\s*",
    '(?:"([^"]*)"|\'([^\']*)\'|`([^`$]*)`)',
    "[^}]*\\}",
    ")?",
    "\\s*\\)",
  ].join(""),
  "g",
);

// Restituisce un array ordinato per offset crescente:
//   [{ id, ns, offset }]
// Più binding con lo stesso id possono coesistere (es. due `const t = ...`
// in funzioni diverse): per le chiamate troveremo il binding "più recente
// prima" dell'offset della chiamata, approssimando lo scope lessicale.
function extractBindings(src) {
  const bindings = [];
  let m;
  // Reimposta lo state del regex globale fra invocazioni.
  BINDING_RE.lastIndex = 0;
  while ((m = BINDING_RE.exec(src)) !== null) {
    const id = m[1];
    const ns = m[2] ?? m[3] ?? m[4] ?? m[5] ?? m[6] ?? m[7] ?? "";
    bindings.push({ id, ns, offset: m.index });
  }
  // Ordinato per costruzione (regex globale scansiona linearmente).
  return bindings;
}

// Cerca il binding più recente con id == targetId e offset <= maxOffset.
// Restituisce null se non c'è nessun binding compatibile.
function resolveBinding(bindings, targetId, maxOffset) {
  let found = null;
  for (const b of bindings) {
    if (b.offset > maxOffset) break;
    if (b.id === targetId) found = b;
  }
  return found;
}

// Estrae le chiamate del binding:
//   <id>("key")       → statico
//   <id>.rich("key")  → statico
//   <id>.raw("key")   → statico
//   <id>.markup("k")  → statico
//   <id>(expr)        → dinamico (raccolto, ma non verificato)
function extractCalls(src, bindings) {
  const out = { staticCalls: [], dynamicCalls: [] };
  if (bindings.length === 0) return out;

  // Set unico di tutti gli id (un id può comparire più volte se ridichiarato).
  const uniqueIds = [...new Set(bindings.map((b) => b.id))];
  const idsAlt = uniqueIds
    .map((s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .join("|");

  const callRe = new RegExp(
    [
      "\\b(",
      idsAlt,
      ")(?:\\s*\\.(?:rich|raw|markup|has))?\\s*\\(\\s*",
      "(?:",
      '"([^"]*)"',
      "|'([^']*)'",
      "|`([^`$]*)`",
      "|([^,)]+?)",
      ")(?=\\s*[,)])",
    ].join(""),
    "g",
  );

  let m;
  while ((m = callRe.exec(src)) !== null) {
    const id = m[1];
    const staticKey = m[2] ?? m[3] ?? m[4];
    const dynamicExpr = m[5];
    const offset = m.index;
    const binding = resolveBinding(bindings, id, offset);
    // Se la "chiamata" appare prima di qualunque dichiarazione del binding
    // (es. è un'altra funzione che si chiama allo stesso modo), saltala.
    if (!binding) continue;
    const ns = binding.ns;
    const line = src.slice(0, offset).split("\n").length;
    if (staticKey !== undefined) {
      out.staticCalls.push({ ns, key: staticKey, line });
    } else if (dynamicExpr !== undefined) {
      out.dynamicCalls.push({ ns, expr: dynamicExpr.trim(), line });
    }
  }
  return out;
}

// ── Flatten dei file messages JSON ────────────────────────────────────────
//
// Trasforma { app: { trips: { detail: { booking: { title: "..." } } } } }
// in un Set { "app.trips.detail.booking.title", ... }
function flatten(obj, prefix = "", out = new Set()) {
  if (typeof obj !== "object" || obj === null) return out;
  for (const [k, v] of Object.entries(obj)) {
    const full = prefix ? `${prefix}.${k}` : k;
    if (typeof v === "string") {
      out.add(full);
    } else if (typeof v === "object" && v !== null) {
      flatten(v, full, out);
    }
  }
  return out;
}

// ── Main ──────────────────────────────────────────────────────────────────

// 1. Carica i file dei messaggi.
const localeFiles = readdirSync(MESSAGES_DIR)
  .filter((f) => f.endsWith(".json"))
  .map((f) => ({ locale: f.slice(0, -5), path: join(MESSAGES_DIR, f) }));

if (localeFiles.length === 0) {
  console.error(`✗ Nessun file di messaggi trovato in ${MESSAGES_DIR}`);
  process.exit(2);
}

const localeKeys = new Map();
for (const { locale, path } of localeFiles) {
  let json;
  try {
    json = JSON.parse(readFileSync(path, "utf8"));
  } catch (err) {
    console.error(`✗ ${locale}.json: JSON non valido — ${err.message}`);
    process.exit(2);
  }
  localeKeys.set(locale, flatten(json));
}

// 2. Scansiona src/ ed estrae le chiavi.
const allStatic = []; // { ns, key, fullKey, file, line }
const allDynamic = []; // { ns, expr, file, line }
let filesScanned = 0;

for (const file of walkSourceFiles(SRC_DIR)) {
  let src;
  try {
    src = readFileSync(file, "utf8");
  } catch {
    continue;
  }
  // Speedup: salta i file che non menzionano le funzioni di next-intl.
  if (!/useTranslations|getTranslations/.test(src)) continue;
  filesScanned++;
  const bindings = extractBindings(src);
  if (bindings.length === 0) continue;
  const { staticCalls, dynamicCalls } = extractCalls(src, bindings);
  for (const c of staticCalls) {
    const fullKey = c.ns ? `${c.ns}.${c.key}` : c.key;
    allStatic.push({ ...c, fullKey, file });
  }
  for (const c of dynamicCalls) {
    allDynamic.push({ ...c, file });
  }
}

// Deduplica le chiavi statiche per fullKey, mantenendo le occorrenze.
const occurrencesByKey = new Map(); // fullKey -> [{ file, line }]
for (const s of allStatic) {
  const list = occurrencesByKey.get(s.fullKey) ?? [];
  list.push({ file: s.file, line: s.line });
  occurrencesByKey.set(s.fullKey, list);
}
const usedKeys = new Set(occurrencesByKey.keys());

// 3. Per ogni locale, trova le chiavi mancanti e quelle inutilizzate.
const missingByLocale = new Map(); // locale -> Map<fullKey, occurrences[]>
const unusedByLocale = new Map(); // locale -> string[]

for (const [locale, keys] of localeKeys) {
  const missing = new Map();
  for (const fullKey of usedKeys) {
    if (!keys.has(fullKey)) {
      missing.set(fullKey, occurrencesByKey.get(fullKey));
    }
  }
  missingByLocale.set(locale, missing);
  unusedByLocale.set(
    locale,
    [...keys].filter((k) => !usedKeys.has(k)).sort(),
  );
}

// ── Output JSON (per CI strutturata) ──────────────────────────────────────
if (asJson) {
  const out = {
    filesScanned,
    locales: localeFiles.map((l) => l.locale),
    staticKeysCount: usedKeys.size,
    dynamicKeysCount: allDynamic.length,
    missingByLocale: Object.fromEntries(
      [...missingByLocale].map(([l, m]) => [l, [...m.keys()].sort()]),
    ),
    unusedByLocale: Object.fromEntries(unusedByLocale),
  };
  console.log(JSON.stringify(out, null, 2));
  const totalMissing = [...missingByLocale.values()].reduce(
    (s, m) => s + m.size,
    0,
  );
  const hasUnused = [...unusedByLocale.values()].some((u) => u.length > 0);
  if (totalMissing > 0) process.exit(1);
  if (strict && hasUnused) process.exit(1);
  process.exit(0);
}

// ── Output testuale ───────────────────────────────────────────────────────
const relRoot = (p) => relative(ROOT, p).split("\\").join("/");

console.log("EasyTrip — controllo chiavi i18n\n");
console.log(`File scansionati: ${filesScanned}`);
console.log(`Chiavi statiche uniche usate: ${usedKeys.size}`);
console.log(`Chiamate con chiave dinamica: ${allDynamic.length}`);
console.log(`Locali rilevati: ${[...localeKeys.keys()].join(", ")}\n`);

let totalMissing = 0;
for (const [locale, missing] of missingByLocale) {
  if (missing.size === 0) {
    console.log(`✓ ${locale}: tutte le chiavi usate sono presenti.`);
    continue;
  }
  totalMissing += missing.size;
  console.log(
    `✗ ${locale}: ${missing.size} ${plIt(missing.size, "chiave mancante", "chiavi mancanti")}:`,
  );
  for (const [key, refs] of missing) {
    console.log(`    • ${key}`);
    for (const r of refs.slice(0, 3)) {
      console.log(`        ↳ ${relRoot(r.file)}:${r.line}`);
    }
    if (refs.length > 3) {
      console.log(
        `        ↳ … e altre ${refs.length - 3} ${plIt(refs.length - 3, "occorrenza", "occorrenze")}`,
      );
    }
  }
}

if (showUnused) {
  console.log("");
  for (const [locale, unused] of unusedByLocale) {
    if (unused.length === 0) {
      console.log(`✓ ${locale}: nessuna chiave inutilizzata.`);
      continue;
    }
    console.log(
      `! ${locale}: ${unused.length} ${plIt(unused.length, "chiave inutilizzata", "chiavi inutilizzate")} (potrebbero essere falsi positivi se accedute dinamicamente):`,
    );
    for (const k of unused.slice(0, 30)) {
      console.log(`    • ${k}`);
    }
    if (unused.length > 30) {
      console.log(
        `    … e altre ${unused.length - 30} ${plIt(unused.length - 30, "chiave", "chiavi")}.`,
      );
    }
  }
}

if (allDynamic.length > 0) {
  console.log(
    "\nℹ Chiamate con chiave dinamica (non verificabili staticamente, prime 10):",
  );
  const sample = allDynamic.slice(0, 10);
  for (const d of sample) {
    const ns = d.ns ? `${d.ns}.` : "";
    console.log(`    • ${relRoot(d.file)}:${d.line}    ${ns}<${d.expr}>`);
  }
  if (allDynamic.length > 10) {
    console.log(`    … e altre ${allDynamic.length - 10}.`);
  }
  console.log(
    "  (Verifica manualmente che le chiavi raggiunte da queste espressioni esistano nei file messages/*.json.)",
  );
}

console.log("");
const hasUnused = [...unusedByLocale.values()].some((u) => u.length > 0);
if (totalMissing > 0) {
  console.log(
    `✗ Totale: ${totalMissing} ${plIt(totalMissing, "chiave mancante", "chiavi mancanti")} fra tutti i locali.`,
  );
  console.log(
    "  Aggiungi le traduzioni mancanti nei rispettivi file messages/*.json e rilancia il check.",
  );
  process.exit(1);
}
if (strict && hasUnused) {
  console.log(
    "✗ Modalità --strict: ci sono chiavi inutilizzate. Rimuovile dai file messages/*.json oppure usa il check senza --strict.",
  );
  process.exit(1);
}
console.log(`✓ Tutto a posto.`);
process.exit(0);
