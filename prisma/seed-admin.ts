/**
 * Creates the FIRST application Admin in sam_platform, so that `POST /auth/login` has an account
 * to authenticate.
 *
 * ── Why this exists at all ──────────────────────────────────────────────────
 *
 * `users` is empty and there is no self-registration endpoint — API_CONTRACT_FINAL.md §2.2 has
 * login, refresh, logout and me, and nothing that creates an account. `/admin/users` is Admin-only,
 * so the first Admin cannot be created through the API without an Admin already existing. Something
 * outside the request path has to break that circle exactly once.
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
 * ── What it will not do ─────────────────────────────────────────────────────
 *
 *   - Run without the opt-in. An unset or non-`true` flag stops before the first query.
 *   - Run against any database other than `sam_platform`, asked of the server itself (ADR-002).
 *   - Invent a password, or accept a short one.
 *   - **Reset an existing account's password.** A rerun with a different SAM_ADMIN_PASSWORD reports
 *     the account already exists and changes nothing. A bootstrap script that silently rewrote a
 *     credential would be a privilege-escalation path for anyone who could run it, and "I reran the
 *     seed" would be indistinguishable from an attack. Password *changes* belong to an
 *     authenticated flow that does not exist yet — see the gate report.
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
import * as argon2 from "argon2";

import { ARGON2_OPTIONS } from "../apps/api/src/modules/identity/password.service";
import { PrismaClient, UserRole } from "../apps/api/src/prisma/generated/client";

// Prisma 7 does not load .env automatically, and this file is also runnable outside the Prisma
// CLI. Guarded because a fresh clone has no .env yet.
if (existsSync(".env")) {
  process.loadEnvFile();
}

/** The only database this script may ever write to (ADR-002), asked of the server, not the URL. */
const TARGET_DATABASE = "sam_platform";

/** The opt-in. Exactly this literal — "TRUE", "1" and "yes" are not it. */
const OPT_IN_VARIABLE = "SAM_ALLOW_ADMIN_BOOTSTRAP";

/**
 * A floor, not a policy. It exists so that a bootstrap credential for the platform's most
 * privileged role cannot be three characters typed in a hurry; it is not a claim about what makes
 * a password good, and no complexity rule is imposed — see `login.dto.ts` for why.
 */
const MIN_PASSWORD_LENGTH = 12;

/** Raised only for conditions that need a human decision, never for I/O faults. */
class AdminBootstrapAbort extends Error {}

function requireEnv(name: string): string {
  const value = process.env[name];

  if (value === undefined || value.trim() === "") {
    throw new AdminBootstrapAbort(
      `${name} is not set. This script has no default for it, by design — no credential for this ` +
        "platform is committed to the repository.",
    );
  }

  return value;
}

async function bootstrap(prisma: PrismaClient): Promise<"created" | "already-exists"> {
  if (process.env[OPT_IN_VARIABLE] !== "true") {
    throw new AdminBootstrapAbort(
      `${OPT_IN_VARIABLE} is not set to "true". This script creates an ADMIN account and is ` +
        "deliberately inert unless explicitly armed for this one invocation.",
    );
  }

  const email = requireEnv("SAM_ADMIN_EMAIL").trim();
  // Deliberately not trimmed: a password may legitimately begin or end with a space, and the login
  // DTO does not trim it either. Trimming here would create an account nobody can sign in to.
  const password = requireEnv("SAM_ADMIN_PASSWORD");

  if (password.length < MIN_PASSWORD_LENGTH) {
    // The message reports the requirement, never the value or its actual length.
    throw new AdminBootstrapAbort(
      `SAM_ADMIN_PASSWORD must be at least ${String(MIN_PASSWORD_LENGTH)} characters.`,
    );
  }

  // Identity of what was actually reached, rather than what was intended — the same guard
  // seed-catalog.ts applies, asked of the server so no connection string is parsed or printed.
  const identity = await prisma.$queryRaw<
    { current_database: string }[]
  >`SELECT current_database()`;
  const database = identity[0]?.current_database ?? "unknown";

  if (database !== TARGET_DATABASE) {
    throw new AdminBootstrapAbort(
      `admin bootstrap is only allowed against ${TARGET_DATABASE}; connected database is ` +
        `'${database}'. No account was created.`,
    );
  }

  // Idempotent by stable identity: `users.email` is unique, and that unique index — not this
  // check — is what makes a concurrent second run fail rather than duplicate.
  const existing = await prisma.user.findUnique({ where: { email }, select: { id: true } });

  if (existing !== null) {
    return "already-exists";
  }

  // Hashed with the API's own parameters, imported rather than restated, so a hash written here is
  // byte-compatible with one the application would write and costs the same to attack.
  const passwordHash = await argon2.hash(password, ARGON2_OPTIONS);

  await prisma.user.create({
    // `organizationId` is left null: internal staff have no Organization (schema.prisma).
    data: { email, passwordHash, role: UserRole.ADMIN },
    select: { id: true },
  });

  return "created";
}

async function main(): Promise<void> {
  const connectionString = process.env.DATABASE_URL;

  if (connectionString === undefined || connectionString === "") {
    throw new AdminBootstrapAbort(
      "DATABASE_URL is not set — copy .env.example to .env before running this script.",
    );
  }

  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

  try {
    const outcome = await bootstrap(prisma);

    if (outcome === "created") {
      // The address is printed because the operator supplied it and needs to know which account
      // was made. The password is not, the hash is not, and neither is any part of either.
      console.log(`Created ADMIN user in ${TARGET_DATABASE}: ${process.env.SAM_ADMIN_EMAIL ?? ""}`);
    } else {
      console.log(
        "A user with that email already exists. Nothing was written, and the existing " +
          "password was NOT changed.",
      );
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  /*
   * A driver error can carry the DSN in its message, and the DSN carries a password — the same
   * hazard seed-catalog.ts handles. Only messages this script wrote itself are printed in full;
   * anything else is reported by type only.
   */
  if (error instanceof AdminBootstrapAbort) {
    console.error(`Aborted: ${error.message}`);
  } else {
    console.error(
      "Aborted: the admin bootstrap failed with an unexpected error. Its message is withheld " +
        "because a database or hashing error can quote a connection string or a credential.",
    );
  }

  process.exitCode = 1;
});
