import { describe, expect, it } from "vitest";
import { createExpenseSchema } from "./expense.schema";

describe("createExpenseSchema", () => {
  it("accetta spesa valida", () => {
    const r = createExpenseSchema.parse({
      description: "Cena",
      amount: 42.5,
      category: "cibo",
      splitEqually: true,
    });
    expect(r.amount).toBe(42.5);
    expect(r.category).toBe("cibo");
  });

  it("rifiuta importo non positivo", () => {
    expect(() =>
      createExpenseSchema.parse({
        description: "X",
        amount: 0,
      }),
    ).toThrow();
  });
});

describe("createExpenseSchema — partecipanti e quote", () => {
  const base = { description: "Cena", amount: 60, category: "cibo" as const };

  it("accetta una lista di partecipanti con peso, e assegna peso 1 se omesso", () => {
    const r = createExpenseSchema.parse({
      ...base,
      participants: [{ memberId: "m1", weight: 2 }, { memberId: "m2" }],
    });

    expect(r.participants).toEqual([
      { memberId: "m1", weight: 2 },
      { memberId: "m2", weight: 1 },
    ]);
  });

  it("senza partecipanti la spesa resta divisa tra tutti (campo assente)", () => {
    expect(createExpenseSchema.parse(base).participants).toBeUndefined();
  });

  it("arrotonda il peso a 2 decimali", () => {
    const r = createExpenseSchema.parse({
      ...base,
      participants: [
        { memberId: "m1", weight: 1.234 },
        { memberId: "m2", weight: 2.678 },
      ],
    });
    expect(r.participants?.map((p) => p.weight)).toEqual([1.23, 2.68]);
  });

  it.each([
    ["peso zero", [{ memberId: "m1", weight: 0 }]],
    ["peso negativo", [{ memberId: "m1", weight: -1 }]],
    ["peso oltre 100", [{ memberId: "m1", weight: 101 }]],
    ["lista vuota", []],
    [
      "partecipante duplicato",
      [
        { memberId: "m1", weight: 1 },
        { memberId: "m1", weight: 2 },
      ],
    ],
  ])("rifiuta %s", (_label, participants) => {
    expect(() =>
      createExpenseSchema.parse({ ...base, participants }),
    ).toThrow();
  });

  it("rifiuta partecipanti su una spesa personale (splitEqually=false)", () => {
    expect(() =>
      createExpenseSchema.parse({
        ...base,
        splitEqually: false,
        participants: [{ memberId: "m1", weight: 1 }],
      }),
    ).toThrow(/personale/);
  });
});
