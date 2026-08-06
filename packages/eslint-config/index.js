// @sam-group/eslint-config — base flat config (ESLint 10), extended by every app's own eslint.config.js.
// Framework-specific rules (Next.js, NestJS, Payload) are intentionally not here — each app adds
// those when it's actually scaffolded, per CODING_STANDARDS.md. This base only encodes the rules
// that apply everywhere: no `any`, explicit return types on exported functions.
const tseslint = require("typescript-eslint");

module.exports = tseslint.config({
  rules: {
    "@typescript-eslint/no-explicit-any": "error",
    "@typescript-eslint/explicit-function-return-type": [
      "warn",
      { allowExpressions: true },
    ],
  },
});
