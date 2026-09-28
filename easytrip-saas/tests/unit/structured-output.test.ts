import { describe, expect, it } from "vitest";
import { z } from "zod";
import { jsonSchemaOutputFormat } from "@/lib/ai/structured-output";
import {
  DayPlanExtendedSchema,
  DaySlotSchema,
  ModelResponseSchema,
} from "@/lib/itinerary-model-schema";

type Node = Record<string, unknown>;

/** Keyword che gli Structured Outputs non supportano (l'API risponde 400 se restano nello schema). */
const UNSUPPORTED_KEYWORDS = [
  "minimum",
  "maximum",
  "exclusiveMinimum",
  "exclusiveMaximum",
  "multipleOf",
  "minLength",
  "maxLength",
  "maxItems",
  "pattern",
  "$ref",
  "$schema",
  "default",
];

function collectViolations(node: unknown, path = "$"): string[] {
  if (Array.isArray(node)) {
    return node.flatMap((n, i) => collectViolations(n, `${path}[${i}]`));
  }
  if (node === null || typeof node !== "object") return [];

  const violations: string[] = [];
  for (const [key, value] of Object.entries(node as Node)) {
    if (UNSUPPORTED_KEYWORDS.includes(key)) violations.push(`${path}.${key}`);
    if (key === "minItems" && (value as number) > 1) {
      violations.push(`${path}.minItems=${value}`);
    }
    if (key === "type" && typeof value !== "string") {
      violations.push(`${path}.type non è una stringa`);
    }
    violations.push(...collectViolations(value, `${path}.${key}`));
  }
  return violations;
}

const format = jsonSchemaOutputFormat(ModelResponseSchema);
const schema = format.schema as Node;
const dayNode = (schema.properties as Node).days as Node;
const dayItems = dayNode.items as Node;
const dayProps = dayItems.properties as Record<string, Node>;

describe("jsonSchemaOutputFormat — schema dell'itinerario", () => {
  it("produce un json_schema con oggetto radice chiuso (additionalProperties: false)", () => {
    expect(format.type).toBe("json_schema");
    expect(schema.type).toBe("object");
    expect(schema.additionalProperties).toBe(false);
    expect(schema.required).toEqual(["optimizationScore", "days"]);
  });

  it("non contiene keyword non supportate dagli Structured Outputs", () => {
    expect(collectViolations(schema)).toEqual([]);
  });

  it("rispecchia esattamente i campi dello schema Zod (nessun drift tra Zod e JSON Schema)", () => {
    expect(Object.keys(dayProps).sort()).toEqual(
      Object.keys(DayPlanExtendedSchema.shape).sort(),
    );
    const slotProps = (dayProps.morning.properties ?? {}) as Node;
    expect(Object.keys(slotProps).sort()).toEqual(
      Object.keys(DaySlotSchema.shape).sort(),
    );
  });

  it("rende obbligatori anche i campi con default in Zod (lat/lng, dowWarning, ...)", () => {
    expect(dayItems.required).toEqual(expect.arrayContaining(["dowWarning"]));
    expect(dayProps.morning.required).toEqual(
      expect.arrayContaining(["lat", "lng", "bookingLink"]),
    );
  });

  it("esprime i campi nullable come anyOf (mai come type array)", () => {
    const lat = (dayProps.morning.properties as Record<string, Node>).lat;
    expect(lat.anyOf).toEqual([{ type: "number" }, { type: "null" }]);
    expect(lat.type).toBeUndefined();
  });

  it("mantiene il formato uri sul bookingLink (nullable)", () => {
    const link = (dayProps.morning.properties as Record<string, Node>)
      .bookingLink;
    expect(link.anyOf).toEqual([
      { type: "string", format: "uri" },
      { type: "null" },
    ]);
  });

  it("sposta i vincoli non supportati nella description come suggerimento (es. 2-4 ristoranti)", () => {
    expect(dayProps.restaurants.type).toBe("array");
    expect(dayProps.restaurants.description).toContain("minItems: 2");
    expect(dayProps.restaurants.description).toContain("maxItems: 4");
  });

  it("mantiene gli enum (pranzo/cena)", () => {
    const meal = (
      (dayProps.restaurants.items as Node).properties as Record<string, Node>
    ).meal;
    expect(meal.enum).toEqual(["pranzo", "cena"]);
  });
});

describe("jsonSchemaOutputFormat — casi generici", () => {
  it("ripristina enum e const scartati dal trasformatore dell'SDK, anche dentro array e anyOf", () => {
    const out = jsonSchemaOutputFormat(
      z.object({
        kind: z.literal("x"),
        list: z.array(z.object({ meal: z.enum(["a", "b"]) })),
        maybe: z.enum(["c", "d"]).nullable(),
      }),
    );
    const props = out.schema.properties as Record<string, Node>;

    expect(props.kind.const).toBe("x");
    expect(
      ((props.list.items as Node).properties as Record<string, Node>).meal.enum,
    ).toEqual(["a", "b"]);
    expect((props.maybe.anyOf as Node[])[0].enum).toEqual(["c", "d"]);
  });

  it("converte uno schema semplice e ne rende obbligatori tutti i campi", () => {
    const out = jsonSchemaOutputFormat(
      z.object({ a: z.string(), b: z.number().default(1) }),
    );
    expect(out.schema.required).toEqual(["a", "b"]);
    expect(out.schema.additionalProperties).toBe(false);
  });
});
