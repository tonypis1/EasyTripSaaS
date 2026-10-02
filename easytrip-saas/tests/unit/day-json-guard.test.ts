import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Guardia sulle due regole introdotte dalla migrazione di Day.morning/
 * afternoon/evening/restaurants a jsonb, che il compilatore non può far
 * rispettare: Prisma accetta una stringa come valore Json (e la salva doppiamente
 * serializzata), quindi un `JSON.stringify` rimasto in scrittura compila senza errori.
 */

const SRC = path.resolve(__dirname, "../../src");

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) return sourceFiles(full);
    return /\.(ts|tsx)$/.test(name) && !/\.test\.(ts|tsx)$/.test(name)
      ? [full]
      : [];
  });
}

const files = sourceFiles(SRC).map((file) => ({
  file: path.relative(SRC, file),
  text: readFileSync(file, "utf8"),
}));

describe("Day jsonb: invarianti sul codice", () => {
  it("slotSummary ha una sola definizione", () => {
    const definitions = files.filter(({ text }) =>
      /\bfunction\s+slotSummary\s*\(/.test(text),
    );

    expect(definitions.map((d) => d.file)).toEqual(["lib/trip/day-slots.ts"]);
  });

  it("nessuna scrittura di slot/ristoranti passa da JSON.stringify", () => {
    // morning: JSON.stringify(..), [field]: JSON.stringify(..), [slotKey]: JSON.stringify(..)
    const stringified =
      /\b(?:morning|afternoon|evening|restaurants)\s*:\s*(?:\n\s*)?JSON\.stringify|\[[\w.]+\]\s*:\s*JSON\.stringify/;

    const offenders = files
      .filter(({ text }) => stringified.test(text))
      .map((f) => f.file);

    expect(offenders).toEqual([]);
  });

  it("nessun JSON.parse sui valori letti dagli slot del giorno", () => {
    const parsesDayColumn =
      /JSON\.parse\(\s*(?:raw|[\w.]*\b(?:morning|afternoon|evening|restaurants)\b)\s*\)/;

    const offenders = files
      .filter(({ text }) => parsesDayColumn.test(text))
      .map((f) => f.file);

    expect(offenders).toEqual([]);
  });
});
