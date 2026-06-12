// Deliberately small, high-signal lint config. Prettier owns style; this file
// enforces the project's structural rules:
//   - the 500-line hard cap per source file (split into focused modules)
//   - type-only imports stay `import type` (keeps madge/runtime cycles honest)
//   - the typescript-eslint recommended baseline, minus rules that fight the
//     codebase's established patterns (declaration-merge method modules, Phaser
//     namespace types, intentional empty interfaces).
import js from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["dist/", "public/", "node_modules/", ".claude/", "logs/"] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["**/*.ts", "**/*.mts"],
    rules: {
      // The project's hard rule: never leave a source file over 500 lines.
      "max-lines": ["error", { max: 500, skipBlankLines: true, skipComments: true }],
      "@typescript-eslint/consistent-type-imports": ["error", { fixStyle: "inline-type-imports" }],
      // BattleState/BattleScene use declaration merging: `interface X extends …{}`
      // with methods merged onto the prototype via Object.assign — deliberate
      // (see memory project_god_class_split_pattern); both rules fire on it.
      "@typescript-eslint/no-empty-object-type": ["error", { allowInterfaces: "always" }],
      "@typescript-eslint/no-unsafe-declaration-merging": "off",
      // `_`-prefixed = intentionally unused (event handler params etc.).
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_", caughtErrorsIgnorePattern: "^_" },
      ],
      // Catalog/data files legitimately use `any` in a few generic seams; keep
      // it visible but non-blocking.
      "@typescript-eslint/no-explicit-any": "warn",
    },
  },
  {
    // Node scripts (.mjs) — looser: console tools, no TS types.
    files: ["scripts/**/*.mjs", "*.mjs"],
    languageOptions: {
      globals: {
        process: "readonly",
        console: "readonly",
        Buffer: "readonly",
        URL: "readonly",
        fetch: "readonly",
        setTimeout: "readonly",
        clearTimeout: "readonly",
        setInterval: "readonly",
        clearInterval: "readonly",
        AbortController: "readonly",
        TextDecoder: "readonly",
        TextEncoder: "readonly",
        crypto: "readonly",
        performance: "readonly",
        WebSocket: "readonly",
      },
    },
    rules: {
      "max-lines": ["error", { max: 500 }],
      "@typescript-eslint/no-unused-vars": "off",
      "no-unused-vars": ["error", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
    },
  },
);
