import { describe, expect, it } from "vitest";
import { httpUrlSchema } from "@/lib/safe-url";

describe("httpUrlSchema", () => {
  it("accetta URL http e https", () => {
    expect(httpUrlSchema.safeParse("https://example.com").success).toBe(true);
    expect(httpUrlSchema.safeParse("http://example.com/path?q=1").success).toBe(
      true,
    );
  });

  it.each([
    "javascript:alert(1)",
    "javascript:alert(document.cookie)",
    "data:text/html,<script>alert(1)</script>",
    "vbscript:msgbox(1)",
    "file:///etc/passwd",
  ])("rifiuta lo schema %s", (value) => {
    expect(httpUrlSchema.safeParse(value).success).toBe(false);
  });

  it("rifiuta stringhe non-URL", () => {
    expect(httpUrlSchema.safeParse("non un url").success).toBe(false);
    expect(httpUrlSchema.safeParse("").success).toBe(false);
  });
});
