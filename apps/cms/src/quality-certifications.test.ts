/**
 * The `QualityCertifications` Global — its access rules, its draft behaviour, and the three
 * boundaries this page has that neither Global before it did.
 *
 * ── What these tests are ────────────────────────────────────────────────────
 *
 * The same division `access.test.ts`, `about-us.test.ts` and `customized-solutions.test.ts` state:
 * these assert the **policy and the wiring**, not Payload's own behaviour. Payload's Global draft
 * and access mechanics were established by reading its source and confirmed over HTTP during the
 * About Us gate; nothing about them changes for a third Global.
 *
 * ── The three boundaries worth tests of their own ───────────────────────────
 *
 * 1. **No certification claim can be modelled here.** This Global carries the ordinary company-page
 *    write rule, so a Content Manager can publish it. SECURITY.md's RBAC matrix says a Content
 *    Manager may never publish a certification. Those two facts are compatible only while this
 *    schema is structurally incapable of holding a certificate — so the exclusion is asserted
 *    against the whole serialized field tree, not field by field.
 * 2. **Product taxonomy does not move into Payload.** `sampling.families` is an allow-listed select
 *    of the six frozen ADR-009 identifiers, storing keys and never labels, hrefs or rows.
 * 3. **`readVersions` is explicit.** Payload defaults it for no Global, and `executeAccess` grants
 *    any authenticated identity when it is absent.
 */

import assert from "node:assert/strict";
import test, { describe } from "node:test";

import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { Media } from "./collections/media";
import { QualityCertifications } from "./globals/quality-certifications";

import type { Access, AccessArgs, Field } from "payload";

const ANONYMOUS = null;
const ADMIN = { roles: ["admin"] };
const CONTENT_MANAGER = { roles: ["content-manager"] };
const SERVICE = { roles: ["service"] };

const PUBLISHED_ONLY = { _status: { equals: "published" } };

/** The six frozen Product Family identifiers, in SITE_STRUCTURE §4's order. */
const FAMILY_KEYS = [
  "base-oils",
  "lubricant-additives",
  "engine-oils-automotive-lubricants",
  "industrial-oils-lubricants",
  "marine-oils-lubricants",
  "antifreeze-coolants",
];

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
  let fields: Field[] = QualityCertifications.fields;
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
  return QualityCertifications.fields
    .filter((entry): entry is Field & { name: string } => "name" in entry)
    .map((entry) => entry.name);
}

describe("quality certifications registration", () => {
  test("it is the quality-certifications Global", () => {
    assert.equal(QualityCertifications.slug, "quality-certifications");
  });

  test("it sits with the other company pages", () => {
    assert.equal(QualityCertifications.admin?.group, "Company pages");
  });

  test("drafts are on — this page's own source calls it the highest-stakes one for accuracy", () => {
    assert.deepEqual(QualityCertifications.versions, { drafts: true });
  });
});

describe("quality certifications access", () => {
  test("anonymous reads nothing", () => {
    assert.equal(call(QualityCertifications.access?.read, ANONYMOUS), false);
  });

  test("the service identity is constrained to published documents", () => {
    assert.deepEqual(call(QualityCertifications.access?.read, SERVICE), PUBLISHED_ONLY);
  });

  test("editors read drafts, because that is what the admin panel is for", () => {
    assert.equal(call(QualityCertifications.access?.read, ADMIN), true);
    assert.equal(call(QualityCertifications.access?.read, CONTENT_MANAGER), true);
  });

  test("editors write, the service identity does not", () => {
    assert.equal(call(QualityCertifications.access?.update, CONTENT_MANAGER), true);
    assert.equal(call(QualityCertifications.access?.update, ADMIN), true);
    assert.equal(call(QualityCertifications.access?.update, SERVICE), false);
    assert.equal(call(QualityCertifications.access?.update, ANONYMOUS), false);
  });

  test("versions are editors-only — the draft leak this rule exists to close", () => {
    assert.ok(
      QualityCertifications.access?.readVersions !== undefined,
      "readVersions has no Payload default: without it any authenticated identity reads drafts",
    );
    assert.equal(call(QualityCertifications.access?.readVersions, SERVICE), false);
    assert.equal(call(QualityCertifications.access?.readVersions, ANONYMOUS), false);
    assert.equal(call(QualityCertifications.access?.readVersions, CONTENT_MANAGER), true);
    assert.equal(call(QualityCertifications.access?.readVersions, ADMIN), true);
  });
});

