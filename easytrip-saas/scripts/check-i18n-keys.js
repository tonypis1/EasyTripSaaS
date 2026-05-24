const fs = require("fs");
const path = require("path");

const locales = ["it", "en", "es", "fr", "de"];
const base = path.join(__dirname, "..", "messages");

function flatten(obj, prefix = "") {
  const out = [];
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === "object" && !Array.isArray(v)) {
      out.push(...flatten(v, key));
    } else {
      out.push(key);
    }
  }
  return out;
}

const data = {};
for (const l of locales) {
  const raw = fs.readFileSync(path.join(base, `${l}.json`), "utf8");
  data[l] = new Set(flatten(JSON.parse(raw)));
}

const reference = data.it;
let hasIssues = false;
for (const l of locales) {
  if (l === "it") continue;
  const missing = [...reference].filter((k) => !data[l].has(k));
  const extra = [...data[l]].filter((k) => !reference.has(k));
  if (missing.length || extra.length) {
    hasIssues = true;
    console.log(`\n== ${l} vs it ==`);
    if (missing.length) {
      console.log(`  Missing keys (${missing.length}):`);
      missing.slice(0, 30).forEach((k) => console.log(`    - ${k}`));
      if (missing.length > 30)
        console.log(`    ... and ${missing.length - 30} more`);
    }
    if (extra.length) {
      console.log(`  Extra keys (${extra.length}):`);
      extra.slice(0, 30).forEach((k) => console.log(`    + ${k}`));
      if (extra.length > 30)
        console.log(`    ... and ${extra.length - 30} more`);
    }
  }
}

if (!hasIssues) {
  console.log("All locales are in sync with 'it' (reference).");
  console.log(`Total keys: ${reference.size}`);
}
