import { describe, expect, it } from "vitest";
import { z } from "zod";
import { jsonSchemaOutputFormat } from "@/lib/ai/structured-output";
import { ITINERARY_OUTPUT_FORMAT } from "@/lib/ai/itinerary-output-format";
import {
  DayPlanExtendedSchema,
  DaySlotSchema,
  RestaurantEntrySchema,
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
    if (key === "$ref" && !String(value).startsWith("#/$defs/")) {
      violations.push(`${path}.$ref=${value} (solo #/$defs/...)`);
    }
    violations.push(...collectViolations(value, `${path}.${key}`));
  }
  return violations;
}

const format = ITINERARY_OUTPUT_FORMAT;
const schema = format.schema as Node;
const defs = (schema.$defs ?? {}) as Record<string, Node>;

/** Segue un `$ref` locale (`#/$defs/<nome>`); gli altri nodi restano invariati. */
function deref(node: Node): Node {
  const ref = node.$ref as string | undefined;
  return ref ? defs[ref.replace("#/$defs/", "")] : node;
}

function countRefs(node: unknown): Record<string, number> {
  const counts: Record<string, number> = {};
  JSON.stringify(node, (key, value) => {
    if (key === "$ref") counts[value] = (counts[value] ?? 0) + 1;
    return value;
  });
  return counts;
}

const dayNode = (schema.properties as Node).days as Node;
const dayItems = dayNode.items as Node;
const dayProps = dayItems.properties as Record<string, Node>;
const slotNode = deref(dayProps.morning);
const slotProps = slotNode.properties as Record<string, Node>;
const restaurantNode = deref(dayProps.restaurants.items as Node);

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

  it("dichiara slot e ristorante una sola volta in $defs (inline l'API rifiuta lo schema: grammatica troppo grande)", () => {
    expect(Object.keys(defs).sort()).toEqual(["restaurant", "slot"]);
    expect(countRefs(schema)).toEqual({
      "#/$defs/slot": 3,
      "#/$defs/restaurant": 1,
    });
    expect(dayProps.morning).toEqual({ $ref: "#/$defs/slot" });
    expect(dayProps.afternoon).toEqual({ $ref: "#/$defs/slot" });
    expect(dayProps.evening).toEqual({ $ref: "#/$defs/slot" });
    // Nessuna copia inline dello slot rimasta nello schema.
    expect(JSON.stringify(schema).match(/"googleMapsQuery":/g)).toHaveLength(1);
  });

  it("rispecchia esattamente i campi dello schema Zod (nessun drift tra Zod e JSON Schema)", () => {
    expect(Object.keys(dayProps).sort()).toEqual(
      Object.keys(DayPlanExtendedSchema.shape).sort(),
    );
    expect(Object.keys(slotProps).sort()).toEqual(
      Object.keys(DaySlotSchema.shape).sort(),
    );
    expect(Object.keys(restaurantNode.properties as Node).sort()).toEqual(
      Object.keys(RestaurantEntrySchema.shape).sort(),
    );
  });

  it("rende obbligatori anche i campi con default in Zod (lat/lng, dowWarning, ...)", () => {
    expect(dayItems.required).toEqual(expect.arrayContaining(["dowWarning"]));
    expect(slotNode.required).toEqual(
      expect.arrayContaining(["lat", "lng", "bookingLink"]),
    );
    expect(slotNode.additionalProperties).toBe(false);
  });

  it("esprime i campi nullable come anyOf (mai come type array)", () => {
    const lat = slotProps.lat;
    expect(lat.anyOf).toEqual([{ type: "number" }, { type: "null" }]);
    expect(lat.type).toBeUndefined();
  });

  it("mantiene il formato uri sul bookingLink (nullable)", () => {
    const link = slotProps.bookingLink;
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

  it("dietaryFit è un array obbligatorio i cui valori sono vincolati all'enum delle diete (enum annidato ripristinato)", () => {
    const fit = (restaurantNode.properties as Record<string, Node>).dietaryFit;

    expect(restaurantNode.required).toEqual(
      expect.arrayContaining(["dietaryFit"]),
    );
    expect(fit.type).toBe("array");
    expect((fit.items as Node).enum).toEqual([
      "vegetarian",
      "vegan",
      "gluten_free",
      "lactose_free",
      "halal",
      "kosher",
    ]);
  });

  it("mantiene gli enum (pranzo/cena)", () => {
    const meal = (restaurantNode.properties as Record<string, Node>).meal;
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

  it("senza definitions non produce $ref né $defs (tutto inline)", () => {
    const shared = z.object({ x: z.string() });
    const out = jsonSchemaOutputFormat(z.object({ a: shared, b: shared }));
    expect(countRefs(out.schema)).toEqual({});
    expect(out.schema.$defs).toBeUndefined();
  });

  it("con definitions sposta in $defs i sotto-schemi indicati e normalizza anche quelli", () => {
    const shared = z.object({ x: z.string(), n: z.number().nullable() });
    const out = jsonSchemaOutputFormat(z.object({ a: shared, b: shared }), {
      shared,
    });
    const outDefs = out.schema.$defs as Record<string, Node>;

    expect(countRefs(out.schema)).toEqual({ "#/$defs/shared": 2 });
    expect(outDefs.shared.required).toEqual(["x", "n"]);
    expect(outDefs.shared.additionalProperties).toBe(false);
    expect((outDefs.shared.properties as Record<string, Node>).n.anyOf).toEqual(
      [{ type: "number" }, { type: "null" }],
    );
  });

  it("converte uno schema semplice e ne rende obbligatori tutti i campi", () => {
    const out = jsonSchemaOutputFormat(
      z.object({ a: z.string(), b: z.number().default(1) }),
    );
    expect(out.schema.required).toEqual(["a", "b"]);
    expect(out.schema.additionalProperties).toBe(false);
  });
});
