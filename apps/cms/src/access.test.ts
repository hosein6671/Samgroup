/**
 * Access-control tests for `access.ts` and the two collections that consume it.
 *
 * ── Why `node:test` and not Jest ────────────────────────────────────────────
 *
 * Node 24's built-in test runner reads TypeScript directly through type stripping, so these tests
 * cost **no new dependency** — `apps/cms` has no test framework and adding one to assert four pure
 * predicates would be a large tool for a small job. `apps/api` keeps Jest because it tests a Nest
 * application with DI, mocks and async plumbing; nothing here needs any of that.
 *
 * ── What these tests are, and what they are not ─────────────────────────────
 *
 * They assert the **policy** — the predicates and the collection wiring that Payload calls. They do
 * not assert that Payload calls them, which is Payload's own behaviour and is verified separately
 * over HTTP against a running CMS. Both halves matter: the predicates could be right and wired to
 * the wrong operation, or wired correctly and wrong in themselves.
 */

import assert from "node:assert/strict";
import test, { describe } from "node:test";

import {
  adminOnly,
  canAccessAdminPanel,
  editorOnly,
  isAdmin,
  isEditor,
  isService,
  publishedForService,
} from "./access";
import { Pages } from "./collections/pages";
import { Users } from "./collections/users";

import type { Access, AccessArgs } from "payload";

/** The four identities the CMS can present. `null` is an unauthenticated request. */
const ANONYMOUS = null;
const ADMIN = { roles: ["admin"] };
const CONTENT_MANAGER = { roles: ["content-manager"] };
const SERVICE = { roles: ["service"] };

/** Payload hands access functions the whole request; only `user` is read. */
function as(user: unknown): AccessArgs {
  return { req: { user } } as unknown as AccessArgs;
}

/** The published-only query constraint the service identity must be reduced to. */
const PUBLISHED_ONLY = { _status: { equals: "published" } };

function call(access: Access | undefined, user: unknown): unknown {
  assert.ok(access !== undefined, "the collection must declare this access rule explicitly");

  return access(as(user));
}

describe("role predicates", () => {
  test("a role is only what the user actually carries", () => {
    assert.equal(isAdmin(ADMIN), true);
    assert.equal(isAdmin(CONTENT_MANAGER), false);
    assert.equal(isAdmin(SERVICE), false);
    assert.equal(isAdmin(ANONYMOUS), false);

    // An editor is admin OR content-manager — the service identity is neither.
    assert.equal(isEditor(ADMIN), true);
    assert.equal(isEditor(CONTENT_MANAGER), true);
    assert.equal(isEditor(SERVICE), false);
    assert.equal(isEditor(ANONYMOUS), false);

    assert.equal(isService(SERVICE), true);
    assert.equal(isService(ADMIN), false);
  });

  test("a malformed or absent roles field is never a grant", () => {
    for (const user of [{}, { roles: null }, { roles: "admin" }, { roles: [] }, undefined]) {
      assert.equal(isAdmin(user as never), false);
      assert.equal(isEditor(user as never), false);
      assert.equal(isService(user as never), false);
    }
  });
});

describe("anonymous access", () => {
  // (1) Anonymous Page read denied.
  test("cannot read Pages — not even published ones", () => {
    assert.equal(call(Pages.access?.read, ANONYMOUS), false);
    assert.equal(publishedForService(as(ANONYMOUS)), false);
  });

  // (2) Anonymous Page create/update/delete denied.
  test("cannot create, update or delete Pages", () => {
    assert.equal(call(Pages.access?.create, ANONYMOUS), false);
    assert.equal(call(Pages.access?.update, ANONYMOUS), false);
    assert.equal(call(Pages.access?.delete, ANONYMOUS), false);
  });

  test("cannot read or write Users, and cannot open the admin panel", () => {
    assert.equal(call(Users.access?.read, ANONYMOUS), false);
    assert.equal(call(Users.access?.create, ANONYMOUS), false);
    assert.equal(call(Users.access?.update, ANONYMOUS), false);
    assert.equal(call(Users.access?.delete, ANONYMOUS), false);
    assert.equal(canAccessAdminPanel(as(ANONYMOUS)), false);
  });
});

