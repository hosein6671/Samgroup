/**
 * What `import "server-only"` resolves to under Vitest.
 *
 * Next aliases the bare specifier to `next/dist/compiled/server-only` in its own webpack config —
 * to an empty module on every server runtime, and to a throwing one in a browser bundle. The
 * package is therefore never installed, so a test runner resolving it through `node_modules` finds
 * nothing. This reproduces the server-runtime half.
 *
 * The half that matters for safety — a Client Component importing a server-only module fails
 * `next build` outright — is a property of the build and is verified there, not here. Stubbing it
 * for tests removes a resolution error; it removes no guarantee.
 */
export {};
