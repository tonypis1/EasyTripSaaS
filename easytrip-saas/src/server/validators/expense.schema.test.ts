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
