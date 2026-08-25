import { randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { PrismaPg } from "@prisma/adapter-pg";

import {
  AdminBootstrapAbort,
  MIN_PASSWORD_LENGTH,
  OPT_IN_VARIABLE,
  TARGET_DATABASE,
  assertPlatformDatabase,
  bootstrapAdmin,
  describeBootstrapFailure,
  describeBootstrapSuccess,
  provisionAdmin,
  readBootstrapRequest,
  readDatabaseUrl,
  runAdminBootstrap,
} from "./admin-bootstrap";
import { PasswordService } from "./password.service";
import { PrismaClient, UserRole, UserStatus } from "../../prisma/generated/client";
import {
  assertDisposableDatabase,
  databaseNameOf,
} from "../catalog/import/apply/disposable-harness";
import {
  createDisposableDatabase,
  dropDisposableDatabase,
  readDatabaseConfig,
} from "../catalog/import/apply/__tests__/disposable-database";

import type { AdminBootstrapEnvironment, AdminBootstrapOutput } from "./admin-bootstrap";
import type { DatabaseConfig } from "../catalog/import/apply/__tests__/disposable-database";

/**
 * The first-Admin bootstrap, asserted rather than read.
 *
 * ## Why this suite exists
 *
 * `prisma/seed-admin.ts` creates the platform's most privileged account, and until this file it had
 * no test at all — every guard in it was verified by reading. It is also the one script whose
 * failure modes are silent: a bootstrap that quietly reset a password, quietly re-enabled a
 * disabled admin, or quietly wrote to the wrong database would look exactly like a successful run.
 *
 * ## Where the database cases run, and where they never run
 *
 * Against a **disposable clone**, created with the same harness the catalog integration suites use
 * and dropped in `afterAll`. `assertDisposableDatabase` refuses `sam_platform`, `sam_cms`,
 * `postgres` and both templates outright, and accepts only a name matching
 * `sam_platform_disposable_*` — so the isolation is enforced by the harness before this suite opens
 * a connection, not by this suite remembering to be careful.
 *
 * The clone's own name **contains** `sam_platform`, which is what makes it the exact adversarial
 * case for the production guard: `assertPlatformDatabase` compares for equality, so the clone is
 * refused, and the refusal is observed here rather than asserted in prose.
 *
 * ## Opt-in, and it says so when it skips
 *
 * `pnpm test` must pass on a machine with no PostgreSQL, so the database block reads its
 * configuration from the environment and skips when it is absent. The pure block above it — every
 * environment rule, every message, and every source-level boundary — always runs.
 *
 *     NODE_OPTIONS=--experimental-vm-modules \
 *     CATALOG_APPLY_TEST_ADMIN_URL=postgresql://<superuser>:<pw>@localhost:5432/postgres \
 *     pnpm --filter @sam-group/api exec jest src/modules/identity/admin-bootstrap.spec.ts
 *
 * `--experimental-vm-modules` is not optional and is not about this file: Prisma 7's driver adapter
 * loads through a dynamic import, which Jest's CommonJS runtime refuses without it, and `NODE_OPTIONS`
 * is read at process start so no Jest config option can supply it (ADR-015). Measured here too — the
 * database block fails to open a connection without it.
 *
 * The consequence is deliberate and worth stating plainly: **the guard and the write are proven
 * separately.** Every environment and database-identity rule is proven end-to-end through
 * `runAdminBootstrap`, which refuses the clone; the provisioning rules are proven through
 * `provisionAdmin`, which is the code the guard admits to. What joins them — that no write happens
 * unless the guard passed — is proven by running the *entire* pipeline with otherwise-valid inputs
 * and asserting the user count never moves.
 *
 * ## Credentials
 *
 * Every password in this file is generated at run time from `randomBytes`. None is a literal, none
 * reaches a snapshot, and the final assertion in the pure block re-reads every message the suite
 * produced and fails if any secret or any argon2 hash appears in one.
 */

const suffix = `admin_bootstrap_${randomBytes(4).toString("hex")}`;

const REPO_ROOT = join(__dirname, "..", "..", "..", "..", "..");

/** A password that satisfies the floor. Generated, never written down. */
function newPassword(): string {
  return randomBytes(24).toString("base64url");
}

/** Every secret this suite handled, so the leakage scan can look for all of them. */
const secrets: string[] = [];

function trackedPassword(): string {
  const password = newPassword();
  secrets.push(password);
  return password;
}

/** Every message any part of this suite produced, in order. */
const transcript: string[] = [];

const output: AdminBootstrapOutput = {
  log: (message) => {
    transcript.push(message);
  },
  error: (message) => {
    transcript.push(message);
  },
};

/** A complete, valid environment. Individual tests remove or corrupt one key at a time. */
function validEnv(overrides: Record<string, string | undefined> = {}): AdminBootstrapEnvironment {
  return {
    DATABASE_URL: "postgresql://user:pw@localhost:5432/sam_platform",
    [OPT_IN_VARIABLE]: "true",
    SAM_ADMIN_EMAIL: "bootstrap-probe@samgp.test",
    SAM_ADMIN_PASSWORD: trackedPassword(),
    ...overrides,
  };
}

/* ------------------------------------------------------------------------- */
/* Block A — the rules that need no database                                  */
/* ------------------------------------------------------------------------- */

describe("the arming flag", () => {
  it("refuses when it is absent", () => {
    expect(() => readBootstrapRequest(validEnv({ [OPT_IN_VARIABLE]: undefined }))).toThrow(
      AdminBootstrapAbort,
    );
  });

  /**
   * Exactly the lowercase literal. Every value below is one somebody would plausibly type meaning
   * "yes", and the point of the flag is that meaning to arm it is not the same as arming it.
   */
  it.each(["TRUE", "True", "tRue", "1", "yes", "y", "on", "", " true", "true ", " true "])(
    "refuses %p",
    (value) => {
      expect(() => readBootstrapRequest(validEnv({ [OPT_IN_VARIABLE]: value }))).toThrow(
        AdminBootstrapAbort,
      );
    },
  );

  it('accepts exactly "true"', () => {
    expect(() => readBootstrapRequest(validEnv())).not.toThrow();
  });

  it("names itself in the refusal, so the operator knows what to set", () => {
    try {
      readBootstrapRequest(validEnv({ [OPT_IN_VARIABLE]: undefined }));
      throw new Error("expected an abort");
    } catch (error: unknown) {
      expect(describeBootstrapFailure(error)).toContain(OPT_IN_VARIABLE);
    }
  });
});

describe("the required values", () => {
  it.each([undefined, ""])("refuses DATABASE_URL %p", (value) => {
    expect(() => readDatabaseUrl(validEnv({ DATABASE_URL: value }))).toThrow(AdminBootstrapAbort);
  });

  it("accepts a DATABASE_URL that is present", () => {
    expect(readDatabaseUrl(validEnv())).toContain("postgresql://");
  });

  it.each([undefined, "", "   "])("refuses SAM_ADMIN_EMAIL %p", (value) => {
    expect(() => readBootstrapRequest(validEnv({ SAM_ADMIN_EMAIL: value }))).toThrow(
      AdminBootstrapAbort,
    );
  });

  it.each([undefined, "", "   "])("refuses SAM_ADMIN_PASSWORD %p", (value) => {
    expect(() => readBootstrapRequest(validEnv({ SAM_ADMIN_PASSWORD: value }))).toThrow(
      AdminBootstrapAbort,
    );
  });

  it("names the missing variable without inventing a default for it", () => {
    try {
      readBootstrapRequest(validEnv({ SAM_ADMIN_EMAIL: undefined }));
      throw new Error("expected an abort");
    } catch (error: unknown) {
      expect(describeBootstrapFailure(error)).toContain("SAM_ADMIN_EMAIL");
    }
  });
});

describe("the password floor", () => {
  it("is twelve characters", () => {
    expect(MIN_PASSWORD_LENGTH).toBe(12);
  });

  it("refuses one character short", () => {
    const short = "a".repeat(MIN_PASSWORD_LENGTH - 1);

    expect(() => readBootstrapRequest(validEnv({ SAM_ADMIN_PASSWORD: short }))).toThrow(
      AdminBootstrapAbort,
    );
  });

  it("accepts exactly the floor", () => {
    const exact = "a".repeat(MIN_PASSWORD_LENGTH);

    expect(readBootstrapRequest(validEnv({ SAM_ADMIN_PASSWORD: exact })).password).toBe(exact);
  });

  /** The requirement, never the value and never its actual length. */
  it("reports the requirement without quoting the value or its length", () => {
    const short = trackedPassword().slice(0, MIN_PASSWORD_LENGTH - 1);

    try {
      readBootstrapRequest(validEnv({ SAM_ADMIN_PASSWORD: short }));
      throw new Error("expected an abort");
    } catch (error: unknown) {
      const message = describeBootstrapFailure(error);

      expect(message).toContain(String(MIN_PASSWORD_LENGTH));
      expect(message).not.toContain(short);
      expect(message).not.toContain(String(short.length));
    }
  });
});

describe("what is trimmed and what is not", () => {
  it("trims the email, so the stored address is the one that was meant", () => {
    expect(readBootstrapRequest(validEnv({ SAM_ADMIN_EMAIL: "  a@b.test \n" })).email).toBe(
      "a@b.test",
    );
  });

  /**
   * A password may legitimately begin or end with a space and the login DTO does not trim one
   * either. Trimming here would create an account nobody can sign in to.
   */
  it("does not trim the password", () => {
    const padded = ` ${"x".repeat(MIN_PASSWORD_LENGTH)} `;

    expect(readBootstrapRequest(validEnv({ SAM_ADMIN_PASSWORD: padded })).password).toBe(padded);
  });
});

describe("the target database is a constant, not an input", () => {
  it("is exactly sam_platform", () => {
    expect(TARGET_DATABASE).toBe("sam_platform");
  });

  /** No environment variable, argument or option can name a different one. */
  it("is not readable from the environment", () => {
    const source = readFileSync(join(__dirname, "admin-bootstrap.ts"), "utf8");
    const code = source.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/\/\/[^\n]*/g, " ");

    expect(code).toContain('TARGET_DATABASE = "sam_platform"');
    expect(code).not.toMatch(/TARGET_DATABASE\s*=\s*(env|process)/);
  });
});

