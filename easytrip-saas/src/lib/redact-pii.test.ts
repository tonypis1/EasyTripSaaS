import { describe, expect, it } from "vitest";
import { redactEmail } from "./redact-pii";

describe("redactEmail", () => {
  it("maschera la parte locale mantenendo il dominio", () => {
    expect(redactEmail("mario.rossi@example.com")).toBe("m***@example.com");
  });

  it("gestisce email invalide senza esporre contenuto", () => {
    expect(redactEmail("not-an-email")).toBe("[email_redacted]");
    expect(redactEmail("@onlydomain.com")).toBe("[email_redacted]");
  });
});
