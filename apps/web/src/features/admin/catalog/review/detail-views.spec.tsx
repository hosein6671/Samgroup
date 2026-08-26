import { describe, expect, it, vi } from "vitest";

import { elementsOf, findLinks, findTags, textOf } from "@test/element-tree";

import { ProductClaimDetail } from "./product-claim-detail";
import { DEFAULT_LIMIT, DEFAULT_SORT, backToQueueHref, reviewSubjectHref } from "./review-query";
import { SpecificationDetail } from "./specification-detail";

import type { ReviewQueueQuery } from "./review-query";
import type {
  ReviewDetailResponse,
  ReviewEvidenceEntry,
  ReviewHistoryEntry,
} from "@sam-group/types";

/**
 * What the two detail screens put on the page, and what they must never put on it.
 *
 * ## Content, not pixels
 *
 * Nothing below asserts a class, a colour or a layout. What is asserted is that the screen carries
 * the facts a reviewer needs, keeps raw and normalized apart, states ambiguity as ambiguity, never
 * upgrades a claim's legal meaning, offers no way to open a source document, and contains nothing
 * that could change review state.
 *
 * ## Fixtures, never a live session
 *
 * Live DEV holds zero `TechnicalReview` rows, so non-empty history exists only here. No credential
 * is used, no session is created, and no request is made: these are Server Components rendered
 * from objects.
 */

vi.mock("@/features/admin/actions", () => ({ signOut: vi.fn() }));

const QUERY: ReviewQueueQuery = { page: 1, limit: DEFAULT_LIMIT, sort: DEFAULT_SORT };

const SPEC_ID = "11111111-1111-4111-8111-111111111111";
const CLAIM_ID = "22222222-2222-4222-8222-222222222222";

const EVIDENCE: ReviewEvidenceEntry = {
  sourceFactId: "aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa",
  role: "primary",
  note: null,
  rawProperty: "Viscosity @100C",
  rawValue: "11.5",
  rawUnit: "cSt",
  rawMethod: "ASTM D445",
  rawGrade: "SAE 40",
  extractionMethod: "spreadsheet_cell",
  unitClassification: "stated",
  resultBasis: "typical",
  pageNumber: null,
  sheetName: "HSB",
  rowNumber: 12,
  columnLabel: "F",
  document: {
    id: "dddddddd-1111-4111-8111-dddddddddddd",
    title: "HSB 2000 Technical Data Sheet",
    publisher: "HSB Lubricants",
    locatorType: "uploaded_file",
    locatorValue: "hsb-2000-tds.xlsx",
    revisionLabel: "Rev 3",
    documentDate: "2025-11-02",
    retrievedAt: "2026-08-01T00:00:00.000Z",
    assetSha256: "9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08",
    assetMediaType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    assetByteSize: 20_480,
    supersededById: null,
  },
};

/** The same fact, with the source's unit missing — the ambiguity case. */
const EVIDENCE_NO_UNIT: ReviewEvidenceEntry = {
  ...EVIDENCE,
  sourceFactId: "aaaaaaaa-2222-4222-8222-aaaaaaaaaaaa",
  rawUnit: null,
  unitClassification: "absent",
};

const HISTORY: ReviewHistoryEntry = {
  id: "eeeeeeee-1111-4111-8111-eeeeeeeeeeee",
  decision: "rejected",
  reviewerEmail: "reviewer@samgp.com",
  reviewerId: null,
  reviewedAt: "2026-08-20T11:30:00.000Z",
  note: "The source unit could not be reconciled with the dictionary entry.",
  evidenceSetHash: "1111111111111111111111111111111111111111111111111111111111111111",
  evidenceCurrent: false,
};

