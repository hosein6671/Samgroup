import { describe, expect, it, vi } from "vitest";

import { accessibleName, elementsOf, findLinks, findTags, textOf } from "@test/element-tree";

import {
  BackToQueue,
  DetailFailed,
  DetailForbidden,
  DetailInvalidId,
  DetailNotFound,
  DetailUnavailable,
  ReviewDetailFrame,
} from "./detail-shell";
import { ProductClaimDetail } from "./product-claim-detail";
import { DEFAULT_LIMIT, DEFAULT_SORT } from "./review-query";
import { SpecificationDetail } from "./specification-detail";

import type { ReviewQueueQuery } from "./review-query";
import type { ReviewDetailResponse } from "@sam-group/types";
import type { ReactNode } from "react";

/**
 * The Review detail screens against the **WCAG 2.2 AA** target frozen for Admin UI.
 *
 * ## What these tests can and cannot prove
 *
 * They assert **structure and naming** in what the Server Components return: one `h1`, a coherent
 * heading outline, real definition lists, real lists for blockers, evidence and history, accessible
 * link names, `<time>`, direction isolation on every technical value, and the absence of
 * pointer-only affordances. That is the part of WCAG decidable from markup, and the part that
 * regresses silently.
 *
 * They do **not** prove contrast — that is `admin-contrast.spec.ts`, against the real tokens — and
 * they do not prove focus order, focus visibility, target size in pixels or reflow at 200% zoom,
 * which need a browser. No axe, jsdom or testing-library dependency was added.
 */

vi.mock("@/features/admin/actions", () => ({ signOut: vi.fn() }));

const ADMIN = { email: "admin@samgp.com", role: "admin" };
const QUERY: ReviewQueueQuery = { page: 3, limit: DEFAULT_LIMIT, sort: DEFAULT_SORT };

/**
 * A subject whose values are deliberately hostile to a bidi-naive renderer: a right-to-left product
 * name, a raw property with an embedded RTL run, and a long hash.
 *
 * Admin content is English today. The point of the fixture is that a *future* catalogue row in
 * Persian or Arabic must not be able to reorder the identifiers next to it.
 */
const SUBJECT: ReviewDetailResponse = {
  subjectType: "specification",
  id: "11111111-1111-4111-8111-111111111111",
  reviewStatus: "needs_review",
  createdAt: "2026-08-24T09:00:00.000Z",
  deletedAt: null,
  product: {
    slug: "hsb-2000",
    name: "روغن موتور HSB 2000",
    sourceRef: "HSB-001",
    family: "industrial-oils-lubricants",
    productType: null,
  },
  grade: { id: "g1", label: "SAE 40", gradeSystem: "sae" },
  specification: {
    propertyKey: "kinematic_viscosity_100c",
    displayValue: "11.5",
    valueType: "point",
    numericMin: "11.500000",
    numericMax: null,
    pairFirst: null,
    pairSecond: null,
    unit: "mm2/s",
    method: "ASTM D445",
    qualifier: null,
    resultBasis: "typical",
  },
  claim: null,
  evidenceSetHash: "2222222222222222222222222222222222222222222222222222222222222222",
  evidence: [
    {
      sourceFactId: "aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa",
      role: "primary",
      note: null,
      rawProperty: "گرانروی @100C",
      rawValue: "11.5",
      rawUnit: "cSt",
      rawMethod: "ASTM D445",
      rawGrade: null,
      extractionMethod: "spreadsheet_cell",
      unitClassification: "unrecognized",
      resultBasis: "typical",
      pageNumber: 4,
      sheetName: null,
      rowNumber: null,
      columnLabel: null,
      document: {
        id: "dddddddd-1111-4111-8111-dddddddddddd",
        title: "برگه اطلاعات فنی HSB 2000",
        publisher: null,
        locatorType: "uploaded_file",
        locatorValue: "hsb-2000-tds.xlsx",
        revisionLabel: null,
        documentDate: null,
        retrievedAt: "2026-08-01T00:00:00.000Z",
        assetSha256: "9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08",
        assetMediaType: null,
        assetByteSize: null,
        supersededById: null,
      },
    },
  ],
  mappings: [],
  approvalBlockers: ["The specification cites no evidence."],
  eligibleForApproval: false,
  history: [
    {
      id: "eeeeeeee-1111-4111-8111-eeeeeeeeeeee",
      decision: "needs_review",
      reviewerEmail: "reviewer@samgp.com",
      reviewerId: null,
      reviewedAt: "2026-08-20T11:30:00.000Z",
      note: "Returned pending a unit check.",
      evidenceSetHash: "1111111111111111111111111111111111111111111111111111111111111111",
      evidenceCurrent: true,
    },
  ],
};

const CLAIM_SUBJECT: ReviewDetailResponse = {
  ...SUBJECT,
  subjectType: "product_claim",
  id: "22222222-2222-4222-8222-222222222222",
  specification: null,
  claim: {
    kind: "reference_only",
    standardBody: null,
    standardCode: "API CK-4",
    contextNote: null,
  },
};

