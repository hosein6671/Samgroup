/**
 * Global stylesheet imports.
 *
 * Next.js ships declarations for `*.module.css` but not for a plain global stylesheet, and
 * TypeScript 6 checks side-effect imports by default (`noUncheckedSideEffectImports`), so
 * `import "./globals.css"` fails to resolve without this. Declared here rather than switching
 * the check off in tsconfig, which would stop TypeScript verifying every other side-effect
 * import in the app to fix one file.
 */
declare module "*.css";
