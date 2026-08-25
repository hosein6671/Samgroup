import { PasswordService } from "./password.service";
import { PrismaClient, UserRole, UserStatus } from "../../prisma/generated/client";

/**
 * The first-Admin bootstrap, as decision logic rather than as a script.
 *
 * ── Why this exists at all ──────────────────────────────────────────────────
 *
 * `users` starts empty and there is no self-registration endpoint — API_CONTRACT_FINAL.md §2.2 has
 * login, refresh, logout and me, and nothing that creates an account. `/admin/users` is Admin-only,
 * so the first Admin cannot be created through the API without an Admin already existing. Something
 * outside the request path has to break that circle exactly once. SECURITY.md §Admin bootstrap is
 * the authority for every rule below; none of them is chosen here.
 *
 * ── Why it lives here and not in `prisma/seed-admin.ts` ─────────────────────
 *
 * It used to live there in full, and there it was **unreachable by a test**: the file called
 * `main()` at module load, so importing it ran it, and it sits outside every `tsconfig` `include`
 * and outside Jest's `testMatch`. The one script that creates the platform's most privileged
 * account was verified by reading only. Moving the decisions here — and leaving the CLI as a thin
 * wrapper — changes no behaviour and makes every rule assertable.
 *
 * It belongs to **Identity & Access** for the same reason `UsersService` does: `User` is this
 * module's entity (ARCHITECTURE.md §Modules), and a bootstrap writing `users` from anywhere else
 * would be the cross-module repository access the modular-monolith rule forbids.
 *
 * ── What this module deliberately does NOT do ───────────────────────────────
 *
 * It reads no file, loads no `.env`, constructs no Prisma client, prints nothing, and sets no exit
 * code. Each of those is the CLI's, which is what makes the rules here testable without a process.
 * It is also **not a Nest provider** and is not registered in `IdentityModule`: no code path in the
 * running application may reach something that creates an ADMIN account.
 *
 * ── Payload is not in scope ─────────────────────────────────────────────────
 *
 * ADR-006 keeps Payload's admin users in `sam_cms`, with Payload's own native hashing and its own
 * sessions. Nothing here reads, writes, mirrors or syncs one, and `TARGET_DATABASE` refuses every
 * database except the platform's.
 */

/** The only database this bootstrap may write to (ADR-002), asked of the server, not the URL. */
export const TARGET_DATABASE = "sam_platform";

/** The opt-in. Exactly this literal — "TRUE", "1" and "yes" are not it. */
export const OPT_IN_VARIABLE = "SAM_ALLOW_ADMIN_BOOTSTRAP";

/**
 * A floor, not a policy. It exists so a bootstrap credential for the platform's most privileged
 * role cannot be three characters typed in a hurry; it is not a claim about what makes a password
 * good, and no complexity rule is imposed — see `login.dto.ts` for why.
 */
export const MIN_PASSWORD_LENGTH = 12;

/** Raised only for conditions that need a human decision, never for I/O faults. */
export class AdminBootstrapAbort extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AdminBootstrapAbort";
  }
}

/** A process environment, read and never mutated. `process.env` satisfies it. */
export type AdminBootstrapEnvironment = Readonly<Record<string, string | undefined>>;

/** What the operator asked for, once every rule about it has held. */
export type AdminBootstrapRequest = {
  readonly email: string;
  readonly password: string;
};

export type AdminBootstrapOutcome = "created" | "already-exists";

/** What happened, and the address it happened to — trimmed exactly as the row carries it. */
export type AdminBootstrapResult = {
  readonly outcome: AdminBootstrapOutcome;
  readonly email: string;
};

/**
 * The hashing capability, as the narrowest shape that can hash a password.
 *
 * `PasswordService` is the default and the only production implementation — ADR-004's argon2id
 * parameters are pinned there once, and taking them from anywhere else would mean a bootstrap hash
 * that verifies but costs a different amount to attack. The type is structural only so a test can
 * prove what happens when hashing fails.
 */
export type AdminPasswordHasher = Pick<PasswordService, "hash">;

