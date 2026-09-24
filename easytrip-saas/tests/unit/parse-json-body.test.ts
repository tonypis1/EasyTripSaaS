import { describe, expect, it } from "vitest";
import {
  parseJsonBody,
  parseOptionalJsonBody,
} from "@/server/controllers/parseJsonBody";

function req(body: string) {
  return new Request("http://localhost/api/x", { method: "POST", body });
}

describe("parseJsonBody", () => {
  it("ritorna il body parsato quando il JSON è valido", async () => {
    const result = await parseJsonBody(req(JSON.stringify({ a: 1 })));
    expect(result).toEqual({ a: 1 });
  });

  it("lancia AppError 400 INVALID_JSON su body non parsabile", async () => {
    await expect(parseJsonBody(req("not-json"))).rejects.toMatchObject({
      statusCode: 400,
      code: "INVALID_JSON",
    });
  });
});

describe("parseOptionalJsonBody", () => {
  it("ritorna il body parsato quando il JSON è valido", async () => {
    const result = await parseOptionalJsonBody(req(JSON.stringify({ a: 1 })));
    expect(result).toEqual({ a: 1 });
  });

  it("ritorna {} quando il body è vuoto", async () => {
    const result = await parseOptionalJsonBody(req(""));
    expect(result).toEqual({});
  });

  it("lancia AppError 400 INVALID_JSON su body non vuoto e non parsabile", async () => {
    await expect(parseOptionalJsonBody(req("not-json"))).rejects.toMatchObject({
      statusCode: 400,
      code: "INVALID_JSON",
    });
  });
});
