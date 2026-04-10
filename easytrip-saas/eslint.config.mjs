import { defineConfig, globalIgnores } from "eslint/config";
import eslintConfigPrettier from "eslint-config-prettier";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "coverage/**",
    "next-env.d.ts",
    "scripts/**",
  ]),
  {
    files: ["src/app/page.tsx"],
    rules: {
      "react/no-unescaped-entities": "off",
    },
  },
  {
    files: [
      "src/app/app/user-button-client.tsx",
      "src/app/posthog-provider.tsx",
    ],
    rules: {
      "react-hooks/set-state-in-effect": "off",
    },
  },
  {
    files: ["src/**/*.{ts,tsx}"],
    rules: {
      eqeqeq: ["warn", "always", { null: "ignore" }],
      "no-console": ["warn", { allow: ["warn", "error", "info"] }],
      "prefer-const": "warn",
    },
  },
  {
    files: ["tests/**/*.{ts,tsx}", "**/*.test.{ts,tsx}"],
    rules: {
      "no-console": "off",
    },
  },
  eslintConfigPrettier,
]);

export default eslintConfig;