function requireEnv(env: AdminBootstrapEnvironment, name: string): string {
  const value = env[name];

  if (value === undefined || value.trim() === "") {
    throw new AdminBootstrapAbort(
      `${name} is not set. This script has no default for it, by design — no credential for this ` +
        "platform is committed to the repository.",
    );
  }

  return value;
}

/**
 * The connection string, or an abort.
 *
 * Checked before a client is constructed, so a missing value produces a sentence an operator can
 * act on rather than a driver error — and driver errors quote DSNs.
 */
export function readDatabaseUrl(env: AdminBootstrapEnvironment): string {
  const value = env.DATABASE_URL;

  if (value === undefined || value === "") {
    throw new AdminBootstrapAbort(
      "DATABASE_URL is not set — copy .env.example to .env before running this script.",
    );
  }

  return value;
}

/**
 * The arming flag, the email and the password — validated in that order, before any query.
 *
 * The order is load-bearing rather than incidental: a run that was never armed must not reach a
 * database at all, so nothing here touches one.
 */
export function readBootstrapRequest(env: AdminBootstrapEnvironment): AdminBootstrapRequest {
  if (env[OPT_IN_VARIABLE] !== "true") {
    throw new AdminBootstrapAbort(
      `${OPT_IN_VARIABLE} is not set to "true". This script creates an ADMIN account and is ` +
        "deliberately inert unless explicitly armed for this one invocation.",
    );
  }

  const email = requireEnv(env, "SAM_ADMIN_EMAIL").trim();
  // Deliberately not trimmed: a password may legitimately begin or end with a space, and the login
  // DTO does not trim it either. Trimming here would create an account nobody can sign in to.
  const password = requireEnv(env, "SAM_ADMIN_PASSWORD");

  if (password.length < MIN_PASSWORD_LENGTH) {
    // The message reports the requirement, never the value or its actual length.
    throw new AdminBootstrapAbort(
      `SAM_ADMIN_PASSWORD must be at least ${String(MIN_PASSWORD_LENGTH)} characters.`,
    );
  }

  return { email, password };
}

/**
 * Refuses to proceed unless the connected database really is `sam_platform`.
 *
 * The identity of what was actually reached, rather than what was intended — the same guard
 * `seed-catalog.ts` applies, asked of the server so no connection string is parsed or printed. A
 * clone, a restore, a test database, or a database whose name merely *contains* `sam_platform` all
 * fail it: the comparison is equality, never a prefix and never a pattern.
 */
export async function assertPlatformDatabase(prisma: PrismaClient): Promise<void> {
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
}

/**
 * Creates the account, or reports that one already answers to that address.
 *
 * ── Idempotent by stable identity ───────────────────────────────────────────
 *
 * `users.email` is unique, and that unique index — not the check below — is what makes a
 * concurrent second run fail rather than duplicate.
 *
 * **Known limitation, deliberately unchanged: the match is case-sensitive.** `users.email` is a
 * plain `text` column with a case-sensitive unique index, so `Admin@…` and `admin@…` are two
 * different accounts to PostgreSQL, and a rerun differing only in case creates a *second* Admin
 * rather than reporting the first. Normalising would change what that index means and is a schema
 * decision, not a bootstrap decision — `users.service.ts` records the same limitation on the login
 * side, and the two must not diverge.
 */
export async function provisionAdmin(
  prisma: PrismaClient,
  request: AdminBootstrapRequest,
  passwords: AdminPasswordHasher = new PasswordService(),
): Promise<AdminBootstrapOutcome> {
  const existing = await prisma.user.findUnique({
    where: { email: request.email },
    select: { id: true },
  });

  if (existing !== null) {
    // Returned untouched, and that includes `status`. A rerun does not re-enable a disabled admin
    // any more than it resets a password: both would let anyone who can run this undo an
    // administrative decision, and "I reran the seed" would be indistinguishable from an attack.
    return "already-exists";
  }

  // Hashed through the API's own service, so a hash written here is byte-compatible with one the
  // application would write and costs the same to attack. Nothing is hashed before the existence
  // check, so a rerun does no argon2 work and never produces a value that could replace a stored one.
  const passwordHash = await passwords.hash(request.password);

  await prisma.user.create({
    // `organizationId` is left null: internal staff have no Organization (schema.prisma).
    //
    // `status` is written explicitly rather than left to the column default (ADR-012). The default
    // would produce the same row today, but a bootstrap relying on it would silently change meaning
    // if the default ever did — and the one account this exists to create is the one that must not
    // arrive in an unexpected state.
    data: {
      email: request.email,
      passwordHash,
      role: UserRole.ADMIN,
      status: UserStatus.ACTIVE,
    },
    select: { id: true },
  });

  return "created";
}

