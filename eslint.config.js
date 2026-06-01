import eslint from "@eslint/js";
import tseslint from "typescript-eslint";
import globals from "globals";

export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    ignores: [
      "**/dist/**",
      "**/node_modules/**",
      "**/.next/**",
      "**/*.config.*",
      "**/drizzle/**",
      "**/*.d.ts",
    ],
  },
  {
    rules: {
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/consistent-type-imports": "warn",
      "no-console": "warn",
    },
  },
  {
    files: ["scripts/**/*.mjs"],
    languageOptions: {
      globals: { ...globals.node },
    },
    rules: {
      "no-undef": "off",
      "@typescript-eslint/no-require-imports": "off",
    },
  },
  {
    files: ["apps/api/src/db/**/*.ts"],
    rules: {
      "no-console": "off",
    },
  },
  {
    files: ["scripts/**/*.mjs", "apps/api/src/db/**/*.ts"],
    rules: {
      "no-console": "off",
    },
  },
  {
    files: ["**/*.test.ts", "**/*.test.tsx"],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
    },
  },
);
