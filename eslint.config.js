// Root ESLint flat config (ESLint 10). Covers workspace-level files that belong to no app:
// the shared packages' sources plus the repo's own tooling config.
// Each app adds its own eslint.config.js extending @sam-group/eslint-config once it is
// scaffolded — framework rules (Next.js, NestJS, Payload) live there, not here.
const samGroup = require("@sam-group/eslint-config");
const prettier = require("eslint-config-prettier/flat");

module.exports = [
  {
    // node_modules is ignored by flat config already; these are the generated outputs.
    // apps/api/src/prisma/generated holds the Prisma 7 client, which is emitted into the
    // repository rather than node_modules since an explicit generator output path became
    // required.
    ignores: [
      "**/dist/**",
      "**/build/**",
      "**/.next/**",
      "**/.turbo/**",
      "**/coverage/**",
      "apps/api/src/prisma/generated/**",
      // Payload's generated artifacts, emitted into the repository by `payload generate:types` and
      // `payload generate:importmap` and required by the build. `payload-types.ts` contains `any`
      // in the Lexical node shape, which is Payload's schema, not a choice this project makes.
      "apps/cms/src/payload-types.ts",
      "apps/cms/src/app/(payload)/admin/importMap.js",
    ],
  },
  ...samGroup,
  // Must stay last: disables any stylistic rule that would fight Prettier. A no-op against the
  // current rule set — it is here so app configs added later cannot reintroduce a formatting conflict.
  prettier,
];
