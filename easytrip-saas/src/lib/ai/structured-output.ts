import type Anthropic from "@anthropic-ai/sdk";
import { transformJSONSchema } from "@anthropic-ai/sdk/lib/transform-json-schema";
import type { ZodTypeAny } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";

/**
 * `zodOutputFormat` dell'SDK Anthropic usa Zod v4: i nostri schemi sono Zod
 * v3, quindi convertiamo con `zod-to-json-schema` e passiamo il risultato
 * dallo stesso `transformJSONSchema` dell'SDK, che rimuove le keyword non
 * supportate dagli Structured Outputs (min/max su numeri e stringhe,
 * minItems > 1, pattern, ...) spostandole nella `description` come
 * suggerimento per il modello. Quei vincoli restano applicati lato server
 * dallo schema Zod originale: la decodifica vincolata garantisce la
 * *struttura*, non i limiti di valore.
 */

/**
 * Normalizza lo schema generato da zod-to-json-schema per gli Structured Outputs:
 * - `type: ["number", "null"]` (unioni di primitive) → `anyOf`, che è la forma attesa;
 * - tutte le proprietà diventano `required`: in Zod i campi con `.default()`
 *   sono opzionali, ma il prompt li chiede sempre (es. lat/lng, dowWarning) e
 *   uno schema che permette di ometterli renderebbe l'omissione più probabile.
 *   Zod continua ad accettare i default in fase di validazione.
 */
function normalizeNode(node: unknown): unknown {
  if (Array.isArray(node)) return node.map(normalizeNode);
  if (node === null || typeof node !== "object") return node;

  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(node)) {
    if (key === "default") continue;
    out[key] = normalizeNode(value);
  }

  if (out.properties && typeof out.properties === "object") {
    out.required = Object.keys(out.properties);
  }

  if (Array.isArray(out.type)) {
    const { type, ...rest } = out;
    return {
      ...rest,
      anyOf: (type as string[]).map((t) => ({ type: t })),
    };
  }
  return out;
}

/**
 * L'API supporta `enum` e `const`, ma `transformJSONSchema` (SDK 0.91) li
 * scarta (finiscono solo nella description): senza, la decodifica vincolata
 * non imporrebbe i valori ammessi (es. meal: "pranzo" | "cena"). Li
 * ripristina percorrendo in parallelo lo schema di origine e quello
 * trasformato, che ne condividono la forma.
 */
function restoreEnums(source: unknown, transformed: unknown): void {
  if (Array.isArray(source) && Array.isArray(transformed)) {
    source.forEach((s, i) => restoreEnums(s, transformed[i]));
    return;
  }
  if (
    source === null ||
    typeof source !== "object" ||
    transformed === null ||
    typeof transformed !== "object"
  ) {
    return;
  }

  const src = source as Record<string, unknown>;
  const dst = transformed as Record<string, unknown>;

  for (const keyword of ["enum", "const"]) {
    if (keyword in src && !(keyword in dst)) dst[keyword] = src[keyword];
  }

  for (const key of ["properties", "$defs"]) {
    const srcMap = src[key] as Record<string, unknown> | undefined;
    const dstMap = dst[key] as Record<string, unknown> | undefined;
    if (srcMap && dstMap) {
      for (const name of Object.keys(srcMap)) {
        restoreEnums(srcMap[name], dstMap[name]);
      }
    }
  }
  for (const key of ["items", "anyOf", "allOf"]) {
    restoreEnums(src[key], dst[key]);
  }
}

/**
 * `definitions`: sotto-schemi ripetuti (es. lo slot, presente 3 volte per
 * giorno) da dichiarare una volta in `$defs` e richiamare con `$ref`. Non è
 * solo una questione di dimensioni: con le copie inline l'API rifiuta lo
 * schema dell'itinerario ("The compiled grammar is too large", 400 —
 * verificato con l'API reale), con `$defs` lo accetta.
 */
export function jsonSchemaOutputFormat(
  schema: ZodTypeAny,
  definitions?: Record<string, ZodTypeAny>,
): Anthropic.Messages.JSONOutputFormat {
  const jsonSchema: Record<string, unknown> = {
    ...zodToJsonSchema(
      schema,
      definitions
        ? {
            target: "jsonSchema7",
            // "root": i `definitions` diventano `$ref: "#/$defs/<nome>"`.
            $refStrategy: "root",
            definitionPath: "$defs",
            definitions,
          }
        : { target: "jsonSchema7", $refStrategy: "none" },
    ),
  };
  delete jsonSchema.$schema;

  const normalized = normalizeNode(jsonSchema) as Record<string, unknown>;
  const transformed = transformJSONSchema(normalized);
  restoreEnums(normalized, transformed);

  return { type: "json_schema", schema: transformed };
}
