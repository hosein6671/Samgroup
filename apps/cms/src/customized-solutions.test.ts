/**
 * The `CustomizedSolutions` Global — its access rules, its draft behaviour, and the two boundaries
 * this page has that About Us did not.
 *
 * ── What these tests are ────────────────────────────────────────────────────
 *
 * The same division `access.test.ts` and `about-us.test.ts` state: these assert the **policy and
 * the wiring**, not Payload's own behaviour. Payload's Global draft and access mechanics were
 * established by reading its source and confirmed over HTTP during the About Us gate; nothing about
 * them changes for a second Global.
 *
 * ── The two boundaries worth a test of their own ────────────────────────────
 *
 * 1. **`readVersions` is explicit.** Payload defaults it for no Global, and `executeAccess` grants
 *    any authenticated identity when it is absent — so its absence would let the service credential
 *    read drafts. The rule is asserted here exactly as it is for About Us.
 * 2. **The form is not in this schema.** The request form is Prisma's and the API's, and a field
 *    for a label, an option list or a consent string appearing here would be the ownership boundary
 *    moving without anyone deciding to move it.
 */

import assert from "node:assert/strict";
import test, { describe } from "node:test";

import { CustomizedSolutions } from "./globals/customized-solutions";

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
  let fields: Field[] = CustomizedSolutions.fields;
  let found: Field | undefined;

  for (const segment of segments) {
    found = fields.find((entry) => "name" in entry && entry.name === segment);
    assert.ok(found !== undefined, `no field at "${path}"`);
    fields = "fields" in found ? (found.fields as Field[]) : [];
  }

  assert.ok(found !== undefined);

  return found;
}

/** One attribute of a field, read structurally — `Field` is a union with no shared `localized`. */
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

function topLevelNames(): string[] {
  return CustomizedSolutions.fields
    .filter((entry): entry is Field & { name: string } => "name" in entry)
    .map((entry) => entry.name);
}

describe("customized solutions registration", () => {
  test("it is the customized-solutions Global", () => {
    assert.equal(CustomizedSolutions.slug, "customized-solutions");
  });

  test("drafts are on, because publishing is a reviewed act", () => {
    assert.deepEqual(CustomizedSolutions.versions, { drafts: true });
  });
});

describe("customized solutions access", () => {
  test("anonymous reads nothing", () => {
    assert.equal(call(CustomizedSolutions.access?.read, ANONYMOUS), false);
  });

  test("the service identity is constrained to published documents", () => {
    assert.deepEqual(call(CustomizedSolutions.access?.read, SERVICE), PUBLISHED_ONLY);
  });

  test("editors read drafts, because that is what the admin panel is for", () => {
    assert.equal(call(CustomizedSolutions.access?.read, ADMIN), true);
    assert.equal(call(CustomizedSolutions.access?.read, CONTENT_MANAGER), true);
  });

  test("editors write, the service identity does not", () => {
    assert.equal(call(CustomizedSolutions.access?.update, CONTENT_MANAGER), true);
    assert.equal(call(CustomizedSolutions.access?.update, SERVICE), false);
    assert.equal(call(CustomizedSolutions.access?.update, ANONYMOUS), false);
  });

  test("versions are editors-only — the draft leak this rule exists to close", () => {
    assert.ok(
      CustomizedSolutions.access?.readVersions !== undefined,
      "readVersions has no Payload default: without it any authenticated identity reads drafts",
    );
    assert.equal(call(CustomizedSolutions.access?.readVersions, SERVICE), false);
    assert.equal(call(CustomizedSolutions.access?.readVersions, ANONYMOUS), false);
    assert.equal(call(CustomizedSolutions.access?.readVersions, CONTENT_MANAGER), true);
    assert.equal(call(CustomizedSolutions.access?.readVersions, ADMIN), true);
  });
});

