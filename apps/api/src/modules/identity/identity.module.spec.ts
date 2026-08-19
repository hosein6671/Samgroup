import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { JwtModule } from "@nestjs/jwt";

import { PrismaModule } from "../../prisma/prisma.module";

import { AccessTokenVerifier } from "./access-token-verifier";
import { AuthService } from "./auth.service";
import { AuthSessionsService } from "./auth-sessions.service";
import { IdentityModule } from "./identity.module";
import { JwtAuthGuard } from "./guards/jwt-auth.guard";
import { PasswordService } from "./password.service";
import { RolesGuard } from "./guards/roles.guard";
import { UsersService } from "./users.service";

/**
 * The module boundary, asserted rather than described.
 *
 * ## What this file is defending
 *
 * Identity owns `User` and `AuthSession`. Other modules need **authentication and RBAC** — they do
 * not need, and must not have, the `users` repository, a JWT signer, or anything that can mutate a
 * password or a session. The published surface is therefore three things: the two guards, and the
 * one narrow capability the guards depend on.
 *
 * That capability exists because of a Nest mechanic worth restating: a class named in `@UseGuards()`
 * is inserted into the injectables of the module that declares the **controller**, so whatever the
 * guard injects has to resolve there. The first attempt satisfied that by exporting `JwtModule` and
 * `UsersService`, which solved a wiring problem by publishing a repository. `AccessTokenVerifier`
 * is the replacement, and the tests below pin both halves: what is published, and what is not.
 *
 * ## Why the source scan, and not just the metadata check
 *
 * A metadata assertion says what is *offered*. It cannot say that nothing outside this directory
 * has found another way in — a deep import, a `new UsersService(...)`, a hand-rolled `JwtService`,
 * or a `prisma.user` lookup doing its own authentication. The second block reads the source of
 * every other module and fails on the mere mention. That is stricter than "nobody injects it": an
 * import that is not used yet is still a boundary that has been crossed.
 */

const MODULES_DIR = join(__dirname, "..");

function moduleMetadata(key: string): unknown[] {
  const value: unknown = Reflect.getMetadata(key, IdentityModule);

  return Array.isArray(value) ? value : [];
}

/** Every `.ts` file under `modules/`, except this module's own directory. */
function sourceFilesOutsideIdentity(): string[] {
  const found: string[] = [];

  const walk = (directory: string): void => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name);

      if (entry.isDirectory()) {
        if (entry.name !== "identity") walk(path);
        continue;
      }

      if (entry.name.endsWith(".ts")) found.push(path);
    }
  };

  walk(MODULES_DIR);

  return found;
}

/** Source with comments stripped, so a doc note explaining a rule does not violate it. */
function code(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/\/\/[^\n]*/g, " ");
}

function filesNaming(symbol: string): string[] {
  return sourceFilesOutsideIdentity().filter((path) =>
    code(readFileSync(path, "utf8")).includes(symbol),
  );
}

describe("what IdentityModule publishes", () => {
  it("publishes the two guards", () => {
    const exports = moduleMetadata("exports");

    expect(exports).toContain(JwtAuthGuard);
    expect(exports).toContain(RolesGuard);
  });

  /**
   * Without this the guards are exported but unusable: a consuming module builds its own instance
   * and cannot resolve its argument, so the application fails at **startup** — which no controller
   * spec catches, because a controller spec overrides the guard.
   */
  it("publishes the one capability the guards are built from", () => {
    expect(moduleMetadata("exports")).toContain(AccessTokenVerifier);
  });

  it("publishes exactly three things and nothing else", () => {
    expect(moduleMetadata("exports")).toEqual([JwtAuthGuard, RolesGuard, AccessTokenVerifier]);
  });
});

describe("what IdentityModule keeps to itself", () => {
  /**
   * The correction this file exists for. `UsersService` is the `users` repository —
   * `findCredentialsByEmail` returns a password hash and `listAll` returns the staff table — and
   * `JwtModule` is the signer. Neither is an authentication *capability*; both are the machinery
   * behind one, and publishing machinery to solve a wiring problem is how a module boundary is
   * lost without anyone deciding to lose it.
   */
  it.each([
    ["UsersService", UsersService],
    ["JwtModule", JwtModule],
    ["AuthSessionsService", AuthSessionsService],
    ["AuthService", AuthService],
    ["PasswordService", PasswordService],
    ["PrismaModule", PrismaModule],
  ])("does not export %s", (_name, exported) => {
    expect(moduleMetadata("exports")).not.toContain(exported);
  });

  it("still provides all of them internally — they are hidden, not removed", () => {
    const providers = moduleMetadata("providers");

    for (const provider of [
      UsersService,
      AuthService,
      AuthSessionsService,
      PasswordService,
      AccessTokenVerifier,
    ]) {
      expect(providers).toContain(provider);
    }
  });
});

describe("no module outside identity/ reaches past the boundary", () => {
  /**
   * The mere mention fails this. There is no legitimate reason for a file outside `identity/` to
   * name any of these: authentication is `@UseGuards(JwtAuthGuard)` plus `@Roles()`, and if
   * something ever needs more than that, the answer is a new method on the narrow boundary — not a
   * second module reading `users`.
   */
  it.each([
    ["UsersService", "the users repository"],
    ["JwtService", "the token signer"],
    ["JwtModule", "the signer's module"],
    ["@nestjs/jwt", "the JWT package"],
    ["AuthSessionsService", "the session store"],
    ["PasswordService", "password verification"],
  ])("does not name %s (%s)", (symbol) => {
    expect(filesNaming(symbol)).toEqual([]);
  });

  /**
   * No module outside Identity authenticates by reading `users` itself. This is the same rule as
   * the imports above, expressed against the query rather than the class — a module could have
   * reached `prisma.user` through `PrismaService`, which it legitimately holds for its own tables.
   */
  it("does not query the users table", () => {
    expect(filesNaming("prisma.user.")).toEqual([]);
  });

  /**
   * The capability that *is* published, used the way it is meant to be: named only by modules that
   * protect routes, and only through the guards. Today no module outside Identity injects it
   * directly — the guards do — and this records that rather than forbidding it, since injecting the
   * verifier is a legitimate use of the exported boundary if a future non-guard consumer needs it.
   */
  it("reaches identity only through the guards", () => {
    for (const path of filesNaming("JwtAuthGuard")) {
      expect(code(readFileSync(path, "utf8"))).toContain("RolesGuard");
    }
  });
});
