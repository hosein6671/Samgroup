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
  mediaRead,
  publishedForService,
} from "./access";
import { Media, mediaFileURL } from "./collections/media";
import { Pages } from "./collections/pages";
import { Users } from "./collections/users";
import { seoFields } from "./fields/seo";

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

describe("media access", () => {
  test("anonymous cannot read media, and cannot upload, replace or delete it", () => {
    // Anonymous read matters even though the OBJECTS are public: this governs the record — alt
    // text, filenames, sizes — and refusing it keeps Payload's REST API from being a second,
    // unaudited way to enumerate the CMS on a publicly routable host.
    assert.equal(call(Media.access?.read, ANONYMOUS), false);
    assert.equal(call(Media.access?.create, ANONYMOUS), false);
    assert.equal(call(Media.access?.update, ANONYMOUS), false);
    assert.equal(call(Media.access?.delete, ANONYMOUS), false);
  });

  test("the service identity reads media but can never write it", () => {
    // Read is unconditional here, unlike Pages, because media has no draft state to constrain on.
    assert.equal(call(Media.access?.read, SERVICE), true);
    assert.equal(call(Media.access?.create, SERVICE), false);
    assert.equal(call(Media.access?.update, SERVICE), false);
    assert.equal(call(Media.access?.delete, SERVICE), false);
  });

  test("editors manage media, which is the editorial role", () => {
    for (const editor of [ADMIN, CONTENT_MANAGER]) {
      assert.equal(call(Media.access?.read, editor), true);
      assert.equal(call(Media.access?.create, editor), true);
      assert.equal(call(Media.access?.update, editor), true);
      assert.equal(call(Media.access?.delete, editor), true);
    }
  });

  test("mediaRead grants nothing to a user carrying an unknown or malformed role", () => {
    for (const user of [{}, { roles: ["viewer"] }, { roles: "service" }, undefined]) {
      assert.equal(mediaRead(as(user)), false);
    }
  });

  test("every media operation is declared explicitly rather than inherited", () => {
    for (const operation of ["read", "create", "update", "delete"] as const) {
      assert.ok(Media.access?.[operation] !== undefined, `Media.access.${operation} is unset`);
    }

    assert.equal(Media.access?.create, editorOnly);
    assert.equal(Media.access?.read, mediaRead);
  });

  test("media never writes to a local disk, and accepts images only", () => {
    const upload = Media.upload;

    assert.ok(typeof upload === "object" && upload !== null);
    // DEVOPS.md forbids media on a container volume. Payload's default does exactly that, so this
    // flag is the difference between following the rule and silently breaking it.
    assert.equal(upload.disableLocalStorage, true);
    assert.equal(upload.staticDir, undefined);
    assert.ok(Array.isArray(upload.mimeTypes) && upload.mimeTypes.length > 0);
    assert.ok(upload.mimeTypes.every((type) => type.startsWith("image/")));
  });

  test("the public URL is origin-relative and carries no host, scheme or bucket", () => {
    // The nginx contract: /media/<prefix>/<file>. An absolute URL here would bake today's object
    // store — still undecided for production — into every media row in the database.
    assert.equal(mediaFileURL({ filename: "demo.png", prefix: "cms" }), "/media/cms/demo.png");
    // The plugin does not always pass a prefix; the collection's own is the fallback, never a bare
    // /media/demo.png that would resolve to a different object.
    assert.equal(mediaFileURL({ filename: "demo.png" }), "/media/cms/demo.png");

    for (const url of [
      mediaFileURL({ filename: "a.png", prefix: "cms" }),
      mediaFileURL({ filename: "b.webp" }),
    ]) {
      assert.ok(url.startsWith("/media/"));
      assert.ok(!url.includes("://"), "must carry no scheme or host");
      assert.ok(!url.includes("sam-public"), "must not leak the bucket name");
      assert.ok(!url.includes("9000"), "must not leak the object store endpoint");
      // The Payload-gated form would route browsers to the CMS origin, which ADR-003 forbids.
      assert.ok(!url.includes("/api/"), "must not be the Payload access-controlled file route");
    }
  });

  test("alt text is required and localized, and no unspecified field crept in", () => {
    const names = Media.fields.map((field) => ("name" in field ? field.name : undefined));

    // Exactly one declared field. Payload contributes filename/mimeType/filesize/width/height/url
    // itself; anything else here would be an invented DAM feature (no caption, credit or tags are
    // specified in any frozen document).
    assert.deepEqual(names, ["alt"]);

    const alt = Media.fields[0] as { required?: boolean; localized?: boolean } | undefined;

    assert.ok(alt !== undefined);
    // Required: an image with no alt text is an accessibility failure and a missing Image SEO
    // signal, so the CMS refuses to store one rather than leaving it to editorial discipline.
    assert.equal(alt.required, true);
    // Localized because alt text is read aloud and indexed as text, not because it is a fact.
    assert.equal(alt.localized, true);
  });
});

