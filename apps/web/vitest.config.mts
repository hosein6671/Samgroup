import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

/**
 * `apps/web`'s test runner.
 *
 * TESTING_STRATEGY.md names Vitest for this app; until this gate it was named and not installed, so
 * the app had no test script and no test file at all. This is the smallest configuration that makes
 * the documented runner execute.
 *
 * ── `environment: "node"`, deliberately ─────────────────────────────────────
 *
 * Every subject under test here is server-side: cookie attributes, middleware, the session
 * boundary, the Server Actions and the API client. None of them touches a DOM, so `jsdom` would be
 * a dependency that no assertion needs. The one rendering concern in this gate — that no token
 * reaches the rendered output — is answered by walking the returned React element tree, which is
 * both dependency-free and a stronger check than querying a mounted DOM: it inspects prop values a
 * renderer would never have emitted as text.
 *
 * React Testing Library is likewise not installed. It is the right tool for the interactive Admin
 * components a later gate builds, and it has nothing to do in a gate whose components are one
 * uncontrolled form and two static panels.
 *
 * ── `.mts`, not `.ts` ───────────────────────────────────────────────────────
 *
 * The app has no `"type": "module"`, so a `.ts` config is loaded as CommonJS and Vite warns that
 * its ESM syntax will stop working when the native config loader becomes the default. The
 * extension is the documented fix and changes nothing else.
 *
 * ── `oxc.jsx.runtime` is required ───────────────────────────────────────────
 *
 * The app's `tsconfig.json` sets `jsx: "preserve"` because Next compiles JSX with its own SWC
 * pipeline. Vitest 4 transforms with oxc, which **does** inherit that setting and consequently
 * emitted untransformed JSX into a Node module — a parse error, not a subtle one. Naming the
 * automatic runtime here overrides it for this runner only and leaves the build untouched.
 *
 * It has to be the `oxc` key rather than `esbuild`: Vitest 4 ignores esbuild options entirely and
 * says so at startup.
 *
 * ── Two aliases ─────────────────────────────────────────────────────────────
 *
 * `@/*` mirrors the tsconfig path mapping. `server-only` is aliased to an empty module because Next
 * resolves that specifier through its own webpack alias rather than through `node_modules` — the
 * package is not installed and cannot be. The stub reproduces what Next resolves it to on a server
 * runtime: nothing. The guarantee that matters (a client bundle importing it fails the build) is a
 * property of `next build`, which is verified by the build, not by this runner.
 */
export default defineConfig({
  oxc: { jsx: { runtime: "automatic" } },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      "server-only": fileURLToPath(new URL("./test/server-only-stub.ts", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    // Colocated with source, per TESTING_STRATEGY.md §"Test files colocated with source".
    include: ["src/**/*.spec.{ts,tsx}"],
  },
});
