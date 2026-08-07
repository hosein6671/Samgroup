// @sam-group/eslint-config — base flat config (ESLint 10), extended by every app's own eslint.config.js.
// Framework-specific rules (Next.js, NestJS, Payload) are intentionally not here — each app adds
// those when it's actually scaffolded, per CODING_STANDARDS.md. This base only encodes the rules
// that apply everywhere: no `any`, explicit return types on exported functions.
//
// The plugin and parser must be registered in the same config object as the rules themselves —
// flat config resolves rule prefixes per-object, not globally, so declaring the rules alone makes
// ESLint fail with "could not find plugin @typescript-eslint".
// Both rules below are syntactic, so no type-aware program is required; apps that want type-aware
// linting opt in with their own `parserOptions.projectService`.
const tseslint = require("typescript-eslint");

module.exports = tseslint.config({
  files: ["**/*.{ts,tsx,mts,cts}"],
  plugins: {
    "@typescript-eslint": tseslint.plugin,
  },
  languageOptions: {
    parser: tseslint.parser,
  },
  rules: {
    "@typescript-eslint/no-explicit-any": "error",
    "@typescript-eslint/explicit-function-return-type": ["warn", { allowExpressions: true }],
  },
});
