/**
 * Prisma CLI configuration (Prisma 7).
 *
 * In Prisma 7 this file — not a `prisma` key in package.json — is where the CLI
 * reads its configuration from, and environment variables are no longer loaded
 * automatically. Both are deliberate upstream changes, not local preferences.
 *
 * `.env` is loaded with Node's built-in `process.loadEnvFile()` (Node >= 20.12;
 * this repo requires >= 24) so that no dotenv dependency is needed.
 *
 * Scope: sam_platform only. Payload owns sam_cms and migrates it itself —
 * nothing here may ever point at that database (ADR-002).
 */
import { existsSync } from "node:fs";

import { defineConfig, env } from "prisma/config";

// Guarded: a fresh clone has no .env until it is copied from .env.example, and
// loadEnvFile() throws rather than no-opping when the file is absent.
if (existsSync(".env")) {
  process.loadEnvFile();
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  // Prisma 7 moved the connection URL out of schema.prisma to here. This is the
  // sam_platform URL and only ever that one.
  datasource: {
    url: env("DATABASE_URL"),
  },
});
