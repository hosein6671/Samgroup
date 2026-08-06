# @sam-group/config

Placeholder package. Intended future contents, per [PROJECT_STRUCTURE.md](../../docs/PROJECT_STRUCTURE.md):

- Shared Tailwind config — deferred until `apps/web` is actually scaffolded with Next.js (out of scope for the current bootstrap step).
- Any other shared, framework-agnostic runtime configuration (e.g. shared constants, environment variable schema) that doesn't belong in `@sam-group/tsconfig` or `@sam-group/eslint-config`.

ESLint and TypeScript config were split out into their own dedicated packages (`@sam-group/eslint-config`, `@sam-group/tsconfig`) rather than living here, following standard Turborepo convention — this package holds only what's left over.
