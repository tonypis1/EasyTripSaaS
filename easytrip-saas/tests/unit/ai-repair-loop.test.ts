import { describe, expect, it, vi } from "vitest";
import { buildRepairSuffix, generateWithRepair } from "@/lib/ai/repairLoop";

describe("buildRepairSuffix", () => {
  it("include il motivo dell'errore e il frammento della risposta precedente", () => {
    const text = buildRepairSuffix('{"bad": true}', "campo mancante: title");

    expect(text).toContain("non ha superato la validazione");
    expect(text).toContain("campo mancante: title");
    expect(text).toContain('{"bad": true}');
    expect(text).toContain("OUTPUT ATTESO");
  });

  it("tronca frammenti molto lunghi per mitigare prompt injection via output precedente", () => {
    const longRaw = "x".repeat(5000);
    const text = buildRepairSuffix(longRaw, "errore");

    expect(text).toContain("[troncato per sicurezza]");
    expect(text.length).toBeLessThan(longRaw.length);
  });
});

describe("generateWithRepair", () => {
  it("ritorna il risultato al primo tentativo se valido (nessuna riparazione)", async () => {
    const callModel = vi.fn().mockResolvedValue("raw-ok");
    const parse = vi.fn().mockReturnValue({ value: 42 });

    const result = await generateWithRepair({
      maxAttempts: 3,
      callModel,
      parse,
    });

    expect(result).toEqual({ value: 42 });
    expect(callModel).toHaveBeenCalledTimes(1);
    expect(callModel).toHaveBeenCalledWith(null);
  });

  it("ritenta con un suffisso di riparazione quando il primo parse fallisce, e ritorna il risultato riparato", async () => {
    const callModel = vi
      .fn()
      .mockResolvedValueOnce("raw-invalido")
      .mockResolvedValueOnce("raw-valido");
    const parse = vi
      .fn()
      .mockImplementationOnce(() => {
        throw new Error("schema non conforme: campo mancante");
      })
      .mockImplementationOnce(() => ({ value: 1 }));

    const result = await generateWithRepair({
      maxAttempts: 2,
      callModel,
      parse,
    });

    expect(result).toEqual({ value: 1 });
    expect(callModel).toHaveBeenCalledTimes(2);
    // Il secondo tentativo riceve un suffisso di riparazione (non null) che
    // include il motivo del fallimento e il frammento del tentativo precedente.
    const secondCallArg = callModel.mock.calls[1][0] as string;
    expect(secondCallArg).toContain("schema non conforme: campo mancante");
    expect(secondCallArg).toContain("raw-invalido");
  });

  it("lancia l'errore dell'ultimo tentativo se il parse fallisce per tutti i maxAttempts", async () => {
    const callModel = vi.fn().mockResolvedValue("sempre-invalido");
    const lastError = new Error("ultimo motivo di fallimento");
    const parse = vi
      .fn()
      .mockImplementationOnce(() => {
        throw new Error("primo motivo di fallimento");
      })
      .mockImplementationOnce(() => {
        throw lastError;
      });

    await expect(
      generateWithRepair({ maxAttempts: 2, callModel, parse }),
    ).rejects.toBe(lastError);
    expect(callModel).toHaveBeenCalledTimes(2);
  });

  it("non ritenta se è callModel (non parse) a lanciare un errore — un problema di rete non si ripara col prompt", async () => {
    const networkError = new Error("connessione persa");
    const callModel = vi.fn().mockRejectedValue(networkError);
    const parse = vi.fn();

    await expect(
      generateWithRepair({ maxAttempts: 3, callModel, parse }),
    ).rejects.toBe(networkError);
    expect(callModel).toHaveBeenCalledTimes(1);
    expect(parse).not.toHaveBeenCalled();
  });
});