describe("what the operator is told", () => {
  const email = "reported@samgp.test";

  it("names the created account, so they know which one was made", () => {
    const message = describeBootstrapSuccess("created", email);

    expect(message).toContain(email);
    expect(message).toContain(TARGET_DATABASE);
  });

  /**
   * The rerun message deliberately does NOT echo the address: it is the branch that changed
   * nothing, and its whole job is to say so.
   */
  it("says plainly that a rerun changed nothing", () => {
    const message = describeBootstrapSuccess("already-exists", email);

    expect(message).toContain("already exists");
    expect(message).toContain("NOT changed");
  });

  it("never carries the password or a hash in either message", async () => {
    const password = trackedPassword();
    const hash = await new PasswordService().hash(password);

    for (const outcome of ["created", "already-exists"] as const) {
      const message = describeBootstrapSuccess(outcome, email);

      expect(message).not.toContain(password);
      expect(message).not.toContain(hash);
      expect(message).not.toContain("$argon2");
    }
  });
});

describe("what a failure is allowed to say", () => {
  it("reports a deliberate abort in full — those messages were written here", () => {
    const abort = new AdminBootstrapAbort("a decision the operator has to make");

    expect(describeBootstrapFailure(abort)).toBe("Aborted: a decision the operator has to make");
  });

  /**
   * The case this branch exists for. A driver error quotes the DSN, and the DSN carries the
   * database password — so an unexpected error is reported by type and nothing else.
   */
  it("withholds an unexpected error entirely, DSN and all", () => {
    const dsn = "postgresql://sam_platform_user:super-secret-pw@db.internal:5432/sam_platform";
    const driverError = new Error(`connect ECONNREFUSED — while connecting with ${dsn}`);

    const message = describeBootstrapFailure(driverError);

    expect(message).not.toContain(dsn);
    expect(message).not.toContain("super-secret-pw");
    expect(message).not.toContain("postgresql://");
    expect(message).not.toContain("ECONNREFUSED");
    expect(message).toContain("withheld");
  });

  it("withholds a hashing fault for the same reason", async () => {
    const password = trackedPassword();
    const message = describeBootstrapFailure(new Error(`argon2 failed on ${password}`));

    expect(message).not.toContain(password);
  });

  it.each([undefined, null, "a bare string", 42])("withholds a thrown %p", (thrown) => {
    expect(describeBootstrapFailure(thrown)).toContain("withheld");
  });
});

