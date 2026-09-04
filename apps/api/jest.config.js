// CommonJS rather than jest.config.ts: a .ts config would require ts-node, which is not in
// the approved dependency set. The repository has no "type": "module", so .js is CommonJS.
/*
 * The `test` script invokes Jest as `node --experimental-vm-modules node_modules/jest/bin/jest.js`
 * rather than as `jest`, and the flag is not optional.
 *
 * `@prisma/adapter-pg` performs a DYNAMIC IMPORT at runtime. Jest's default CommonJS VM cannot
 * service one, so every test that opens a Prisma client through the driver adapter fails with
 * "A dynamic import callback was invoked without --experimental-vm-modules" — which is what the six
 * catalog integration suites did. They were reported as merely "skipped for want of
 * CATALOG_APPLY_TEST_ADMIN_URL"; in fact they could not execute at all, because supplying that
 * variable only got them as far as the first `CREATE DATABASE`.
 *
 * The flag is set through the node invocation rather than through `NODE_OPTIONS=… jest` because an
 * inline environment prefix is POSIX shell syntax and this repository is developed on Windows.
 * Measured with the flag on: the 85 suites that need no database still pass, and no warning is
 * emitted.
 */
/** @type {import('jest').Config} */
module.exports = {
  rootDir: ".",
  testEnvironment: "node",
  // main.ts loads reflect-metadata once at bootstrap; tests import modules directly and
  // would otherwise run without decorator metadata, which fails as
  // "Reflect.getMetadata is not a function".
  setupFiles: ["reflect-metadata"],
  testMatch: ["<rootDir>/src/**/*.spec.ts"],
  // tsconfig.json sets rewriteRelativeImportExtensions, which the generated Prisma client
  // needs so the BUILT output requires "./enums.js". ts-jest applies the same rewrite, but
  // tests run against the .ts sources with no dist to resolve against, so the rewritten
  // specifier points at a file that does not exist. Mapping the extension back off lets
  // Jest resolve the real source; production emit is unaffected.
  moduleNameMapper: {
    "^(\\.{1,2}/.*)\\.js$": "$1",
  },
  transform: {
    "^.+\\.ts$": ["ts-jest", { tsconfig: "<rootDir>/tsconfig.json" }],
  },
  collectCoverageFrom: ["src/**/*.ts", "!src/main.ts"],
  coverageDirectory: "coverage",
};