describe("customized solutions schema", () => {
  test("it carries the approved page sections and the SEO group", () => {
    assert.deepEqual(topLevelNames(), [
      "hero",
      "introduction",
      "process",
      "whatCanWeCustomize",
      "seo",
    ]);
  });

  test("commercial programme and case content remain unmodelled until approved", () => {
    for (const absent of ["privateLabelProgramme", "caseExamples"]) {
      assert.ok(
        !topLevelNames().includes(absent),
        `${absent} must not be modelled before its copy exists`,
      );
    }
  });

  test("process steps and requirement dimensions carry claim-controlled explanations", () => {
    assert.equal(field("process.steps").type, "array");
    assert.deepEqual(names("process.steps"), ["name", "description"]);
    assert.equal(field("whatCanWeCustomize").type, "array");
    assert.deepEqual(names("whatCanWeCustomize"), ["title", "description"]);
  });

  test("the hero requires a heading — a document without one is not a page", () => {
    assert.equal(attribute("hero.title", "required"), true);
    assert.equal(attribute("hero.title", "localized"), true);
  });

  test("copy is localized", () => {
    for (const path of [
      "hero.eyebrow",
      "hero.supportingText",
      "hero.requestCta.label",
      "hero.routeCta.label",
      "introduction.heading",
      "introduction.body",
      "process.heading",
      "process.lead",
      "process.steps.name",
      "process.steps.description",
      "whatCanWeCustomize",
    ]) {
      assert.equal(attribute(path, "localized"), true, `${path} is copy and must be localized`);
    }
  });

  test("a route action carries a route key, never a URL", () => {
    const route = field("hero.routeCta.route");

    assert.equal(route.type, "select");
    assert.equal(attribute("hero.routeCta.route", "localized"), false);
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
  });

  /**
   * The structural anchor is code's, and this is the assertion that keeps it there.
   *
   * The request action jumps to the form on this same page. Giving the CMS a target field would let
   * an edit break a fragment somebody had already shared, and would put page anchors into a
   * vocabulary built to describe pages. The label is editorial; the destination is not.
   */
  test("the request action carries a label and no destination of any kind", () => {
    assert.deepEqual(names("hero.requestCta"), ["label"]);

    for (const forbidden of ["route", "href", "url", "target", "anchor"]) {
      assert.ok(
        !names("hero.requestCta").includes(forbidden),
        `the request action must not carry "${forbidden}" — its target is structural`,
      );
    }
  });

  test("rich text reaches consumers as HTML, and is not stored twice", () => {
    assert.equal(field("introduction.body").type, "richText");
    assert.ok(names("introduction").includes("bodyHtml"), "the HTML rendition must be a sibling");
    assert.equal(field("introduction.bodyHtml").type, "code");
  });

  /**
   * The form ownership boundary, asserted against the whole schema rather than field by field.
   *
   * The Custom Product Request form is Prisma's and the API's: its fourteen fields follow the
   * `custom_formulation_requests` columns and the DTO that writes them. If a field name from that
   * form ever appears in this Global, the boundary has moved.
   */
  test("no part of the request form is modelled here", () => {
    const serialized = JSON.stringify(CustomizedSolutions.fields);

    for (const formField of [
      "companyName",
      "requiredSpecifications",
      "productOrApplication",
      "preferredIncoterm",
      "estimatedQuantity",
      "consent",
      "EXW",
      "FOB",
    ]) {
      assert.ok(
        !serialized.includes(formField),
        `"${formField}" belongs to the request form, which is not CMS content`,
      );
    }
  });

  /**
   * No photograph is reserved anywhere in the page's own content.
   *
   * The SEO group is excluded deliberately and is not an exception to this: its `socialImage` and
   * `twitterImage` are the shared link-preview contract every Global carries, not imagery this page
   * displays. What is asserted is that the three content sections reserve no media slot — this page
   * has none in its design, and a field would be a slot waiting for one.
   */
  test("no media field exists in the page's own sections", () => {
    const contentSections = CustomizedSolutions.fields.filter(
      (entry) => !("name" in entry) || entry.name !== "seo",
    );

    assert.ok(
      !JSON.stringify(contentSections).includes('"upload"'),
      "no upload field is specified for this page's content",
    );
  });

  test("the shared SEO group is spread in, not restated", () => {
    assert.equal(field("seo").type, "group");
    assert.ok(names("seo").includes("metaTitle"));
    assert.ok(names("seo").includes("robotsIndex"));
  });
});
