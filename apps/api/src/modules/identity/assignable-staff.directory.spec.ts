import { readFileSync, readdirSync } from "node:fs";
import { join, sep } from "node:path";

import { AssignableStaffDirectory } from "./assignable-staff.directory";
import { UserRole, UserStatus } from "../../prisma/generated/client";

import type { PrismaService } from "../../prisma/prisma.service";

/**
 * The assignee-eligibility contract Identity publishes to Forms.
 *
 * ## What these tests are really pinning
 *
 * The three conditions are **in the query**, not in a branch afterwards. That distinction matters:
 * a version that fetched the row and then checked `role` in JavaScript would behave identically
 * here but would have pulled a staff record — including the password hash, since Prisma returns
 * every scalar without a `select` — into a service that must never hold one. So the assertions read
 * the `where` and the `select`, not just the boolean.
 */

function harness(row: { id: string } | null = { id: "u1" }): {
  directory: AssignableStaffDirectory;
  findFirst: jest.Mock;
  findMany: jest.Mock;
} {
  const findFirst = jest.fn().mockResolvedValue(row);
  const findMany = jest.fn().mockResolvedValue([]);
  const prisma = { user: { findFirst, findMany } } as unknown as PrismaService;

  return { directory: new AssignableStaffDirectory(prisma), findFirst, findMany };
}

describe("isAssignable", () => {
  it("answers true only through a query that already demands active + sales_expert", async () => {
    const { directory, findFirst } = harness();

    await expect(directory.isAssignable("u1")).resolves.toBe(true);

    expect(findFirst).toHaveBeenCalledWith({
      where: { id: "u1", status: UserStatus.ACTIVE, role: UserRole.SALES_EXPERT },
      select: { id: true },
    });
  });

  /**
   * One indexed lookup and one boolean, so the caller cannot tell *which* condition failed — a
   * missing user, a disabled one and a Content Manager are indistinguishable from outside. That is
   * what stops the endpoint being a probe into the staff list.
   */
  it("answers false for anything the query does not match", async () => {
    const { directory } = harness(null);

    await expect(directory.isAssignable("u1")).resolves.toBe(false);
  });

  /** The one column that must never leave this module cannot be in a `select: { id: true }`. */
  it("selects nothing but the id — no email, role, status or password hash", async () => {
    const { directory, findFirst } = harness();

    await directory.isAssignable("u1");

    expect(Object.keys(findFirst.mock.calls[0][0].select)).toEqual(["id"]);
  });

  it("returns a boolean, never the row", async () => {
    const { directory } = harness({ id: "u1" });

    const result = await directory.isAssignable("u1");

    expect(typeof result).toBe("boolean");
  });
});

describe("resolveAuditEmails", () => {
  it("returns id → email and nothing else", async () => {
    const { directory, findMany } = harness();

    findMany.mockResolvedValue([
      { id: "u1", email: "ada@samgp.test" },
      { id: "u2", email: "grace@samgp.test" },
    ]);

    const emails = await directory.resolveAuditEmails(["u1", "u2"]);

    expect(emails.get("u1")).toBe("ada@samgp.test");
    expect(findMany).toHaveBeenCalledWith({
      where: { id: { in: ["u1", "u2"] } },
      select: { id: true, email: true },
    });
  });

  /**
   * Deliberately **not** filtered by status or role. The previous owner of a lead may since have
   * been disabled or had their role changed; if this shared `isAssignable`'s conditions, their name
   * would vanish from the handover record — losing exactly the identity the snapshot exists to
   * preserve.
   */
  it("does not filter by status or role — a past owner may be neither active nor sales", async () => {
    const { directory, findMany } = harness();

    await directory.resolveAuditEmails(["u1"]);

    const where = findMany.mock.calls[0][0].where;

    expect(where).not.toHaveProperty("status");
    expect(where).not.toHaveProperty("role");
  });

  it("de-duplicates ids and skips the query entirely when there are none", async () => {
    const { directory, findMany } = harness();

    await directory.resolveAuditEmails(["u1", "u1"]);
    expect(findMany.mock.calls[0][0].where.id.in).toEqual(["u1"]);

    findMany.mockClear();
    await expect(directory.resolveAuditEmails([])).resolves.toEqual(new Map());
    expect(findMany).not.toHaveBeenCalled();
  });

  /** An id that names nobody — a deleted account — simply has no entry; the caller records null. */
  it("omits ids that resolve to nobody rather than inventing a value", async () => {
    const { directory, findMany } = harness();

    findMany.mockResolvedValue([]);

    await expect(directory.resolveAuditEmails(["gone"])).resolves.toEqual(new Map());
  });
});