describe("the CLI wrapper stays a wrapper", () => {
  const cli = readFileSync(join(REPO_ROOT, "prisma", "seed-admin.ts"), "utf8");
  const code = cli.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/\/\/[^\n]*/g, " ");

  it("delegates to the tested module", () => {
    expect(code).toContain("runAdminBootstrap");
  });

  /** No second copy of any rule. If one appears here it is a rule no test is asserting. */
  it.each([
    "prisma.user",
    "argon2",
    "ARGON2_OPTIONS",
    "current_database",
    OPT_IN_VARIABLE,
    "UserRole.ADMIN",
  ])("does not restate %s", (symbol) => {
    expect(code).not.toContain(symbol);
  });

  it("contains no email address and no password default", () => {
    expect(code).not.toMatch(/@[a-z0-9-]+\.[a-z]{2,}/i);
    expect(code).not.toMatch(/SAM_ADMIN_PASSWORD\s*[=:]/);
  });
});

describe("provisioning is not wired into anything that runs by itself", () => {
  const prismaConfig = readFileSync(join(REPO_ROOT, "prisma.config.ts"), "utf8");
  const manifest = readFileSync(join(REPO_ROOT, "package.json"), "utf8");
  const platformSeed = readFileSync(join(REPO_ROOT, "prisma", "seed.ts"), "utf8");

  /** `prisma db seed` must never be able to create an account as a side effect of a migration. */
  it("is not the seed prisma db seed runs", () => {
    expect(prismaConfig).toContain('seed: "tsx prisma/seed.ts"');
    expect(prismaConfig).not.toContain("seed-admin");
  });

  it("is not reachable from the seed that prisma db seed does run", () => {
    expect(platformSeed).not.toContain("seed-admin");
    expect(platformSeed).not.toContain("admin-bootstrap");
    expect(platformSeed).not.toContain("bootstrapAdmin");
  });

  it("is its own explicitly invoked script", () => {
    const scripts = (JSON.parse(manifest) as { scripts: Record<string, string> }).scripts;

    expect(scripts["seed:admin"]).toBe("tsx prisma/seed-admin.ts");
  });

  /** Not a Nest provider: no request can reach a code path that creates an ADMIN. */
  it("is not registered in IdentityModule", () => {
    const module = readFileSync(join(__dirname, "identity.module.ts"), "utf8");

    expect(module).not.toContain("admin-bootstrap");
    expect(module).not.toContain("bootstrapAdmin");
  });
});

