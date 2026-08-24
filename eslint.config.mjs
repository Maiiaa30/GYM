import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { FlatCompat } from "@eslint/eslintrc";

const compat = new FlatCompat({
  baseDirectory: dirname(fileURLToPath(import.meta.url)),
});

/**
 * `npm run lint` used to be `next lint`, which is deprecated and, with no
 * configuration file present, only ever opened an interactive prompt — so the
 * project had never actually been linted.
 */
const config = [
  {
    // `next-env.d.ts` and `src/data/catalogue.json` are generated.
    ignores: [
      ".next/**",
      "node_modules/**",
      "next-env.d.ts",
      "public/sw.js",
      "src/data/**",
    ],
  },
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    rules: {
      // Unused code should fail the check, but an argument deliberately named
      // `_prev` — the shape `useActionState` requires — is not a mistake.
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
    },
  },
];

export default config;