describe("quality certifications schema", () => {
  test("it carries the seven sections the page renders, and the SEO group", () => {
    assert.deepEqual(topLevelNames(), [
      "hero",
      "approach",
      "laboratory",
      "certifications",
      "documentation",
      "sampling",
      "closing",
      "seo",
    ]);
  });

  test("the hero requires a heading — a document without one is not a page", () => {
    assert.equal(attribute("hero.title", "required"), true);
    assert.equal(attribute("hero.title", "localized"), true);
  });

  /**
   * Every band that shows a label owns it, and owns it as localized copy.
   *
   * Three of these — `approach`, `laboratory`, `documentation` — rendered theirs as hardcoded
   * English until the eyebrow correction, on a page served in `en`, `fa` and `ar`. An eyebrow is a
   * visible line of page copy, not layout, so it belongs in the CMS (PROJECT_HANDOFF §6.7).
   */
  test("every section that renders an eyebrow models one, localized", () => {
    for (const section of [
      "hero",
      "approach",
      "laboratory",
      "certifications",
      "documentation",
      "sampling",
      "closing",
    ]) {
      assert.ok(
        names(section).includes("eyebrow"),
        `${section} renders an eyebrow and must own it`,
      );
      assert.equal(
        attribute(`${section}.eyebrow`, "localized"),
        true,
        `${section}.eyebrow is copy a reader reads and must be localized`,
      );
      assert.equal(field(`${section}.eyebrow`).type, "text");
    }
  });

  test("no eyebrow is required — an unwritten one renders nothing rather than English", () => {
    for (const section of ["approach", "laboratory", "documentation"]) {
      assert.equal(
        attribute(`${section}.eyebrow`, "required"),
        undefined,
        `${section}.eyebrow must stay optional, like every other eyebrow on this Global`,
      );
    }
  });

  test("the hero reserves no image, because the page's hero renders no frame", () => {
    for (const absent of ["image", "heroImage", "imageCaption"]) {
      assert.ok(!names("hero").includes(absent), `the hero must not model "${absent}"`);
    }
  });

  test("a testing stage says where it sits and never what happens inside it", () => {
    assert.equal(field("approach.stages").type, "array");
    assert.deepEqual(names("approach.stages"), ["name", "when"]);

    for (const absent of ["description", "tests", "procedure", "frequency", "criterion"]) {
      assert.ok(
        !names("approach.stages").includes(absent),
        `a stage must not model "${absent}" — no approved document describes one`,
      );
    }
  });

  test("copy is localized", () => {
    for (const path of [
      "hero.eyebrow",
      "hero.supportingText",
      "hero.indexLabel",
      "hero.primaryCta.label",
      "approach.eyebrow",
      "approach.heading",
      "approach.lead",
      "approach.footnote",
      "approach.stages.name",
      "approach.stages.when",
      "laboratory.eyebrow",
      "laboratory.heading",
      "laboratory.lead",
      "laboratory.registerLabel",
      "laboratory.orderNote",
      "laboratory.properties.name",
      "laboratory.unpublishedHeading",
      "laboratory.unpublished.name",
      "laboratory.unpublished.why",
      "laboratory.imageCaption",
      "certifications.eyebrow",
      "certifications.heading",
      "certifications.status",
      "certifications.statement",
      "certifications.note",
      "documentation.eyebrow",
      "documentation.heading",
      "documentation.lead",
      "documentation.registerLabel",
      "documentation.documents.name",
      "documentation.documents.scope",
      "documentation.note",
      "sampling.eyebrow",
      "sampling.statement",
      "sampling.familiesLabel",
      "sampling.limit",
      "closing.eyebrow",
      "closing.heading",
      "closing.lead",
      "closing.routes.label",
    ]) {
      assert.equal(attribute(path, "localized"), true, `${path} is copy and must be localized`);
    }
  });

  test("identifiers and the media relation are not localized", () => {
    for (const path of ["sampling.families", "closing.routes.route", "laboratory.image"]) {
      assert.equal(
        attribute(path, "localized"),
        false,
        `${path} is a fact or a key, not copy — localizing it would create a per-language identifier`,
      );
    }
  });

  test("a route action carries a route key, never a URL", () => {
    const route = field("closing.routes.route");

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
  });

  test("prose is plain text — this page renders no rich-text block anywhere", () => {
    const serialized = JSON.stringify(QualityCertifications.fields);

    assert.ok(
      !serialized.includes('"richText"'),
      "the sampling policy and the laboratory intro are single sentences in a fixed composition; a Lexical editor would carry markup the layout does not accept",
    );
    assert.equal(field("sampling.statement").type, "textarea");
    assert.equal(field("laboratory.lead").type, "textarea");
  });
});

