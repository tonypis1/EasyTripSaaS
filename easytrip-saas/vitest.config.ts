import path from "node:path";
import { defineConfig } from "vitest/config";

const alias = { "@": path.resolve(__dirname, "./src") };

/**
 * Soglia 80% applicata solo a questi file (coperti da test unit + integration mirati).
 * Estendere l’elenco quando slotReplace/liveSuggest/generate-itinerary hanno test dedicati.
 */
const criticalCoverageInclude = [
  "src/lib/itinerary-model-schema.ts",
  "src/lib/calendar-date.ts",
  "src/lib/geo-privacy.ts",
  "src/lib/redact-pii.ts",
];

export default defineConfig({
  resolve: { alias },
  test: {
    coverage: {
      provider: "v8",
      reporter: ["text", "json-summary", "html"],
      include: criticalCoverageInclude,
      exclude: ["**/*.test.ts", "**/*.config.*"],
      thresholds: {
        lines: 80,
        functions: 75,
        branches: 70,
        statements: 80,
      },
    },
    projects: [
      {
        resolve: { alias },
        test: {
          name: "unit",
          environment: "node",
          include: ["src/**/*.test.ts", "tests/unit/**/*.ts"],
          globals: false,
        },
      },
      {
        resolve: { alias },
        test: {
          name: "integration",
          environment: "node",
          include: ["tests/integration/**/*.test.ts"],
          globals: false,
          fileParallelism: false,
          maxWorkers: 1,
        },
      },
    ],
  },
});
