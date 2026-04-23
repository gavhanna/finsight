//  @ts-check

import { tanstackConfig } from "@tanstack/eslint-config"
import reactHooks from "eslint-plugin-react-hooks"

export default [
  ...tanstackConfig,
  reactHooks.configs.flat["recommended-latest"],
  {
    ignores: [".output/**", "dist/**", "public/sw.js"],
  },
  {
    files: ["**/*.{js,ts,tsx}"],
    rules: {
      "sort-imports": "off",
      "import/order": "off",
      "import/first": "off",
      "import/no-duplicates": "off",
      "import/consistent-type-specifier-style": "off",
      "@typescript-eslint/array-type": "off",
      "@typescript-eslint/no-unnecessary-condition": "off",
      "@typescript-eslint/no-unnecessary-type-assertion": "off",
      "@typescript-eslint/method-signature-style": "off",
      "@typescript-eslint/require-await": "off",
      "node/prefer-node-protocol": "off",
      "no-shadow": "off",
      "prefer-const": "off",
      "react-hooks/exhaustive-deps": "off",
      "react-hooks/preserve-manual-memoization": "off",
    },
  },
]