function detailPage(subject: ReviewDetailResponse): ReactNode {
  return (
    <ReviewDetailFrame title="Specification review" user={ADMIN}>
      <BackToQueue query={QUERY} />
      {subject.subjectType === "specification" ? (
        <SpecificationDetail subject={subject} />
      ) : (
        <ProductClaimDetail subject={subject} />
      )}
    </ReviewDetailFrame>
  );
}

/* ========================================================================== */
/*  Document structure                                                         */
/* ========================================================================== */

describe("the page structure", () => {
  it("has exactly one h1, and it names the screen", () => {
    const headings = findTags(detailPage(SUBJECT), "h1");

    expect(headings).toHaveLength(1);
    expect(textOf(headings[0]?.props.children as ReactNode)).toContain("Specification review");
  });

  /** Panels are `h2`, sub-panels and evidence cards are `h3`. No level is skipped. */
  it("keeps a coherent heading outline below the h1", () => {
    const page = detailPage(SUBJECT);

    expect(findTags(page, "h2").length).toBeGreaterThan(0);
    expect(findTags(page, "h3").length).toBeGreaterThan(0);
    expect(findTags(page, "h4")).toHaveLength(0);
    expect(findTags(page, "h5")).toHaveLength(0);
  });

  it("has one main landmark, and names every panel by its own heading", () => {
    const page = detailPage(SUBJECT);
    const sections = findTags(page, "section");
    const headingIds = new Set(findTags(page, "h2").map((heading) => String(heading.props.id)));

    expect(findTags(page, "main")).toHaveLength(1);
    expect(sections.length).toBeGreaterThan(0);

    for (const section of sections) {
      // Named by the visible heading rather than by a second string that could drift from it —
      // the same convention `lead-fields.tsx` already uses on this surface.
      expect(section.props["aria-label"]).toBeUndefined();
      expect(headingIds.has(String(section.props["aria-labelledby"]))).toBe(true);
    }
  });

  /** Label/value pairs are a real `dl`, so the association is in the markup — §1.3.1. */
  it("presents every field as a definition list pair", () => {
    const page = detailPage(SUBJECT);

    expect(findTags(page, "dl").length).toBeGreaterThan(0);
    expect(findTags(page, "dt").length).toBeGreaterThan(0);
    expect(findTags(page, "dt").length).toBe(findTags(page, "dd").length);
  });

  it("presents blockers, evidence and history as lists", () => {
    const page = detailPage(SUBJECT);

    expect(findTags(page, "ul").length).toBeGreaterThan(0);
    expect(findTags(page, "ol").length).toBeGreaterThan(0);
    expect(findTags(page, "li").length).toBeGreaterThan(0);
  });

  it("marks a decision timestamp with a machine-readable time element", () => {
    const times = findTags(detailPage(SUBJECT), "time");

    expect(times.length).toBeGreaterThan(0);
    expect(times[0]?.props.dateTime).toBe("2026-08-20T11:30:00.000Z");
  });

  /** No table is the only way to understand a subject: the detail screen uses none at all. */
  it("uses no table", () => {
    expect(findTags(detailPage(SUBJECT), "table")).toHaveLength(0);
  });
});

/* ========================================================================== */
/*  Links                                                                      */
/* ========================================================================== */

describe("the back link", () => {
  it("names its destination rather than saying only Back", () => {
    const links = findLinks(<BackToQueue query={QUERY} />);

    expect(links).toHaveLength(1);
    expect(accessibleName(links[0] as never)).toContain("Back to review queue");
  });

  it("points at the queue in the state the reader left it", () => {
    const links = findLinks(<BackToQueue query={{ ...QUERY, subjectType: "specification" }} />);

    expect(links[0]?.props.href).toBe("/admin/catalog/review?subjectType=specification&page=3");
  });

  /** The only link on a detail page is the back link, plus the shell's own navigation. */
  it("is the only link the detail body renders", () => {
    expect(findLinks(<SpecificationDetail subject={SUBJECT} />)).toHaveLength(0);
    expect(findLinks(<ProductClaimDetail subject={CLAIM_SUBJECT} />)).toHaveLength(0);
  });
});

/* ========================================================================== */
/*  Direction isolation                                                        */
/* ========================================================================== */

describe("technical values are direction-isolated", () => {
  it("wraps every rendered value in a bdi element", () => {
    const isolates = findTags(detailPage(SUBJECT), "bdi");

    expect(isolates.length).toBeGreaterThan(10);
  });

  /**
   * Identifiers get an explicit LTR base direction inside the isolate. Without it, a value whose
   * first strong character is Arabic would set the run's direction and render the ASCII around it
   * in the wrong order.
   */
  it("fixes the base direction on identifiers", () => {
    const ltr = findTags(detailPage(SUBJECT), "bdi").filter(
      (element) => element.props.dir === "ltr",
    );

    expect(ltr.length).toBeGreaterThan(5);
  });

  /** Product names and document titles are prose in their own language; they isolate, not override. */
  it("isolates prose without forcing its direction", () => {
    const prose = findTags(detailPage(SUBJECT), "bdi").filter(
      (element) => element.props.dir === undefined,
    );

    expect(prose.length).toBeGreaterThan(0);
  });

  /** No bidi control character is emitted anywhere: the isolation is markup, not injected text. */
  it("injects no bidi control character", () => {
    const text = textOf(detailPage(SUBJECT));

    expect(text).not.toMatch(/[‎‏‪-‮⁦-⁩]/);
  });

  it("renders right-to-left content without dropping it", () => {
    const text = textOf(detailPage(SUBJECT));

    expect(text).toContain("روغن موتور HSB 2000");
    expect(text).toContain("گرانروی @100C");
  });
});