/**
 * The whole decision, in the order the rules must be applied.
 *
 * Environment first, then the database's own identity, then the write. Every earlier step is a
 * refusal that reaches no further, which is why an unarmed, under-length or wrongly-targeted run
 * performs no query that could write.
 */
export async function bootstrapAdmin(
  prisma: PrismaClient,
  env: AdminBootstrapEnvironment,
  passwords: AdminPasswordHasher = new PasswordService(),
): Promise<AdminBootstrapResult> {
  const request = readBootstrapRequest(env);

  await assertPlatformDatabase(prisma);

  const outcome = await provisionAdmin(prisma, request, passwords);

  return { outcome, email: request.email };
}

/**
 * What the operator is told on success.
 *
 * The address is reported because they supplied it and need to know which account was made — and it
 * is the *stored* address, trimmed exactly as the row carries it, so what is printed matches what
 * exists. The password is not reported, the hash is not, and neither is any part of either.
 */
export function describeBootstrapSuccess(outcome: AdminBootstrapOutcome, email: string): string {
  return outcome === "created"
    ? `Created ADMIN user in ${TARGET_DATABASE}: ${email}`
    : "A user with that email already exists. Nothing was written, and the existing " +
        "password was NOT changed.";
}

/**
 * What the operator is told on failure.
 *
 * Only messages this module wrote itself are reported in full. Anything else is reported by type
 * only, because a driver error can carry the DSN in its message and a DSN carries a password — the
 * same hazard `seed-catalog.ts` handles. An argon2 fault is in the same class.
 */
export function describeBootstrapFailure(error: unknown): string {
  if (error instanceof AdminBootstrapAbort) {
    return `Aborted: ${error.message}`;
  }

  return (
    "Aborted: the admin bootstrap failed with an unexpected error. Its message is withheld " +
    "because a database or hashing error can quote a connection string or a credential."
  );
}

/** Where a message goes. Injected so the CLI owns `console` and this module owns the wording. */
export type AdminBootstrapOutput = {
  readonly log: (message: string) => void;
  readonly error: (message: string) => void;
};

export type AdminBootstrapRun = {
  readonly env: AdminBootstrapEnvironment;
  /** Builds a client for a connection string. The CLI's adapter choice stays in the CLI. */
  readonly connect: (databaseUrl: string) => PrismaClient;
  readonly output: AdminBootstrapOutput;
  readonly passwords?: AdminPasswordHasher;
};

/**
 * The CLI's whole body, minus the process.
 *
 * Returns the exit code rather than setting one, so the wrapper stays a wiring file and every
 * branch — including the one that must not print a DSN — is reachable from a test. The client is
 * disconnected in `finally`, exactly as before, including on the paths that never opened one.
 */
export async function runAdminBootstrap(run: AdminBootstrapRun): Promise<number> {
  let prisma: PrismaClient | undefined;

  try {
    const databaseUrl = readDatabaseUrl(run.env);

    prisma = run.connect(databaseUrl);

    const result = await bootstrapAdmin(prisma, run.env, run.passwords ?? new PasswordService());

    run.output.log(describeBootstrapSuccess(result.outcome, result.email));

    return 0;
  } catch (error: unknown) {
    run.output.error(describeBootstrapFailure(error));

    return 1;
  } finally {
    await prisma?.$disconnect();
  }
}
