# @sam-group/config

Shared, framework-agnostic build configuration. ESLint and TypeScript config live in their own
packages (`@sam-group/eslint-config`, `@sam-group/tsconfig`) per standard Turborepo convention;
this package holds what is left over.

## Contents

| Export                       | File                  | Purpose                                       |
| ---------------------------- | --------------------- | --------------------------------------------- |
| `@sam-group/config/tailwind` | `tailwind/preset.css` | The platform's single Tailwind v4 entry point |
| `@sam-group/config/postcss`  | `postcss.config.mjs`  | Shared PostCSS plugin configuration           |

## Use from an app

In the app's global stylesheet:

```css
@import "@sam-group/config/tailwind";
```

In the app's `postcss.config.mjs`:

```js
export { default } from "@sam-group/config/postcss";
```

## What this package does not hold

**Token values.** They are authored in `@sam-group/ui` (`src/tokens/*.ts`) and generated into
`theme.generated.css`, which `tailwind/preset.css` imports. This package consumes design tokens;
it never defines them. One value, every consumer — including the non-CSS consumers (Mapbox style
JSON, Canvas 2D, Open Graph image generation) that import the TypeScript tokens directly and
cannot read a Tailwind class.

See [docs/frontend/FRONTEND_ARCHITECTURE.md](../../docs/frontend/FRONTEND_ARCHITECTURE.md)
section 6 and [docs/PROJECT_STRUCTURE.md](../../docs/PROJECT_STRUCTURE.md).