/**
 * The laboratory register carries names and only names.
 *
 * An audit of this project found that **no approved document names a single test standard**, and a
 * designation cited wrongly against a real property is a technical error a buyer would specify
 * against. The absence of these fields is what makes that impossible rather than merely discouraged
 * — there is no slot for an ASTM number, a temperature or a result to be dropped into.
 */
describe("the laboratory register cannot become a capability claim", () => {
  test("a property is a name and nothing else", () => {
    assert.equal(field("laboratory.properties").type, "array");
    assert.deepEqual(names("laboratory.properties"), ["name"]);
  });

  test("no method, condition, value, accreditation or equipment field exists anywhere", () => {
    const serialized = JSON.stringify(QualityCertifications.fields).toLowerCase();

    for (const forbidden of [
      "method",
      "standard",
      "designation",
      "astm",
      "condition",
      "temperature",
      "unit",
      "typicalvalue",
      "result",
      "minvalue",
      "maxvalue",
      "accredit",
      "equipment",
      "instrument",
      "inhouse",
      "outsourced",
    ]) {
      assert.ok(
        !serialized.includes(`"name":"${forbidden}`),
        `no field may be named "${forbidden}" — a property name does not establish a method, an accreditation or a capability`,
      );
    }
  });

  test("the withheld caveats stay modelled, so the page can keep publishing them", () => {
    assert.equal(field("laboratory.unpublished").type, "array");
    assert.deepEqual(names("laboratory.unpublished"), ["name", "why"]);
  });

  test("the laboratory photograph is optional and carries no alt field of its own", () => {
    assert.equal(field("laboratory.image").type, "upload");
    assert.equal(attribute("laboratory.image", "required"), undefined);
    assert.ok(
      !names("laboratory").includes("imageAlt"),
      "alt text lives on the Media record, which is the platform's single place for describing an image",
    );
  });
});

/**
 * The certification exclusion — the security boundary of this whole gate.
 *
 * This Global is writable by a Content Manager under the ordinary company-page rule. SECURITY.md's
 * RBAC matrix says a Content Manager may **never** publish a certification. The only thing keeping
 * those two statements compatible is that this schema cannot hold one, so the assertion is made
 * against the entire serialized field tree rather than against the group in isolation — a
 * certification field smuggled into `documentation` or `laboratory` would be the same breach.
 */