function specification(overrides: Partial<ReviewDetailResponse> = {}): ReviewDetailResponse {
  return {
    subjectType: "specification",
    id: SPEC_ID,
    reviewStatus: "source_recorded",
    createdAt: "2026-08-24T09:00:00.000Z",
    deletedAt: null,
    product: {
      slug: "hsb-2000",
      name: "HSB 2000",
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
    evidence: [EVIDENCE],
    mappings: [
      {
        rawProperty: "Viscosity @100C",
        rawUnit: "cSt",
        specPropertyKey: "kinematic_viscosity_100c",
        confidence: "high",
        reviewStatus: "source_recorded",
        note: null,
        resolvesSubjectProperty: true,
      },
    ],
    approvalBlockers: [],
    eligibleForApproval: true,
    history: [],
    ...overrides,
  };
}

function claim(overrides: Partial<ReviewDetailResponse> = {}): ReviewDetailResponse {
  return {
    subjectType: "product_claim",
    id: CLAIM_ID,
    reviewStatus: "needs_review",
    createdAt: "2026-08-24T10:00:00.000Z",
    deletedAt: null,
    product: {
      slug: "addilex-7",
      name: "Addilex 7",
      sourceRef: null,
      family: "additives",
      productType: "engine-oil-additive",
    },
    grade: null,
    specification: null,
    claim: {
      kind: "meets",
      standardBody: "API",
      standardCode: "CK-4",
      contextNote: "Stated on page 2 of the data sheet.",
    },
    evidenceSetHash: "3333333333333333333333333333333333333333333333333333333333333333",
    evidence: [EVIDENCE],
    mappings: [],
    approvalBlockers: [],
    eligibleForApproval: true,
    history: [],
    ...overrides,
  };
}

/* ========================================================================== */
/*  Specification                                                              */
/* ========================================================================== */

describe("the Specification detail", () => {
  it("shows the product context, including the internal source reference", () => {
    const text = textOf(<SpecificationDetail subject={specification()} />);

    expect(text).toContain("HSB 2000");
    expect(text).toContain("hsb-2000");
    expect(text).toContain("Source reference");
    expect(text).toContain("HSB-001");
    expect(text).toContain("industrial-oils-lubricants");
    expect(text).toContain("SAE 40");
  });

  it("shows the reviewed technical value with its method and result basis", () => {
    const text = textOf(<SpecificationDetail subject={specification()} />);

    expect(text).toContain("kinematic_viscosity_100c");
    expect(text).toContain("11.5");
    expect(text).toContain("mm2/s");
    expect(text).toContain("ASTM D445");
    expect(text).toContain("Typical value");
  });

  /**
   * The distinction the whole screen exists to protect. Both sides are present, both are labelled,
   * and neither label is a colour or a position.
   */
  it("keeps the raw source reading and the normalized value separately labelled", () => {
    const text = textOf(<SpecificationDetail subject={specification()} />);

    expect(text).toContain("Normalized display value");
    expect(text).toContain("Normalized unit");
    expect(text).toContain("As the source stated it");
    expect(text).toContain("Raw value");
    expect(text).toContain("Raw unit");
    expect(text).toContain("Viscosity @100C");
    expect(text).toContain("cSt");
  });

  it("shows the value shape and the numeric payload as stored", () => {
    const text = textOf(<SpecificationDetail subject={specification()} />);

    expect(text).toContain("Value type");
    expect(text).toContain("Point value");
    expect(text).toContain("11.500000");
  });

  /** Ambiguity is stated, never resolved. Nothing substitutes a plausible unit. */
  it("states an absent source unit as ambiguity and substitutes nothing", () => {
    const subject = specification({ evidence: [EVIDENCE_NO_UNIT] });
    const text = textOf(<SpecificationDetail subject={subject} />);

    expect(text).toContain("Not stated by the source");
    expect(text).toContain("The source unit is unsettled and has not been corrected");
  });

  it("shows the mapping status and confidence, and says whose status it is", () => {
    const text = textOf(<SpecificationDetail subject={specification()} />);

    expect(text).toContain("Mapping confidence");
    expect(text).toContain("High");
    expect(text).toContain("Mapping review status");
    expect(text).toContain("It is not this specification's review status.");
    expect(text).toContain("Resolves this property key");
  });

  it("says so when no mapping resolves the property", () => {
    const subject = specification({ mappings: [] });
    const text = textOf(<SpecificationDetail subject={subject} />);

    expect(text).toContain("No mapping is recorded");
  });

  it("lists unresolved findings as text when the subject cannot be approved", () => {
    const subject = specification({
      eligibleForApproval: false,
      approvalBlockers: [
        "The specification cites no evidence.",
        "The property key is not an entry in the controlled dictionary.",
      ],
    });
    const text = textOf(<SpecificationDetail subject={subject} />);

    expect(text).toContain("Cannot be approved as it stands");
    expect(text).toContain("2 blockers recorded");
    expect(text).toContain("The specification cites no evidence.");
    expect(text).toContain("The property key is not an entry in the controlled dictionary.");
  });

  it("states an empty blocker list rather than omitting the panel", () => {
    const text = textOf(<SpecificationDetail subject={specification()} />);

    expect(text).toContain("Approval blockers");
    expect(text).toContain("No approval blocker recorded");
    expect(text).toContain("not a recommendation to approve");
  });
});

/* ========================================================================== */
/*  ProductClaim                                                               */
/* ========================================================================== */

describe("the ProductClaim detail", () => {
  it("shows the product context and the claim statement verbatim", () => {
    const text = textOf(<ProductClaimDetail subject={claim()} />);

    expect(text).toContain("Addilex 7");
    expect(text).toContain("CK-4");
    expect(text).toContain("API");
    expect(text).toContain("Stated on page 2 of the data sheet.");
  });

  it("names the claim kind and states what it actually asserts", () => {
    const text = textOf(<ProductClaimDetail subject={claim()} />);

    expect(text).toContain("Meets");
    expect(text).toContain("The source states that the product meets the standard named.");
  });

  /**
   * The legal ladder. A formulated-for claim is an additive target level, and the screen says so in
   * its own sentence rather than leaving it to be inferred from a label.
   */
  it("refuses to let a formulated-for claim read as an approval", () => {
    const subject = claim({
      claim: {
        kind: "formulated_for",
        standardBody: null,
        standardCode: "API CK-4",
        contextNote: null,
      },
    });
    const text = textOf(<ProductClaimDetail subject={subject} />);

    expect(text).toContain("Formulated for");
    expect(text).toContain("additive target level");
    expect(text).toContain("not an approval");
    expect(text).toContain("No — this kind names no approving body");
  });

  it("says a stated classification carries no claim verb", () => {
    const subject = claim({
      claim: {
        kind: "classification_stated",
        standardBody: null,
        standardCode: "API CK-4",
        contextNote: null,
      },
    });
    const text = textOf(<ProductClaimDetail subject={subject} />);

    expect(text).toContain("Classification stated");
    expect(text).toContain("no claim verb");
  });

  it("shows the named body for an approval claim", () => {
    const subject = claim({
      claim: {
        kind: "approved_by",
        standardBody: "Volvo",
        standardCode: "VDS-4.5",
        contextNote: null,
      },
    });
    const text = textOf(<ProductClaimDetail subject={subject} />);

    expect(text).toContain("Approved by");
    expect(text).toContain("Volvo");
    expect(text).toContain("Names an approving or licensing body");
  });

  /** The two kinds that can never be approved say why, as a reason rather than as a refusal. */
  it.each([
    ["licensed_by" as const, "the statement belongs to the licensing body"],
    ["reference_only" as const, "it is not publishable content"],
  ])("states why %s can never be approved", (kind, reason) => {
    const subject = claim({
      claim: { kind, standardBody: "API", standardCode: "CK-4", contextNote: null },
      eligibleForApproval: false,
      approvalBlockers: ["This claim kind can never be approved (LICENSED_BY and REFERENCE_ONLY)."],
    });
    const text = textOf(<ProductClaimDetail subject={subject} />);

    expect(text).toContain("No — this kind can never be approved");
    expect(text).toContain(reason);
  });
});

/* ========================================================================== */
/*  Source documents — the frozen boundary                                     */
/* ========================================================================== */

describe("source documents are described and never opened", () => {
  it("shows the document's full identity", () => {
    const text = textOf(<SpecificationDetail subject={specification()} />);

    expect(text).toContain("HSB 2000 Technical Data Sheet");
    expect(text).toContain("HSB Lubricants");
    expect(text).toContain("Rev 3");
    expect(text).toContain("2025-11-02");
    expect(text).toContain("hsb-2000-tds.xlsx");
    expect(text).toContain("9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08");
  });

  it("renders the explicit no-retrieval note", () => {
    const text = textOf(<SpecificationDetail subject={specification()} />);

    expect(text).toContain("Source documents cannot be opened or downloaded from this interface");
    expect(text).toContain("is cited in full");
  });

  /** Not a link, not a download, not a preview, and not a disabled stand-in for one. */
  it("renders no anchor, image, iframe or embed in the evidence panel", () => {
    for (const node of [
      <SpecificationDetail key="s" subject={specification()} />,
      <ProductClaimDetail key="c" subject={claim()} />,
    ]) {
      expect(findLinks(node)).toHaveLength(0);
      expect(findTags(node, "a")).toHaveLength(0);
      expect(findTags(node, "iframe")).toHaveLength(0);
      expect(findTags(node, "embed")).toHaveLength(0);
      expect(findTags(node, "img")).toHaveLength(0);
    }
  });

  /** A URL-cited document keeps its identity and loses only its address. */
  it("withholds a URL locator's address while still describing the document", () => {
    const subject = specification({
      evidence: [
        {
          ...EVIDENCE,
          document: {
            ...EVIDENCE.document,
            locatorType: "url",
            locatorValue: "https://example.invalid/tds.pdf",
          },
        },
      ],
    });
    const text = textOf(<SpecificationDetail subject={subject} />);

    expect(text).toContain("Cited by URL");
    expect(text).toContain("The address is not displayed on this interface.");
    expect(text).not.toContain("example.invalid");
    expect(text).toContain("HSB 2000 Technical Data Sheet");
  });

  /** Absence of a link must never read as absence of evidence. */
  it("distinguishes a cited document from a subject with no evidence at all", () => {
    const withNone = specification({ evidence: [] });

    expect(textOf(<SpecificationDetail subject={withNone} />)).toContain("cites no evidence");
    expect(textOf(<SpecificationDetail subject={specification()} />)).not.toContain(
      "cites no evidence",
    );
  });
});

/* ========================================================================== */
/*  Immutable history                                                          */
/* ========================================================================== */

describe("review history is immutable and honest about being empty", () => {
  it("renders the empty state as a sentence, not as a missing panel", () => {
    const text = textOf(<SpecificationDetail subject={specification()} />);

    expect(text).toContain("Review history");
    expect(text).toContain("No decision has ever been recorded against this subject");
  });

  it("renders a recorded decision with its reviewer snapshot, timestamp and note", () => {
    const subject = specification({ history: [HISTORY] });
    const text = textOf(<ProductClaimDetail subject={{ ...claim(), history: [HISTORY] }} />);

    expect(text).toContain("Rejected");
    expect(text).toContain("reviewer@samgp.com");
    expect(text).toContain("2026-08-20");
    expect(text).toContain("The source unit could not be reconciled");
    expect(text).toContain("Evidence has changed since this decision");

    // Both subject types render the same history component, and both say the same things.
    expect(textOf(<SpecificationDetail subject={subject} />)).toContain("reviewer@samgp.com");
  });

  it("says when the evidence behind a decision still stands", () => {
    const subject = specification({
      history: [{ ...HISTORY, decision: "approved", evidenceCurrent: true }],
    });
    const text = textOf(<SpecificationDetail subject={subject} />);

    expect(text).toContain("Evidence unchanged since this decision");
  });

  it("offers no edit, delete or reply affordance on any entry", () => {
    const subject = specification({ history: [HISTORY] });
    const elements = elementsOf(<SpecificationDetail subject={subject} />);
    const tags = elements.map((element) => element.type);

    expect(tags).not.toContain("button");
    expect(tags).not.toContain("form");
    expect(tags).not.toContain("input");
    expect(tags).not.toContain("textarea");
    expect(tags).not.toContain("select");
  });

  /** No current-user inference. The reviewer is the recorded snapshot or nothing. */
  it("names no reviewer when there is no decision", () => {
    const text = textOf(<SpecificationDetail subject={specification()} />);

    expect(text).not.toContain("@samgp.com");
  });
});

/* ========================================================================== */
/*  No decision capability                                                     */
/* ========================================================================== */

describe("neither screen can change review state", () => {
  it.each([
    ["specification", <SpecificationDetail key="s" subject={specification()} />],
    ["product claim", <ProductClaimDetail key="c" subject={claim()} />],
  ])("renders no control of any kind on the %s screen", (_name, node) => {
    const tags = elementsOf(node).map((element) => element.type);

    for (const forbidden of ["button", "form", "input", "select", "textarea"]) {
      expect(tags).not.toContain(forbidden);
    }
  });

  it("offers no approve or reject affordance in its text", () => {
    const text = textOf(<SpecificationDetail subject={specification()} />);

    // The words appear as vocabulary — a status, an eligibility sentence — and never as a control.
    expect(text).not.toContain("Approve this");
    expect(text).not.toContain("Reject this");
    expect(text).not.toContain("Record decision");
  });
});

/* ========================================================================== */
/*  URLs                                                                       */
/* ========================================================================== */

describe("the URLs this surface builds", () => {
  it("sends each subject type to its own route", () => {
    expect(reviewSubjectHref("specification", SPEC_ID)).toBe(
      `/admin/catalog/review/specifications/${SPEC_ID}`,
    );
    expect(reviewSubjectHref("product_claim", CLAIM_ID)).toBe(
      `/admin/catalog/review/product-claims/${CLAIM_ID}`,
    );
  });

  it("carries the queue state forward and back unchanged", () => {
    const query: ReviewQueueQuery = {
      page: 43,
      limit: DEFAULT_LIMIT,
      sort: "-updatedAt",
      subjectType: "product_claim",
      unresolvedFindings: true,
    };

    const forward = reviewSubjectHref("product_claim", CLAIM_ID, query);

    expect(forward).toContain(`/product-claims/${CLAIM_ID}?`);
    expect(forward).toContain("subjectType=product_claim");
    expect(forward).toContain("unresolvedFindings=true");
    expect(forward).toContain("sort=-updatedAt");
    expect(forward).toContain("page=43");

    expect(backToQueueHref(query)).toBe(
      "/admin/catalog/review?subjectType=product_claim&unresolvedFindings=true&sort=-updatedAt&page=43",
    );
  });

  it("omits the query string entirely when the queue is unfiltered and on page one", () => {
    expect(reviewSubjectHref("specification", SPEC_ID, QUERY)).toBe(
      `/admin/catalog/review/specifications/${SPEC_ID}`,
    );
    expect(backToQueueHref(QUERY)).toBe("/admin/catalog/review");
  });

  /**
   * The Back link's destination is a constant. No parameter names it, so no parameter can move it —
   * there is no `returnTo` to poison, and an off-site value cannot appear because no off-site value
   * is ever read.
   */
  it("always returns to the queue, whatever the query held", () => {
    const hostile: ReviewQueueQuery = {
      page: 2,
      limit: DEFAULT_LIMIT,
      sort: DEFAULT_SORT,
      productSlug: "https://evil.invalid/steal",
      family: "//evil.invalid",
    };

    const href = backToQueueHref(hostile);

    expect(href.startsWith("/admin/catalog/review?")).toBe(true);
    // The hostile values survive only as encoded query VALUES of the queue path — never as the
    // destination, and never as an unencoded scheme or authority.
    expect(href).not.toMatch(/^https?:/);
    expect(href).not.toMatch(/^\/\//);
    expect(href).toContain("productSlug=https%3A%2F%2Fevil.invalid%2Fsteal");
  });

  it("encodes a subject id that is not a plain identifier", () => {
    expect(reviewSubjectHref("specification", "../../admin/users")).toBe(
      "/admin/catalog/review/specifications/..%2F..%2Fadmin%2Fusers",
    );
  });
});
