import { describe, expect, it } from "vitest";
import {
  extractDefaultModel,
  findModelDrift,
} from "../../scripts/check-docs-drift.mjs";

describe("extractDefaultModel", () => {
  it("legge il default da unifiedConfig.ts", () => {
    const src = `anthropicModel: env.ANTHROPIC_MODEL ?? "claude-sonnet-5",`;
    expect(extractDefaultModel(src)).toBe("claude-sonnet-5");
  });

  it("ritorna null se il pattern non c'è più (es. refactor della config)", () => {
    expect(extractDefaultModel("const x = 1;")).toBeNull();
  });
});

describe("findModelDrift", () => {
  it("segnala un ID di modello diverso dal default, con numero di riga", () => {
    const text = [
      "# Doc",
      "- Modello default: (`claude-sonnet-4-20250514` se env assente)",
    ].join("\n");

    expect(findModelDrift(text, "claude-sonnet-5")).toEqual([
      { line: 2, model: "claude-sonnet-4-20250514" },
    ]);
  });

  it("non segnala nulla quando tutti i riferimenti coincidono col default", () => {
    const text = "# ANTHROPIC_MODEL=claude-sonnet-5\nusa `claude-sonnet-5`.";
    expect(findModelDrift(text, "claude-sonnet-5")).toEqual([]);
  });

  it("non confonde claude-sonnet-5 con claude-sonnet-5-5 (ID più lungo)", () => {
    expect(
      findModelDrift("modello: claude-sonnet-5-5", "claude-sonnet-5"),
    ).toEqual([{ line: 1, model: "claude-sonnet-5-5" }]);
  });

  it("ignora testo che non è un ID di modello (es. 'claude-test', 'Claude Code')", () => {
    expect(
      findModelDrift(
        "claude-test e Claude Code non sono modelli",
        "claude-sonnet-5",
      ),
    ).toEqual([]);
  });
});
