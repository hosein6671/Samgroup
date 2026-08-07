// Root ESLint flat config (ESLint 10). Covers workspace-level files that belong to no app:
// the shared packages' sources plus the repo's own tooling config.
// Each app adds its own eslint.config.js extending @sam-group/eslint-config once it is
// scaffolded — framework rules (Next.js, NestJS, Payload) live there, not here.
const samGroup = require("@sam-group/eslint-config");
const prettier = require("eslint-config-prettier/flat");

module.exports = [
  {
    // node_modules is ignored by flat config already; these are the generated outputs.
    ignores: ["**/dist/**", "**/build/**", "**/.next/**", "**/.turbo/**", "**/coverage/**"],
  },
  ...samGroup,
  // Must stay last: disables any stylistic rule that would fight Prettier. A no-op against the
  // current rule set — it is here so app configs added later cannot reintroduce a formatting conflict.
  prettier,
];
