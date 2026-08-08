// CommonJS rather than jest.config.ts: a .ts config would require ts-node, which is not in
// the approved dependency set. The repository has no "type": "module", so .js is CommonJS.
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
