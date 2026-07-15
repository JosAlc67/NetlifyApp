import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      // This app's data layer (lib/store.ts) is intentionally client-only
      // (localStorage), so pages must hydrate state after mount in an
      // effect. This is the correct pattern here, not an anti-pattern.
      "react-hooks/set-state-in-effect": "off",
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // server/ is a separate Node.js (CommonJS) backend, not part of the Next.js app.
    "server/**",
  ]),
]);

export default eslintConfig;