describe("the identity boundary the bootstrap must not cross", () => {
  const core = readFileSync(join(__dirname, "admin-bootstrap.ts"), "utf8");
  const cli = readFileSync(join(REPO_ROOT, "prisma", "seed-admin.ts"), "utf8");
  const code = (source: string): string =>
    source.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/\/\/[^\n]*/g, " ");

  /** ADR-006: Payload keeps its own users in sam_cms. Nothing here may read or write one. */
  it.each(["sam_cms", "payload", "Payload", "DATABASE_URI", "PAYLOAD_SECRET"])(
    "names nothing belonging to the CMS (%s)",
    (symbol) => {
      expect(code(core)).not.toContain(symbol);
      expect(code(cli)).not.toContain(symbol);
    },
  );

  /** Provisioning creates an account, never a logged-in session. */
  it.each(["authSession", "auth_sessions", "AuthSessionsService", "refreshToken", "signAsync"])(
    "creates no session (%s)",
    (symbol) => {
      expect(code(core)).not.toContain(symbol);
      expect(code(cli)).not.toContain(symbol);
    },
  );

  /** One argon2 configuration on this platform, and it is not restated here. */
  it("hashes only through PasswordService", () => {
    expect(code(core)).toContain("PasswordService");
    expect(code(core)).not.toContain("argon2.hash");
    expect(code(core)).not.toContain("memoryCost");
  });
});

/* ------------------------------------------------------------------------- */
/* Block B — the rules that need a database                                   */
/* ------------------------------------------------------------------------- */

const config = readDatabaseConfig();
const withDatabase = config === null ? describe.skip : describe;

