/**
 * Creates the FIRST application Admin in sam_platform, so that `POST /auth/login` has an account
 * to authenticate.
 *
 * ── This file is a wrapper. The rules live in the API ───────────────────────
 *
 * Every decision — the arming flag, the required variables, the 12-character floor, the
 * `current_database()` guard, the idempotent "already exists" branch, argon2id hashing through the
 * platform's own `PasswordService`, and the exact wording of both the success and the failure
 * message — is in `apps/api/src/modules/identity/admin-bootstrap.ts`, together with the reasoning
 * for each. It is there rather than here because this file used to run on import, which made all of
 * it untestable; `admin-bootstrap.spec.ts` now asserts it.
 *
 * What stays here is what genuinely belongs to a command line: loading `.env`, building the Prisma
 * client, printing, and setting an exit code.
 *
 * ── No mechanism was specified, so this follows the repository's own precedent ─
 *
 * No document in this repository defines a platform bootstrap-admin mechanism. Two precedents are
 * followed rather than a new pattern invented:
 *
 *   - **The demo seeds** (`seed-products-demo.ts`, `seed-blog-demo.ts`): a dedicated, explicitly
 *     invoked script, armed only by a process-scoped opt-in variable, never wired into
 *     `prisma db seed` — so no migration command can create an account as a side effect.
 *   - **Payload's first admin** (ROADMAP.md): created "with no seeded or committed credential".
 *     The same rule holds here — this file contains no password, no email address, and no default
 *     for either. Both are supplied by the operator, in the process environment, at run time.
 *
 * ── Run it ──────────────────────────────────────────────────────────────────
 *
 *   SAM_ALLOW_ADMIN_BOOTSTRAP=true \
 *   SAM_ADMIN_EMAIL=... SAM_ADMIN_PASSWORD=... \
 *   pnpm seed:admin
 *
 * Supply the password without typing it where a shell would record it — an interactive read into
 * the process environment, not a literal on the command line and not a line in a `.env`.
 *
 * ── What it will not do ─────────────────────────────────────────────────────
 *
 *   - Run without the opt-in. An unset or non-`true` flag stops before the first query.
 *   - Run against any database other than `sam_platform`, asked of the server itself (ADR-002).
 *   - Invent a password, or accept a short one.
 *   - **Reset an existing account's password**, or re-enable a disabled one.
 *   - Print the password, the hash, or any part of either.
 *
 * ── This is a DEV/bootstrap tool ────────────────────────────────────────────
 *
 * Whether a production deployment creates its first Admin this way, through a one-shot container
 * command, or by some other operational procedure is a **deployment decision that has not been
 * taken** — the VPS does not exist yet (DEVOPS.md §Deployment Target). Nothing here assumes an
 * answer; it is safe to run in production only in the sense that it refuses to do anything
 * surprising.
 */
import { existsSync } from "node:fs";

import { PrismaPg } from "@prisma/adapter-pg";

import { runAdminBootstrap } from "../apps/api/src/modules/identity/admin-bootstrap";
import { PrismaClient } from "../apps/api/src/prisma/generated/client";

// Prisma 7 does not load .env automatically, and this file is also runnable outside the Prisma
// CLI. Guarded because a fresh clone has no .env yet.
if (existsSync(".env")) {
  process.loadEnvFile();
}

void runAdminBootstrap({
  env: process.env,
  connect: (connectionString) => new PrismaClient({ adapter: new PrismaPg({ connectionString }) }),
  output: {
    log: (message) => {
      console.log(message);
    },
    error: (message) => {
      console.error(message);
    },
  },
}).then((exitCode) => {
  process.exitCode = exitCode;
});
