/**
 * Shared PostCSS configuration. An app re-exports it:
 *
 *   export { default } from "@sam-group/config/postcss";
 *
 * Tailwind v4 needs no autoprefixer — vendor prefixing is handled internally by Lightning CSS,
 * and adding autoprefixer alongside it duplicates work and can fight the output.
 */
/*
 * ── Why the plugin is keyed by an ABSOLUTE PATH ─────────────────────────────
 *
 * This was `"@tailwindcss/postcss": {}` — a bare package name — and under pnpm's isolated
 * `node_modules` that cannot resolve from a consuming app. Next resolves each plugin with
 * `require.resolve(pluginName, { paths: [dir] })`, where `dir` is the APP's directory
 * (`next/dist/build/webpack/config/blocks/css/plugins.js`), and there is no fallback. But
 * `@tailwindcss/postcss` is a dependency of THIS package, so pnpm links it into
 * `packages/config/node_modules`; `apps/web/node_modules` holds that app's direct dependencies and
 * nothing else, and the lookup walks from there to the workspace root without ever passing a copy.
 * The result is a hard failure — `Error: Cannot find module '@tailwindcss/postcss'` — on the first
 * module that imports any CSS, which in `apps/web` is every page.
 *
 * Next requires a string and rejects an imported plugin instance outright ("A PostCSS Plugin was
 * passed as a function using require(), but it must be provided as a string"), so importing it is
 * not an option. Resolving it here — from the package that declares it — and handing Next the
 * absolute path satisfies both constraints: the specifier is still a string, and it is one that
 * resolves from anywhere.
 *
 * The alternative is declaring `@tailwindcss/postcss` in every app that consumes the design system,
 * which would put the Tailwind version in as many places as there are apps. This file exists
 * precisely so that cannot drift.
 *
 * The empty options object is deliberate and unchanged: Next treats `{}` as "require the module and
 * use it as-is", the same as before.
 */
import { createRequire } from "node:module";

const resolveFromHere = createRequire(import.meta.url);

const config = {
  plugins: {
    [resolveFromHere.resolve("@tailwindcss/postcss")]: {},
  },
};

export default config;