withDatabase("against a disposable PostgreSQL database", () => {
  const databaseConfig = config as DatabaseConfig;

  let url = "";
  let prisma: PrismaClient;

  beforeAll(async () => {
    url = await createDisposableDatabase(databaseConfig, suffix);

    // The isolation gate, applied before this suite opens its own connection. It refuses
    // sam_platform, sam_cms, postgres and both templates outright, and accepts only a name the
    // harness itself produced.
    assertDisposableDatabase(databaseNameOf(url));

    prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });

    // The clone starts where live DEV is: no accounts at all.
    expect(await prisma.user.count()).toBe(0);
  }, 180_000);

  afterAll(async () => {
    await prisma?.$disconnect();
    if (url) await dropDisposableDatabase(databaseConfig, url);
  }, 120_000);

  /** A fresh address per test, so no test depends on another's row. */
  function newEmail(label: string): string {
    return `admin-bootstrap-spec-${label}-${randomBytes(4).toString("hex")}@samgp.test`;
  }

  function envFor(email: string, password: string): AdminBootstrapEnvironment {
    return {
      DATABASE_URL: url,
      [OPT_IN_VARIABLE]: "true",
      SAM_ADMIN_EMAIL: email,
      SAM_ADMIN_PASSWORD: password,
    };
  }

  const connect = (connectionString: string): PrismaClient =>
    new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

  describe("the harness refuses a live target before anything else can happen", () => {
    it.each(["sam_platform", "sam_cms", "postgres", "template1", "sam_platform_backup"])(
      "will not open %s",
      (name) => {
        expect(() => {
          assertDisposableDatabase(name);
        }).toThrow();
      },
    );
  });

  describe("the database-identity guard", () => {
    /**
     * The clone's name CONTAINS `sam_platform`. The guard compares for equality, so it is refused —
     * which is simultaneously "wrong target refuses" and "a name that merely contains the target
     * still refuses".
     */
    it("refuses a database whose name merely contains sam_platform", async () => {
      await expect(assertPlatformDatabase(prisma)).rejects.toBeInstanceOf(AdminBootstrapAbort);
    });

    it("names what it actually reached, and says nothing was created", async () => {
      const reached = databaseNameOf(url);

      await expect(assertPlatformDatabase(prisma)).rejects.toThrow(reached);
      await expect(assertPlatformDatabase(prisma)).rejects.toThrow("No account was created");
    });

    /** The composed decision refuses at the same point, with every other input acceptable. */
    it("stops the whole bootstrap, with nothing written", async () => {
      const before = await prisma.user.count();

      await expect(
        bootstrapAdmin(prisma, envFor(newEmail("guarded"), trackedPassword())),
      ).rejects.toBeInstanceOf(AdminBootstrapAbort);

      expect(await prisma.user.count()).toBe(before);
    }, 30_000);
  });

  describe("every refusal leaves the table untouched", () => {
    /**
     * Each case runs the FULL pipeline — the same function the CLI calls — with a complete,
     * otherwise-valid environment, and asserts the count never moved. That is what proves the order
     * of the rules rather than describing it: a write that happened before a guard would show here.
     */
    const refusals: readonly (readonly [string, Record<string, string | undefined>])[] = [
      ["no arming flag", { [OPT_IN_VARIABLE]: undefined }],
      ["a near-miss arming flag", { [OPT_IN_VARIABLE]: "TRUE" }],
      ["no email", { SAM_ADMIN_EMAIL: undefined }],
      ["no password", { SAM_ADMIN_PASSWORD: undefined }],
      ["a short password", { SAM_ADMIN_PASSWORD: "short" }],
      ["no database url", { DATABASE_URL: undefined }],
      ["everything valid but the wrong database", {}],
    ];

    it.each(refusals)(
      "refuses with %s and writes nothing",
      async (_label, overrides) => {
        const before = await prisma.user.count();

        const exitCode = await runAdminBootstrap({
          env: { ...envFor(newEmail("refused"), trackedPassword()), ...overrides },
          connect,
          output,
        });

        expect(exitCode).toBe(1);
        expect(await prisma.user.count()).toBe(before);
      },
      60_000,
    );
  });

  describe("the first execution", () => {
    const email = newEmail("first");
    const password = trackedPassword();

    let createdHash = "";

    it("creates exactly one user", async () => {
      const before = await prisma.user.count();

      await expect(provisionAdmin(prisma, { email, password })).resolves.toBe("created");

      expect(await prisma.user.count()).toBe(before + 1);
    }, 60_000);

    it("creates it as an active ADMIN with no organization and no revocation", async () => {
      const row = await prisma.user.findUnique({
        where: { email },
        select: {
          role: true,
          status: true,
          organizationId: true,
          credentialsRevokedAt: true,
        },
      });

      expect(row).toEqual({
        role: UserRole.ADMIN,
        status: UserStatus.ACTIVE,
        organizationId: null,
        credentialsRevokedAt: null,
      });
    });

    it("stores something that is not the password", async () => {
      const row = await prisma.user.findUnique({
        where: { email },
        select: { passwordHash: true },
      });

      createdHash = row?.passwordHash ?? "";

      expect(createdHash).not.toBe(password);
      expect(createdHash).not.toContain(password);
      // ADR-004. The prefix is argon2's own encoding, so this reads the algorithm out of the
      // stored value rather than trusting what was configured.
      expect(createdHash.startsWith("$argon2id$")).toBe(true);
    });

    /** The hash is not merely argon2-shaped — the application's own verifier accepts it. */
    it("stores a hash the platform's PasswordService verifies", async () => {
      const passwords = new PasswordService();

      await expect(passwords.verify(createdHash, password)).resolves.toBe(true);
      await expect(passwords.verify(createdHash, `${password}x`)).resolves.toBe(false);
    }, 30_000);

    /** Provisioning creates an account, not a logged-in session. */
    it("creates no authentication session", async () => {
      expect(await prisma.authSession.count()).toBe(0);
    });
  });

  describe("a second execution", () => {
    const email = newEmail("rerun");
    const password = trackedPassword();
    const differentPassword = trackedPassword();

    let originalId = "";
    let originalHash = "";

    beforeAll(async () => {
      await provisionAdmin(prisma, { email, password });

      const row = await prisma.user.findUnique({
        where: { email },
        select: { id: true, passwordHash: true },
      });

      originalId = row?.id ?? "";
      originalHash = row?.passwordHash ?? "";
    }, 60_000);

    it("creates no second user for the same address", async () => {
      const before = await prisma.user.count();

      await expect(provisionAdmin(prisma, { email, password })).resolves.toBe("already-exists");

      expect(await prisma.user.count()).toBe(before);
    }, 30_000);

    /**
     * The property this script exists to guarantee. A bootstrap that silently rewrote a credential
     * would be a privilege-escalation path for anyone who could run it, and "I reran the seed"
     * would be indistinguishable from an attack.
     */
    it("does not reset the password when a different one is supplied", async () => {
      await expect(provisionAdmin(prisma, { email, password: differentPassword })).resolves.toBe(
        "already-exists",
      );

      const row = await prisma.user.findUnique({
        where: { email },
        select: { id: true, passwordHash: true },
      });

      expect(row?.id).toBe(originalId);
      // Byte-identical, which is stronger than "still verifies": a rehash of the same password
      // would produce a different salt and would also verify.
      expect(row?.passwordHash).toBe(originalHash);
    }, 30_000);

    it("still verifies against the original password only", async () => {
      const passwords = new PasswordService();

      await expect(passwords.verify(originalHash, password)).resolves.toBe(true);
      await expect(passwords.verify(originalHash, differentPassword)).resolves.toBe(false);
    }, 30_000);

    it("does not change the role", async () => {
      const row = await prisma.user.findUnique({ where: { email }, select: { role: true } });

      expect(row?.role).toBe(UserRole.ADMIN);
    });
  });

  describe("a disabled admin", () => {
    const email = newEmail("disabled");
    const password = trackedPassword();

    beforeAll(async () => {
      await provisionAdmin(prisma, { email, password });

      // The only way status moves today: a direct UPDATE. It fires the two ADR-012 triggers, which
      // stamp the credential cutoff and revoke the account's sessions in the same transaction.
      await prisma.$executeRaw`UPDATE users SET status = 'disabled' WHERE email = ${email}`;
    }, 60_000);

    it("is disabled with a credential cutoff before the rerun", async () => {
      const row = await prisma.user.findUnique({
        where: { email },
        select: { status: true, credentialsRevokedAt: true },
      });

      expect(row?.status).toBe(UserStatus.DISABLED);
      expect(row?.credentialsRevokedAt).not.toBeNull();
    });

    /**
     * A rerun must not undo an administrative decision. Re-enabling would be exactly as dangerous
     * as resetting a password, and for the same reason.
     */
    it("is not reactivated by a rerun", async () => {
      await expect(provisionAdmin(prisma, { email, password })).resolves.toBe("already-exists");

      const row = await prisma.user.findUnique({
        where: { email },
        select: { status: true, credentialsRevokedAt: true },
      });

      expect(row?.status).toBe(UserStatus.DISABLED);
      expect(row?.credentialsRevokedAt).not.toBeNull();
    }, 30_000);
  });

  describe("two executions at once", () => {
    /**
     * The unique index on `users.email` — not the existence check — is what makes this safe. One
     * call wins; the other either loses the insert or observes the winner's row. Neither outcome
     * may be a second account.
     */
    it("cannot produce a duplicate", async () => {
      const email = newEmail("race");
      const password = trackedPassword();
      const before = await prisma.user.count();

      const results = await Promise.allSettled([
        provisionAdmin(prisma, { email, password }),
        provisionAdmin(prisma, { email, password }),
      ]);

      expect(await prisma.user.count()).toBe(before + 1);

      const created = results.filter(
        (result) => result.status === "fulfilled" && result.value === "created",
      );

      expect(created.length).toBe(1);
    }, 60_000);
  });

  describe("a failure part-way through", () => {
    /**
     * Hashing happens after the existence check and before the insert, so a hashing fault is the
     * one way to fail between "decided to create" and "created". Nothing partial may survive it.
     */
    it("leaves no user behind when hashing fails", async () => {
      const email = newEmail("hashfail");
      const password = trackedPassword();
      const before = await prisma.user.count();

      const failing = {
        hash: (): Promise<string> => Promise.reject(new Error("argon2 unavailable")),
      };

      await expect(provisionAdmin(prisma, { email, password }, failing)).rejects.toThrow();

      expect(await prisma.user.count()).toBe(before);
      expect(await prisma.user.findUnique({ where: { email }, select: { id: true } })).toBeNull();
    }, 30_000);
  });

  describe("nothing belonging to the CMS is reachable from here", () => {
    /**
     * The clone is a copy of `sam_platform`, and `sam_platform` has no Payload tables — ADR-002
     * keeps them in a separate database this connection has no CONNECT privilege on. Asserted
     * against the catalogue rather than trusted.
     */
    it.each(["payload_preferences", "payload_locked_documents", "users_roles", "users_sessions"])(
      "has no %s table",
      async (table) => {
        const rows = await prisma.$queryRawUnsafe<{ present: string | null }[]>(
          `SELECT to_regclass('public.${table}')::text AS present`,
        );

        expect(rows[0]?.present).toBeNull();
      },
    );
  });

  describe("the composed pipeline, end to end", () => {
    /**
     * The CLI's own entry point, with a complete and valid environment — and it still refuses,
     * because the database is a clone. This is the ordering proof: everything except the database
     * identity was acceptable, and no row appeared.
     */
    it("refuses the clone and reports it without quoting a connection string", async () => {
      const before = await prisma.user.count();
      const password = trackedPassword();
      const said = transcript.length;

      const exitCode = await runAdminBootstrap({
        env: envFor(newEmail("pipeline"), password),
        connect,
        output,
      });

      expect(exitCode).toBe(1);
      expect(await prisma.user.count()).toBe(before);

      const message = transcript.slice(said).join("\n");

      expect(message).toContain(databaseNameOf(url));
      expect(message).toContain("No account was created");
      expect(message).not.toContain("postgresql://");
      expect(message).not.toContain(password);
    }, 60_000);
  });

  describe("cleanup", () => {
    it("leaves only rows this suite created, all of them under its own prefix", async () => {
      const foreign = await prisma.user.count({
        where: { email: { not: { startsWith: "admin-bootstrap-spec-" } } },
      });

      expect(foreign).toBe(0);
    });
  });
});

/* ------------------------------------------------------------------------- */
/* The leakage scan, over everything the suite said                           */
/* ------------------------------------------------------------------------- */

describe("nothing this suite produced leaks a secret", () => {
  /**
   * Runs last on purpose: `transcript` has by then accumulated every message every code path in
   * this file produced, and `secrets` every password it generated. A single assertion over both is
   * stronger than checking each message where it was made, because it also covers the messages
   * nobody thought to check.
   */
  it("printed no password and no hash, anywhere", () => {
    const everything = transcript.join("\n");

    for (const secret of secrets) {
      expect(everything).not.toContain(secret);
    }

    expect(everything).not.toContain("$argon2");
    expect(everything).not.toContain("postgresql://");
  });
});
