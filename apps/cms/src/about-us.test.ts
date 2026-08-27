/**
 * The `AboutUs` Global — its access rules, its draft behaviour and the shape of its schema.
 *
 * ── What these tests are ────────────────────────────────────────────────────
 *
 * The same division `access.test.ts` states: these assert the **policy and the wiring**, not
 * Payload's own behaviour. Whether Payload applies `access.read` to a Global read, and whether a
 * draft save skips the Global's own row, is Payload's behaviour — established by reading its source
 * (`globals/operations/findOne.js`, `globals/operations/update.js`, `globals/config/sanitize.js`,
 * `@payloadcms/drizzle/dist/findGlobal.js`) and confirmed over HTTP against a running CMS.
 *
 * What is asserted here is the half that is ours to get wrong: that the rules are declared, that
 * they are the right rules, and that the schema is the page rather than a superset of it.
 *
 * ── `readVersions` has a test of its own for a reason ───────────────────────
 *
 * It is the one access rule Payload does **not** default (verified in `globals/config/sanitize.js`),
 * and `executeAccess` answers `true` for any authenticated identity when an access function is
 * absent. Leaving it off would let the `service` credential read every draft through
 * `/api/globals/about-us/versions` — the published-only contract leaking through the door beside
 * the one it guards. The test fails if the line is ever removed.
 */

import assert from "node:assert/strict";
import test, { describe } from "node:test";

import { AboutUs } from "./globals/about-us";

import type { Access, AccessArgs, Field } from "payload";

const ANONYMOUS = null;
const ADMIN = { roles: ["admin"] };
const CONTENT_MANAGER = { roles: ["content-manager"] };
const SERVICE = { roles: ["service"] };

const PUBLISHED_ONLY = { _status: { equals: "published" } };

function as(user: unknown): AccessArgs {
  return { req: { user } } as unknown as AccessArgs;
}

function call(access: Access | undefined, user: unknown): unknown {
  assert.ok(access !== undefined, "the Global must declare this access rule explicitly");

  return access(as(user));
}

/** Fields are addressed by name, and nested groups by a dotted path. */
function field(path: string): Field {
  const segments = path.split(".");
  let fields: Field[] = AboutUs.fields;
  let found: Field | undefined;

  for (const segment of segments) {
    found = fields.find((entry) => "name" in entry && entry.name === segment);
    assert.ok(found !== undefined, `no field at "${path}"`);
    fields = "fields" in found ? (found.fields as Field[]) : [];
  }

  assert.ok(found !== undefined);

  return found;
}

/**
 * One attribute of a field, read structurally.
 *
 * `Field` is a union whose members do not all carry `required` or `localized` — a UI field has
 * neither, a collapsible has no `localized` — so the union has no such property to read. The tests
 * below are about what the configuration says, not about which union member TypeScript picked.
 */
function attribute(path: string, key: string): unknown {
  return (field(path) as unknown as Record<string, unknown>)[key];
}

function names(path: string): string[] {
  const parent = field(path);

  assert.ok("fields" in parent, `"${path}" has no sub-fields`);

  return (parent.fields as Field[])
    .filter((entry): entry is Field & { name: string } => "name" in entry)
    .map((entry) => entry.name);
}

describe("registration", () => {
  test("it is the about-us Global", () => {
    assert.equal(AboutUs.slug, "about-us");
  });

  test("drafts are on, because publishing is a reviewed act", () => {
    assert.deepEqual(AboutUs.versions, { drafts: true });
  });
});

describe("access", () => {
  test("anonymous reads nothing", () => {
    assert.equal(call(AboutUs.access?.read, ANONYMOUS), false);
  });

  test("the service identity is constrained to published documents", () => {
    assert.deepEqual(call(AboutUs.access?.read, SERVICE), PUBLISHED_ONLY);
  });

  test("editors read drafts, because that is what the admin panel is for", () => {
    assert.equal(call(AboutUs.access?.read, ADMIN), true);
    assert.equal(call(AboutUs.access?.read, CONTENT_MANAGER), true);
  });

  test("editors write, the service identity does not", () => {
    assert.equal(call(AboutUs.access?.update, CONTENT_MANAGER), true);
    assert.equal(call(AboutUs.access?.update, ADMIN), true);
    assert.equal(call(AboutUs.access?.update, SERVICE), false);
    assert.equal(call(AboutUs.access?.update, ANONYMOUS), false);
  });

  test("versions are editors-only — the draft leak this rule exists to close", () => {
    assert.ok(
      AboutUs.access?.readVersions !== undefined,
      "readVersions has no Payload default: without it any authenticated identity reads drafts",
    );
    assert.equal(call(AboutUs.access?.readVersions, SERVICE), false);
    assert.equal(call(AboutUs.access?.readVersions, ANONYMOUS), false);
    assert.equal(call(AboutUs.access?.readVersions, CONTENT_MANAGER), true);
    assert.equal(call(AboutUs.access?.readVersions, ADMIN), true);
  });
});