describe("no certification claim can be published through this Global", () => {
  test("the certifications group is exactly five strings", () => {
    assert.deepEqual(names("certifications"), [
      "eyebrow",
      "heading",
      "status",
      "statement",
      "note",
    ]);
  });

  test("the group holds no array, repeater, relation or upload", () => {
    const group = field("certifications");

    assert.ok("fields" in group);

    for (const entry of group.fields as Field[]) {
      assert.ok(
        ["text", "textarea"].includes(entry.type),
        `certifications.${"name" in entry ? entry.name : entry.type} is a ${entry.type} — this section publishes one statement and no list`,
      );
    }
  });

  test("no field anywhere in the Global can name, number, date or file a certificate", () => {
    const serialized = JSON.stringify(QualityCertifications.fields).toLowerCase();

    for (const forbidden of [
      "certificatename",
      "certificatenumber",
      "certificateid",
      "certificatefile",
      "certificates",
      "certificate",
      "issuingbody",
      "issuer",
      "validfrom",
      "validuntil",
      "validity",
      "expiresat",
      "expiry",
      "accreditationbody",
      "licence",
      "license",
      "logo",
      "mark",
      "verificationurl",
      "externallink",
      "revoked",
      "lifecycle",
    ]) {
      assert.ok(
        !serialized.includes(`"name":"${forbidden}`),
        `no field may be named "${forbidden}" — the Certifications collection and its Admin-only publish gate are a later gate`,
      );
    }
  });

  test("no relation to a certifications collection exists", () => {
    const serialized = JSON.stringify(QualityCertifications.fields);

    assert.ok(!serialized.includes('"relationTo":"certifications"'));
    assert.ok(!serialized.includes('"type":"relationship"'));
  });

  /**
   * The SEO group's two social images are excluded deliberately: they are the shared `seoFields()`
   * contract, identical on `Pages`, `AboutUs` and `CustomizedSolutions`, and they belong to link
   * previews rather than to this page's content. What is being asserted is that **this Global's own
   * sections carry exactly one upload** — a second would be a certificate file by another name.
   */
  test("the page's own sections carry exactly one upload: the laboratory photograph", () => {
    const pageSections = QualityCertifications.fields.filter(
      (entry) => !("name" in entry) || entry.name !== "seo",
    );
    const uploads = JSON.stringify(pageSections).match(/"type":"upload"/g) ?? [];

    assert.equal(uploads.length, 1, "a second upload would be a certificate file by another name");
    assert.equal(field("laboratory.image").type, "upload");
    assert.equal(attribute("laboratory.image", "relationTo"), "media");
  });
});

/**
 * The Product taxonomy boundary.
 *
 * The six Product Families are `Category` data in `sam_platform`, and Payload may never mirror a
 * Prisma-owned entity (ADR-002). What this Global stores is which families the sampling policy
 * covers — identifiers, chosen from a closed list — and never their names, their addresses or
 * anything else about them.
 */
describe("sampling stores product family keys and nothing else about a family", () => {
  test("it is a non-localized multi-select over the six frozen identifiers", () => {
    const families = field("sampling.families");

    assert.equal(families.type, "select");
    assert.equal(attribute("sampling.families", "hasMany"), true);
    assert.equal(attribute("sampling.families", "localized"), false);
    assert.deepEqual(
      "options" in families
        ? (families.options as { value: string }[]).map((option) => option.value)
        : [],
      FAMILY_KEYS,
    );
  });

  test("at least one family is required — a policy without its scope is a broader promise", () => {
    assert.equal(attribute("sampling.families", "required"), true);

    const validate = attribute("sampling.families", "validate") as (
      value: unknown,
    ) => string | true;

    assert.ok(typeof validate === "function", "an empty selection must be refused at save time");
    assert.equal(typeof validate([]), "string");
    assert.equal(typeof validate(undefined), "string");
    assert.equal(typeof validate(null), "string");
    assert.equal(validate(["base-oils"]), true);
  });

  test("no product label, href, description or row is modelled", () => {
    const serialized = JSON.stringify(QualityCertifications.fields).toLowerCase();

    for (const forbidden of [
      "familylabel",
      "familyname",
      "familyhref",
      "familyurl",
      "categoryname",
      "categoryhref",
      "producturl",
      "productlabel",
    ]) {
      assert.ok(
        !serialized.includes(`"name":"${forbidden}`),
        `"${forbidden}" would make Payload an owner of Product taxonomy (ADR-002)`,
      );
    }

    // The option labels are admin-panel chrome for one dropdown; nothing serves them. What must not
    // exist is a *field* an editor could type a family's public name or address into.
    assert.ok(!names("sampling").includes("familyLinks"));
    assert.ok(!names("sampling").includes("families__labels"));
  });

  test("the sampling section models no heading — its statement is the heading", () => {
    assert.deepEqual(names("sampling"), [
      "eyebrow",
      "statement",
      "familiesLabel",
      "families",
      "limit",
    ]);
    assert.equal(attribute("sampling.statement", "required"), true);
  });
});