describe("SEO field group", () => {
  const seo = Pages.fields.find((field) => "name" in field && field.name === "seo");

  test("Pages carries the standard group, spread from the shared function", () => {
    assert.ok(seo !== undefined, "Pages must carry the seo group");
    assert.equal("type" in seo && seo.type, "group");
    // The same call must serve every future collection and Global — SEO_ARCHITECTURE.md §3 requires
    // one shared function, not per-collection boilerplate.
    assert.deepEqual(seoFields(), seoFields());
  });

  test("the group is exactly the frozen contract — no invented fields, no missing ones", () => {
    assert.ok(seo !== undefined && "fields" in seo);

    const names = seo.fields.map((field) => ("name" in field ? field.name : undefined));

    // Every entry is a row of SEO_ARCHITECTURE.md §2. `locale` and `alternates` are absent by
    // design: the first is what Payload's localization already provides, the second is derived from
    // which documents are genuinely translated.
    assert.deepEqual(names, [
      "metaTitle",
      "metaDescription",
      "canonicalUrl",
      "ogTitle",
      "ogDescription",
      "socialImage",
      "twitterCardType",
      "twitterTitle",
      "twitterDescription",
      "twitterImage",
      "robotsIndex",
      "robotsFollow",
      "keywords",
      "structuredDataOverride",
    ]);
  });

  test("copy is localized and switches are not", () => {
    assert.ok(seo !== undefined && "fields" in seo);

    const localized = new Map(
      seo.fields.map((field) => [
        "name" in field ? field.name : "",
        "localized" in field ? field.localized === true : false,
      ]),
    );

    for (const copy of ["metaTitle", "metaDescription", "ogTitle", "socialImage", "keywords"]) {
      assert.equal(localized.get(copy), true, `${copy} should be localized`);
    }

    // A noindex decision is about the entity, not about a language — per-locale robots flags would
    // let a page be quietly indexable in one locale and not another.
    for (const structural of ["robotsIndex", "robotsFollow", "twitterCardType", "canonicalUrl"]) {
      assert.equal(localized.get(structural), false, `${structural} should not be localized`);
    }
  });

  test("robots default to indexable and the card type to the §2 default", () => {
    assert.ok(seo !== undefined && "fields" in seo);

    const byName = new Map(seo.fields.map((field) => ["name" in field ? field.name : "", field]));

    for (const flag of ["robotsIndex", "robotsFollow"]) {
      const field = byName.get(flag);

      assert.ok(field !== undefined && "defaultValue" in field);
      // Defaulting to false would silently deindex every page an editor creates.
      assert.equal(field.defaultValue, true);
    }

    const card = byName.get("twitterCardType");

    assert.ok(card !== undefined && "defaultValue" in card);
    assert.equal(card.defaultValue, "summary_large_image");
  });

  test("both image fields point at the Media collection", () => {
    assert.ok(seo !== undefined && "fields" in seo);

    for (const name of ["socialImage", "twitterImage"]) {
      const field = seo.fields.find((entry) => "name" in entry && entry.name === name) as
        { type?: string; relationTo?: unknown } | undefined;

      assert.ok(field !== undefined, `${name} is missing from the SEO group`);
      // An upload relationship, not a free URL string: SEO_ARCHITECTURE.md §2's `socialImageId`
      // points at Media, which is what lets the API serve a real URL and alt text together.
      assert.equal(field.type, "upload");
      assert.equal(field.relationTo, Media.slug);
    }
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

/**
 * The Pages versions gate — a hole that was open until the CMS-2B gate closed it.
 *
 * ── What was wrong ──────────────────────────────────────────────────────────
 *
 * `Pages.access.read` has always been `publishedForService`, so the NestJS service credential could
 * only ever read *published* legal pages through `/api/pages`. But `readVersions` was unset, and in
 * `payload@3.88.0` that is not a safe default: a `grep` for `readVersions` across `payload/dist`
 * finds exactly one assignment (`folders/createFolderCollection.js`) and none in
 * `collections/config/sanitize.js`, so a collection is given no default rule — and `executeAccess`
 * then takes its `if (req.user) return true` branch (`auth/executeAccess.js`) for **any**
 * authenticated identity when an access function is absent.
 *
 * So `/api/pages/versions` and `/api/pages/:id/versions/:versionId` were a second door onto the same
 * drafts, standing beside the guarded one — and the drafts here are unreviewed legal text.
 *
 * This is the identical hole `AboutUs` found for a Global during CMS-1. It was not a Global-only
 * problem, and these tests fail if the line is ever removed again.
 *
 * ── What is deliberately unchanged ──────────────────────────────────────────
 *
 * Nothing else about Pages. Same schema, same four rules, same drafts setting, same anonymous
 * refusal, same published-only service read — asserted below so the hardening is provably narrow.
 */
describe("Pages versions are editors-only", () => {
  test("the rule is declared explicitly, because Payload defaults it to nothing safe", () => {
    assert.ok(
      Pages.access?.readVersions !== undefined,
      "readVersions has no Payload default for a collection either: without it any authenticated identity reads drafts",
    );
  });

  test("the service identity cannot read a Page version", () => {
    assert.equal(call(Pages.access?.readVersions, SERVICE), false);
  });

  test("anonymous cannot read a Page version", () => {
    assert.equal(call(Pages.access?.readVersions, ANONYMOUS), false);
  });

  test("editors keep the version access their editorial work depends on", () => {
    assert.equal(call(Pages.access?.readVersions, CONTENT_MANAGER), true);
    assert.equal(call(Pages.access?.readVersions, ADMIN), true);
  });

  test("the versions rule is the editor gate, not a new predicate", () => {
    assert.equal(Pages.access?.readVersions, editorOnly);
  });

  test("published Page reads are unchanged by the hardening", () => {
    // The service identity still reads published pages, and still only published ones.
    assert.deepEqual(call(Pages.access?.read, SERVICE), PUBLISHED_ONLY);
    assert.equal(call(Pages.access?.read, ANONYMOUS), false);
    assert.equal(call(Pages.access?.read, CONTENT_MANAGER), true);
    assert.equal(call(Pages.access?.read, ADMIN), true);
  });

  test("the write rules are unchanged by the hardening", () => {
    for (const operation of ["create", "update", "delete"] as const) {
      assert.equal(call(Pages.access?.[operation], CONTENT_MANAGER), true);
      assert.equal(call(Pages.access?.[operation], SERVICE), false);
      assert.equal(call(Pages.access?.[operation], ANONYMOUS), false);
    }
  });

  test("the Pages schema is untouched — this was a security fix, not a redesign", () => {
    const fieldNames = Pages.fields
      .filter((entry): entry is (typeof Pages.fields)[number] & { name: string } => "name" in entry)
      .map((entry) => entry.name);

    assert.deepEqual(fieldNames, ["title", "slug", "body", "bodyHtml", "lastUpdatedDate", "seo"]);
  });
});

describe("collection wiring", () => {
  test("Pages declares every operation explicitly rather than inheriting a default", () => {
    for (const operation of ["read", "create", "update", "delete", "readVersions"] as const) {
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