/**
 * The boundary as a rule, not as a habit.
 *
 * `resolveAuditEmails` exists because assignment history must survive a physical `User` deletion,
 * and it is the one crack in an otherwise boolean-only contract. A crack widens: the next feature
 * that wants "the name of a user" will find this method sitting there, and nothing about its
 * signature says no. These tests are the "no".
 */
describe("the snapshot boundary stays narrow", () => {
  const source = readFileSync(join(__dirname, "assignable-staff.directory.ts"), "utf8");

  /** Comments stripped, so the doc block explaining a rule cannot satisfy or violate it. */
  const code = source.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/\/\/[^\n]*/g, " ");

  it("publishes exactly two methods", () => {
    const methods = Object.getOwnPropertyNames(AssignableStaffDirectory.prototype).filter(
      (name) => name !== "constructor",
    );

    expect(methods.sort()).toEqual(["isAssignable", "resolveAuditEmails"]);
  });

  /**
   * The whole point. A `select` that grew a field would hand Forms a profile attribute it has no
   * business holding — and would do it silently, because the return type is a `Map` either way.
   */
  it("selects no field beyond id and email, anywhere in the module", () => {
    const selects = [...code.matchAll(/select:\s*\{([^}]*)\}/g)].map((match) => match[1] ?? "");

    expect(selects.length).toBeGreaterThan(0);

    for (const select of selects) {
      for (const forbidden of [
        "passwordHash",
        "role",
        "status",
        "organizationId",
        "credentialsRevokedAt",
        "createdAt",
        "authSessions",
      ]) {
        expect(select).not.toContain(forbidden);
      }
    }
  });

  it("offers no list, search or lookup-by-email surface", () => {
    for (const forbidden of ["findByEmail", "list", "search", "findAll", "take:", "skip:"]) {
      expect(code).not.toContain(forbidden);
    }
  });

  /** `include` returns relations whole; `select` is the only shape this module may use. */
  it("never uses include, and never returns a row", () => {
    expect(code).not.toContain("include:");
    expect(code).not.toMatch(/return\s+(rows|match|user)\s*;/);
  });
});

describe("who is allowed to call the snapshot lookup", () => {
  const MODULES = join(__dirname, "..");

  function sourcesNaming(symbol: string): string[] {
    const found: string[] = [];

    const walk = (directory: string): void => {
      for (const entry of readdirSync(directory, { withFileTypes: true })) {
        const path = join(directory, entry.name);

        if (entry.isDirectory()) {
          walk(path);
          continue;
        }

        if (!entry.name.endsWith(".ts") || entry.name.endsWith(".spec.ts")) continue;
        if (path.includes(`${sep}identity${sep}`)) continue;

        const code = readFileSync(path, "utf8")
          .replace(/\/\*[\s\S]*?\*\//g, " ")
          .replace(/\/\/[^\n]*/g, " ");

        if (code.includes(symbol)) found.push(entry.name);
      }
    };

    walk(MODULES);

    return found;
  }

  /**
   * **One call site, and it is the workflow mutation.** If a second appears, this fails and the
   * question "should that consumer be reading staff identity at all?" gets asked deliberately
   * rather than answered by an import.
   */
  it("is called only from the lead workflow mutation service", () => {
    expect(sourcesNaming("resolveAuditEmails")).toEqual(["lead-workflow.service.ts"]);
  });

  it("is the only Identity surface Forms names for staff identity", () => {
    expect(sourcesNaming("AssignableStaffDirectory").sort()).toEqual(["lead-workflow.service.ts"]);
  });
});