describe("the documentation register is informational, never a download list", () => {
  test("a document carries a name and an optional scope, and nothing else", () => {
    assert.equal(field("documentation.documents").type, "array");
    assert.deepEqual(names("documentation.documents"), ["name", "scope"]);
  });

  test("no href, file, access or gating field exists on it", () => {
    const serialized = JSON.stringify(field("documentation")).toLowerCase();

    for (const forbidden of [
      "href",
      "url",
      "file",
      "download",
      "downloadurl",
      "access",
      "gated",
      "media",
    ]) {
      assert.ok(
        !serialized.includes(`"name":"${forbidden}`),
        `"${forbidden}" would turn six document names into six files`,
      );
    }

    assert.ok(!JSON.stringify(field("documentation")).includes('"type":"upload"'));
  });

  test("the note that keeps the register from reading as downloads is a modelled field", () => {
    assert.equal(field("documentation.note").type, "textarea");
    assert.equal(attribute("documentation.note", "localized"), true);
  });
});

/**
 * The gate's own boundaries, asserted against the application rather than against one module.
 *
 * These are the four things CMS-2B promised **not** to do. Each is cheap to assert and expensive to
 * discover later, and the first is the one an ordinary code review would most easily miss: a
 * `Certifications` collection added "while we are in here" would bring the Admin-only publish gate
 * with it as an obligation, and nothing in this slice implements that gate.
 *
 * The config is read as source rather than imported: importing it builds the whole Payload config,
 * which reads a database URL, a secret and object-store credentials from the environment.
 */
describe("what this gate did not add", () => {
  const cmsSource = join(import.meta.dirname);

  test("the Global is registered, and it is the third of three", () => {
    const config = readFileSync(join(cmsSource, "payload.config.ts"), "utf8");

    assert.match(config, /globals:\s*\[AboutUs,\s*CustomizedSolutions,\s*QualityCertifications\]/);
  });

  test("no Certifications collection exists — its Admin-only publish gate is owed to a later gate", () => {
    const collections = readdirSync(join(cmsSource, "collections"));

    assert.deepEqual(collections.sort(), ["media.ts", "pages.ts", "users.ts"]);

    const config = readFileSync(join(cmsSource, "payload.config.ts"), "utf8");

    assert.match(config, /collections:\s*\[Users,\s*Pages,\s*Media\]/);
  });

  test("Media stays image-only — no PDF, no document type, no certificate file", () => {
    assert.deepEqual(
      Media.upload && typeof Media.upload === "object" ? Media.upload.mimeTypes : [],
      ["image/jpeg", "image/png", "image/webp", "image/avif", "image/svg+xml"],
    );
  });

  test("no preview, draft-mode or preview-token configuration was introduced", () => {
    const serialized = JSON.stringify(QualityCertifications);

    for (const forbidden of ["livePreview", "preview", "draftMode"]) {
      assert.ok(!serialized.includes(forbidden), `${forbidden} is deferred for Phase 1`);
    }
  });
});