describe("service identity", () => {
  // (3) Service published Page read allowed — and (4) draft read denied, by the same rule.
  test("reads Pages only through a published-only constraint, never unconditionally", () => {
    const result = call(Pages.access?.read, SERVICE);

    // `true` here would be the bug: it would let a `?draft=true` through. The constraint is what
    // makes an unpublished page unreachable regardless of what NestJS asks for.
    assert.notEqual(result, true);
    assert.deepEqual(result, PUBLISHED_ONLY);
  });

  // (5) Service Page create/update/delete denied.
  test("cannot create, update or delete Pages", () => {
    assert.equal(call(Pages.access?.create, SERVICE), false);
    assert.equal(call(Pages.access?.update, SERVICE), false);
    assert.equal(call(Pages.access?.delete, SERVICE), false);
  });

  // (6) Service Users read denied.
  test("cannot read or write Users", () => {
    assert.equal(call(Users.access?.read, SERVICE), false);
    assert.equal(call(Users.access?.create, SERVICE), false);
    assert.equal(call(Users.access?.update, SERVICE), false);
    assert.equal(call(Users.access?.delete, SERVICE), false);
  });

  // (7) Service cannot use the CMS admin panel as an editor.
  test("cannot open the admin panel", () => {
    // Authenticated but not a person. Without this it could sign in and browse editorial content
    // with a credential that lives in a server's environment.
    assert.equal(canAccessAdminPanel(as(SERVICE)), false);
    assert.equal(Users.access?.admin, canAccessAdminPanel);
  });
});

describe("editorial identities", () => {
  test("admin and content manager read drafts and write Pages", () => {
    for (const editor of [ADMIN, CONTENT_MANAGER]) {
      // `true`, not a constraint: the admin panel exists to edit drafts.
      assert.equal(call(Pages.access?.read, editor), true);
      assert.equal(call(Pages.access?.create, editor), true);
      assert.equal(call(Pages.access?.update, editor), true);
      assert.equal(call(Pages.access?.delete, editor), true);
      assert.equal(canAccessAdminPanel(as(editor)), true);
    }
  });

  test("only an admin administers Users", () => {
    assert.equal(call(Users.access?.read, ADMIN), true);
    assert.equal(call(Users.access?.read, CONTENT_MANAGER), false);
    assert.equal(call(Users.access?.update, CONTENT_MANAGER), false);
  });

  test("only an admin may set roles, so nobody can promote themselves", () => {
    const roles = Users.fields.find((field) => "name" in field && field.name === "roles");

    assert.ok(roles !== undefined && "access" in roles);
    assert.equal(roles.access?.create?.(as(CONTENT_MANAGER) as never), false);
    assert.equal(roles.access?.update?.(as(CONTENT_MANAGER) as never), false);
    assert.equal(roles.access?.update?.(as(ADMIN) as never), true);
  });
});

describe("collection wiring", () => {
  test("Pages declares every operation explicitly rather than inheriting a default", () => {
    for (const operation of ["read", "create", "update", "delete"] as const) {
      assert.ok(Pages.access?.[operation] !== undefined, `Pages.access.${operation} is unset`);
    }
  });

  test("Pages keeps drafts enabled, which the published-only constraint depends on", () => {
    assert.equal(
      typeof Pages.versions === "object" && Pages.versions !== null && Pages.versions.drafts,
      true,
    );
  });

  test("the write gate is the editor gate and the Users gate is the admin gate", () => {
    assert.equal(Pages.access?.create, editorOnly);
    assert.equal(Users.access?.read, adminOnly);
  });
});