/* ========================================================================== */
/*  Colour independence and hover independence                                 */
/* ========================================================================== */

describe("nothing is carried by colour, hover or a pointer", () => {
  it("states the review status as text with its meaning", () => {
    const text = textOf(detailPage(SUBJECT));

    expect(text).toContain("Needs review");
    expect(text).toContain("The importer detected a reason this row needs attention");
  });

  it("states unit ambiguity as text next to the value", () => {
    const text = textOf(detailPage(SUBJECT));

    expect(text).toContain("Stated, but not interpretable");
    expect(text).toContain("has not been converted, and it has not been corrected");
  });

  it("states eligibility and each blocker as text", () => {
    const text = textOf(detailPage(SUBJECT));

    expect(text).toContain("Cannot be approved as it stands");
    expect(text).toContain("The specification cites no evidence.");
  });

  /** No `title` attribute anywhere: a tooltip is unreachable by keyboard and by touch. */
  it("puts no information in a title attribute", () => {
    const withTitle = elementsOf(detailPage(SUBJECT)).filter(
      (element) => typeof element.type === "string" && element.props.title !== undefined,
    );

    expect(withTitle).toHaveLength(0);
  });

  it("carries no event handler, so nothing depends on a pointer", () => {
    const handlers = elementsOf(detailPage(SUBJECT)).filter((element) =>
      Object.keys(element.props).some((name) => /^on[A-Z]/.test(name)),
    );

    expect(handlers).toHaveLength(0);
  });

  /** No autofocus: focus must not move on load — WCAG 2.2 §3.2.1 and §2.4.3. */
  it("moves focus nowhere on load", () => {
    const autofocused = elementsOf(detailPage(SUBJECT)).filter(
      (element) => element.props.autoFocus === true,
    );

    expect(autofocused).toHaveLength(0);
  });
});

/* ========================================================================== */
/*  Failure states                                                             */
/* ========================================================================== */

describe("every failure state is its own accessible sentence", () => {
  it.each([
    ["forbidden", <DetailForbidden key="f" />, "Access denied"],
    ["not found", <DetailNotFound key="n" />, "Subject not found"],
    ["invalid id", <DetailInvalidId key="i" />, "Not a review subject address"],
    ["unavailable", <DetailUnavailable key="u" />, "temporarily unavailable"],
    ["failed", <DetailFailed key="x" />, "could not be loaded"],
  ])("names the %s state under a heading", (_name, node, heading) => {
    expect(findTags(node, "h2")).toHaveLength(1);
    expect(textOf(node)).toContain(heading);
  });

  /** An outage must not read as a sign-out. */
  it("tells the reader they are still signed in when the platform is unreachable", () => {
    expect(textOf(<DetailUnavailable />)).toContain("You are still signed in");
  });

  /** Distinct sentences, never collapsed into one. */
  it("says something different for not-found and for unavailable", () => {
    expect(textOf(<DetailNotFound />)).not.toBe(textOf(<DetailUnavailable />));
    expect(textOf(<DetailNotFound />)).toContain("No review subject exists at this address");
    expect(textOf(<DetailInvalidId />)).toContain("not one the platform recognises");
  });

  it("exposes no status code, endpoint, token or stack trace", () => {
    for (const node of [
      <DetailForbidden key="f" />,
      <DetailNotFound key="n" />,
      <DetailInvalidId key="i" />,
      <DetailUnavailable key="u" />,
      <DetailFailed key="x" />,
    ]) {
      const text = textOf(node);

      expect(text).not.toMatch(/\b(400|401|403|404|409|500|503)\b/);
      expect(text).not.toContain("/api/");
      expect(text).not.toContain("Bearer");
      // A stack frame, not the English word: "at this address" is a sentence, `at Object.<anon>`
      // is a leak.
      expect(text).not.toMatch(/\n\s*at\s/);
      expect(text).not.toContain("node_modules");
      expect(text).not.toContain("Error:");
    }
  });
});

/* ========================================================================== */
/*  Claim wording                                                              */
/* ========================================================================== */

describe("a prohibited claim kind is explained rather than merely refused", () => {
  it("names the reason on the claim screen", () => {
    const text = textOf(<ProductClaimDetail subject={CLAIM_SUBJECT} />);

    expect(text).toContain("Reference only");
    expect(text).toContain("No — this kind can never be approved");
    expect(text).toContain("it is not publishable content");
  });
});