describe("schema", () => {
  test("it carries the six sections the About page renders, and the SEO group", () => {
    const top = AboutUs.fields
      .filter((entry): entry is Field & { name: string } => "name" in entry)
      .map((entry) => entry.name);

    assert.deepEqual(top, [
      "hero",
      "whoWeAre",
      "expertise",
      "team",
      "qualityStandards",
      "closing",
      "seo",
    ]);
  });

  test("nothing is modelled for content that has never been approved", () => {
    const top = AboutUs.fields
      .filter((entry): entry is Field & { name: string } => "name" in entry)
      .map((entry) => entry.name);

    for (const absent of ["milestones", "competitiveAdvantages"]) {
      assert.ok(!top.includes(absent), `${absent} must not be modelled before its copy exists`);
    }
  });

  test("the hero requires a heading — a document without one is not a page", () => {
    assert.equal(attribute("hero.title", "required"), true);
    assert.equal(attribute("hero.title", "localized"), true);
  });

  test("copy is localized", () => {
    for (const path of [
      "hero.eyebrow",
      "hero.supportingText",
      "whoWeAre.heading",
      "whoWeAre.body",
      "expertise.heading",
      "expertise.lead",
      "team.eyebrow",
      "team.heading",
      "team.lead",
      "qualityStandards.footnote",
      "closing.heading",
    ]) {
      assert.equal(attribute(path, "localized"), true, `${path} is copy and must be localized`);
    }
  });

  test("structural identifiers are not localized", () => {
    /*
     * A destination and a photograph are the same in every language. Localising either would mean
     * three URLs for one page and three uploads for one image — the "non-localized fact fields"
     * rule the content architecture states.
     */
    for (const path of [
      "hero.primaryCta.route",
      "hero.secondaryCta.route",
      "qualityStandards.footnoteCta.route",
      "hero.image",
      "whoWeAre.image",
      "team.image",
      "qualityStandards.image",
    ]) {
      assert.equal(attribute(path, "localized"), false, `${path} is a fact, not copy`);
    }
  });

  test("a call to action carries a route key, never a URL", () => {
    const route = field("hero.primaryCta.route");

    assert.equal(route.type, "select");
    assert.deepEqual(
      "options" in route
        ? (route.options as { value: string }[]).map((option) => option.value)
        : [],
      [
        "products",
        "customized-solutions",
        "quality-certifications",
        "contact-us",
        "request-a-quote",
      ],
    );
    assert.deepEqual(names("hero.primaryCta"), ["label", "route"]);
  });

  test("rich text reaches consumers as HTML, and is not stored twice", () => {
    assert.equal(field("whoWeAre.body").type, "richText");
    assert.ok(names("whoWeAre").includes("bodyHtml"), "the HTML rendition must be a sibling");
    assert.equal(field("whoWeAre.bodyHtml").type, "code");
  });

  test("images are uploads into the editorial Media collection", () => {
    const image = field("hero.image");

    assert.equal(image.type, "upload");
    assert.equal("relationTo" in image ? image.relationTo : null, "media");
    /*
     * No `alt` field beside it: alt text is required and localized on the Media record itself, which
     * is the platform's single place for describing an image.
     */
    assert.ok(!names("hero").includes("alt"));
  });

  test("repeating content is a repeater, never a fixed set of fields", () => {
    for (const path of [
      "whoWeAre.positions",
      "expertise.items",
      "team.functions",
      "qualityStandards.items",
      "closing.routes",
    ]) {
      assert.equal(field(path).type, "array", `${path} must be an array`);
    }
  });

  test("the shared SEO group is spread in, not restated", () => {
    const seo = field("seo");

    assert.equal(seo.type, "group");
    assert.ok(names("seo").includes("metaTitle"));
    assert.ok(names("seo").includes("socialImage"));
    assert.ok(names("seo").includes("robotsIndex"));
  });
});
