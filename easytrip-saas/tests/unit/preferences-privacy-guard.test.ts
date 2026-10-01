import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Le restrizioni alimentari (halal, kosher, celiachia, allergie…) possono
 * rivelare convinzioni religiose o dati sulla salute: servono solo a costruire
 * l'itinerario. Questa guardia impedisce che finiscano in analytics
 * (`posthog.capture`) o nei log (`logger.*`): ammessi solo conteggi e flag
 * (`.length`, `dietaryRestrictionsCount`, `has_dietary_restrictions`).
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

/** Testo (parentesi comprese) di ogni chiamata `<callee>(...)`, con parentesi bilanciate. */
export function callsOf(text: string, callee: RegExp): string[] {
  const calls: string[] = [];
  const pattern = new RegExp(callee.source + "\\s*\\(", "g");
  for (let m = pattern.exec(text); m; m = pattern.exec(text)) {
    let depth = 1;
    let i = m.index + m[0].length;
    while (i < text.length && depth > 0) {
      if (text[i] === "(") depth++;
      else if (text[i] === ")") depth--;
      i++;
    }
    calls.push(text.slice(m.index, i));
  }
  return calls;
}

const CALLEES = [/posthog\.capture/, /logger\.(?:info|warn|error)/];

// Il valore degli elenchi sensibili (non il loro .length) o l'intero oggetto
// preferenze. Anche le esigenze di mobilità possono rivelare dati sulla salute.
const LEAKS =
  /\b(?:dietaryRestrictions|mobilityNeeds)\b(?!\.length)|\b(?:prefs|preferences|prefStructured)\b(?![.\w])/;

describe("Preferenze alimentari: privacy", () => {
  const files = sourceFiles(SRC).map((file) => ({
    file: path.relative(SRC, file),
    text: readFileSync(file, "utf8"),
  }));

  it("nessuna chiamata ad analytics o log include i valori delle restrizioni o l'oggetto preferenze", () => {
    const offenders = files.flatMap(({ file, text }) =>
      CALLEES.flatMap((callee) =>
        callsOf(text, callee)
          .filter((call) => LEAKS.test(call))
          .map((call) => `${file}: ${call.slice(0, 80).replace(/\s+/g, " ")}`),
      ),
    );

    expect(offenders).toEqual([]);
  });

  it("la guardia riconosce davvero le fughe (e non segnala i conteggi)", () => {
    const leaky = `posthog.capture("x", { diet: prefs.dietaryRestrictions })`;
    const leakyWhole = `logger.info("x", { prefs })`;
    const leakyPrefsArg = `logger.warn("x", preferences)`;
    const leakyMobility = `posthog.capture("x", { m: prefStructured.mobilityNeeds })`;
    const safeMobility = `posthog.capture("x", { n: prefStructured.mobilityNeeds.length })`;
    const safe = `posthog.capture("x", { n: prefs.dietaryRestrictions.length, has: true, c: prefs.interests.length })`;
    const safeCount = `logger.info("x", { dietaryRestrictionsCount: trip.preferences.dietaryRestrictions.length })`;

    const flagged = (code: string) =>
      CALLEES.some((c) => callsOf(code, c).some((call) => LEAKS.test(call)));

    expect(flagged(leaky)).toBe(true);
    expect(flagged(leakyWhole)).toBe(true);
    expect(flagged(leakyPrefsArg)).toBe(true);
    expect(flagged(leakyMobility)).toBe(true);
    expect(flagged(safeMobility)).toBe(false);
    expect(flagged(safe)).toBe(false);
    expect(flagged(safeCount)).toBe(false);
  });

  it("le chiamate di analytics che riguardano le preferenze esistono (la guardia non gira a vuoto)", () => {
    const withPrefs = files.filter(({ text }) =>
      callsOf(text, /posthog\.capture/).some((c) =>
        /has_dietary_restrictions/.test(c),
      ),
    );

    expect(withPrefs.length).toBeGreaterThanOrEqual(2);
  });
});
