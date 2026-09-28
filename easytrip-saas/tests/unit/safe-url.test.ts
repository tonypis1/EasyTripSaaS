import { describe, expect, it } from "vitest";
import { httpUrlSchema, isKnownBookingDomain } from "@/lib/safe-url";

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

describe("isKnownBookingDomain", () => {
  it.each([
    "https://www.getyourguide.com/roma-l161/",
    "https://www.thefork.it/ristorante/x",
    "https://www.thefork.com/restaurant/x",
    "https://www.viator.com/tours/Rome/x",
    "https://www.tiqets.com/en/rome-attractions",
    "https://www.booking.com/hotel/it/x.html",
    "https://it.musement.com/x",
    "https://www.civitatis.com/it/roma/",
  ])("riconosce %s come dominio di prenotazione noto", (url) => {
    expect(isKnownBookingDomain(url)).toBe(true);
  });

  it("riconosce un sottodominio di un dominio noto", () => {
    expect(isKnownBookingDomain("https://booking.thefork.it/reserve/x")).toBe(
      true,
    );
  });

  it("NON riconosce il sito ufficiale (legittimo) di un singolo POI", () => {
    expect(isKnownBookingDomain("https://www.colosseo.it/biglietti")).toBe(
      false,
    );
  });

  it("NON riconosce un dominio che include il nome ma non corrisponde all'host (es. sottostringa nel path)", () => {
    expect(
      isKnownBookingDomain("https://evil.com/getyourguide.com/phishing"),
    ).toBe(false);
  });

  it("NON si fa ingannare da un dominio che termina in modo simile ma non è un sottodominio reale", () => {
    expect(isKnownBookingDomain("https://notgetyourguide.com/x")).toBe(false);
  });

  it("ritorna false per stringhe non-URL senza lanciare eccezioni", () => {
    expect(isKnownBookingDomain("non un url")).toBe(false);
    expect(isKnownBookingDomain("")).toBe(false);
  });
});
