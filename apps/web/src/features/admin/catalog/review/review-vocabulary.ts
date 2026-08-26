import type {
  ReviewClaimKind,
  ReviewEvidenceRole,
  ReviewExtractionMethod,
  ReviewHistoryDecision,
  ReviewInvalidationReasonCode,
  ReviewLocatorType,
  ReviewMappingConfidence,
  ReviewMethodRequirement,
  ReviewQueueSort,
  ReviewResultBasis,
  ReviewStatus,
  ReviewSubjectType,
  ReviewUnitClassification,
  ReviewValueKind,
  ReviewValueType,
  ReviewWarningCode,
} from "@sam-group/types";

/**
 * Every word the review surface puts on screen, in one place.
 *
 * The Admin surface is English-only and LTR (`app/(admin)/layout.tsx` fixes `lang="en" dir="ltr"`),
 * so this is a label table rather than a translation catalogue. It exists so the wording is
 * reviewable as wording — the statuses in particular are the part of this screen most likely to be
 * misread, and they are the part a queue must not get wrong.
 *
 * Every lookup below is used as `TABLE[value] ?? value`. A status the API adds and this build does
 * not know renders as the API spelled it, which is honest, rather than as "Unknown" or as a blank
 * cell that reads like a rendering fault.
 */

/* -------------------------------------------------------------------------- */
/*  Subject type                                                               */
/* -------------------------------------------------------------------------- */

export const SUBJECT_TYPE_LABEL: Readonly<Record<ReviewSubjectType, string>> = {
  specification: "Specification",
  product_claim: "Product claim",
};

/** Plural, for filter controls and counts. */
export const SUBJECT_TYPE_PLURAL: Readonly<Record<ReviewSubjectType, string>> = {
  specification: "Specifications",
  product_claim: "Product claims",
};

/* -------------------------------------------------------------------------- */
/*  Review status                                                              */
/* -------------------------------------------------------------------------- */

export const STATUS_LABEL: Readonly<Record<ReviewStatus, string>> = {
  source_recorded: "Source recorded",
  needs_review: "Needs review",
  approved: "Approved",
  rejected: "Rejected",
  superseded: "Superseded",
};

/**
 * What each status actually means, in the reviewer's terms.
 *
 * The two that exist in the catalogue today are the two that get misread, and the misreading has a
 * direction: `NEEDS_REVIEW` looks like "the backlog" and `SOURCE_RECORDED` looks like "done". Both
 * readings are wrong and the second is dangerous — `SOURCE_RECORDED` is 1,416 of the 1,546 rows,
 * every one of them unapproved, unreviewed and invisible to the public site.
 *
 * This wording is rendered on the page as a legend, not held only here (ADR-016 §7, ratified
 * decision D8).
 */
export const STATUS_MEANING: Readonly<Record<ReviewStatus, string>> = {
  source_recorded:
    "Imported from its source document with its evidence recorded. Nobody has reviewed it yet.",
  needs_review:
    "The importer detected a reason this row needs attention — a conflict, or a source property " +
    "that does not resolve to the controlled dictionary.",
  approved: "Reviewed and approved. This is the only status the public site publishes.",
  rejected: "Reviewed and refused. It is not published and will not be.",
  superseded: "Replaced by a later revision of the same fact.",
};

/**
 * Whether a status means the subject is published.
 *
 * Exactly one does. Used so no badge, count or summary can imply that anything in this catalogue
 * is live — live DEV holds 0 approved Specifications and 0 approved ProductClaims.
 */
export function statusIsPublished(status: ReviewStatus): boolean {
  return status === "approved";
}

/* -------------------------------------------------------------------------- */
/*  Claim kind                                                                 */
/* -------------------------------------------------------------------------- */

export const CLAIM_KIND_LABEL: Readonly<Record<ReviewClaimKind, string>> = {
  classification_stated: "Classification stated",
  meets: "Meets",
  suitable_for: "Suitable for",
  recommended_for: "Recommended for",
  formulated_for: "Formulated for",
  approved_by: "Approved by",
  licensed_by: "Licensed by",
  reference_only: "Reference only",
};

/**
 * The two kinds ADR-016 §6 puts permanently out of reach of an approval.
 *
 * Surfaced in the queue as plain text so a reviewer is not sent to a detail screen to discover that
 * the row was never approvable. Five rows in live DEV, all `reference_only`.
 */
export const NEVER_APPROVABLE_CLAIM_KINDS: readonly ReviewClaimKind[] = [
  "licensed_by",
  "reference_only",
];

export function claimKindIsNeverApprovable(kind: ReviewClaimKind): boolean {
  return NEVER_APPROVABLE_CLAIM_KINDS.includes(kind);
}

/* -------------------------------------------------------------------------- */
/*  Findings                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * `hasUnresolvedFindings`, as words.
 *
 * Never a colour, never an icon, never a bare dot: WCAG 2.2 §1.4.1 aside, "•" in a column called
 * Findings does not say whether the dot means there is a finding or that the check ran.
 */
export const FINDINGS_LABEL = {
  unresolved: "Unresolved finding",
  clear: "No unresolved finding",
} as const;

export const FINDINGS_MEANING =
  "An unresolved finding means the importer flagged this row, or — for a Specification — its " +
  "source property does not resolve to the controlled dictionary through an approved " +
  "high-confidence mapping. It does not mean the value is wrong; it means something is unsettled.";

/* -------------------------------------------------------------------------- */
/*  Sort                                                                       */
/* -------------------------------------------------------------------------- */

export const SORT_LABEL: Readonly<Record<ReviewQueueSort, string>> = {
  "-createdAt": "Newest first",
  createdAt: "Oldest first",
  "-updatedAt": "Recently decided",
  updatedAt: "Least recently decided",
};

/* -------------------------------------------------------------------------- */
/*  Filter descriptions                                                        */
/* -------------------------------------------------------------------------- */

/**
 * How each closed-vocabulary filter value is spelled in the active-filter summary.
 *
 * Passed into `activeFilters` so that module stays free of presentation: it decides *which* filters
 * are active, this decides what they are called. Keeping the two apart is why `review-query.ts` can
 * be tested without rendering anything.
 */
export const DESCRIBE_FILTER = {
  subjectType: (value: ReviewSubjectType): string => SUBJECT_TYPE_PLURAL[value] ?? value,
  reviewStatus: (value: ReviewStatus): string => STATUS_LABEL[value] ?? value,
  claimKind: (value: ReviewClaimKind): string => CLAIM_KIND_LABEL[value] ?? value,
  unresolvedFindings: (value: boolean): string =>
    value ? FINDINGS_LABEL.unresolved : FINDINGS_LABEL.clear,
} as const;

/* ========================================================================== */
/*  Detail vocabulary — Phase B                                                */
/* ========================================================================== */

/*
 * Everything below is read by the two detail routes. The same rule as above applies to every
 * table: it is looked up as `TABLE[value] ?? value`, so a vocabulary the API extends renders as the
 * API spelled it rather than as a blank or as "Unknown".
 */

/* -------------------------------------------------------------------------- */
/*  Value type                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * What the numeric columns mean — the SHAPE of the normalized value.
 *
 * Labelled as a shape rather than as a quantity, because that is what it is. "Maximum" here means
 * the source stated a ceiling, not that the platform picked the largest of several readings.
 */
export const VALUE_TYPE_LABEL: Readonly<Record<ReviewValueType, string>> = {
  point: "Point value",
  range: "Range",
  minimum: "Minimum",
  maximum: "Maximum",
  text: "Text",
  report_only: "Reported, not limited",
  code: "Classification code",
  pair: "Coupled pair",
};

/* -------------------------------------------------------------------------- */
/*  Value kind — the property's axis, not the value's                          */
/* -------------------------------------------------------------------------- */

/**
 * What kind of value the PROPERTY carries, as opposed to the shape of the one recorded value.
 *
 * The two axes are shown side by side and are labelled so that neither can be read as the other:
 * "Property value kind" against "Recorded value shape". Viscosity is a numeric property and may
 * legitimately arrive as a point, a range or a minimum — that is not a contradiction, and a UI that
 * rendered one axis under the other's name would make it look like one.
 *
 * Nothing on this surface converts one axis into the other, and nothing fills in a missing one from
 * the other. Where the property key resolves to no dictionary entry the API serves null and the
 * field says "Not recorded".
 */
export const VALUE_KIND_LABEL: Readonly<Record<ReviewValueKind, string>> = {
  numeric: "Numeric",
  textual: "Textual",
  coded: "Coded",
};

export const VALUE_KIND_MEANING =
  "What the controlled dictionary says this property measures. It is a different axis from the " +
  "recorded value's shape, and neither is derived from the other.";

/**
 * The wording for a kind/shape mismatch.
 *
 * INFORMATIONAL in this gate, and it says so. No rule about the combination has been ratified, so
 * this is neither a blocker nor a warning and must not be presented as either — it is a note that
 * points at two fields the reviewer can already see.
 */
export const VALUE_AXIS_DISCREPANCY =
  "The dictionary calls this property numeric, but the recorded value is stored in a textual " +
  "shape. This is shown for information only in this release: it is not an approval blocker and " +
  "not a warning, and nothing here has converted either field into the other.";

/* -------------------------------------------------------------------------- */
/*  Method requirement                                                         */
/* -------------------------------------------------------------------------- */

/**
 * Whether a test method must accompany a value for that property to mean anything.
 *
 * A viscosity without its ASTM method is not the same fact as one with it, which is why this is a
 * dictionary column and why `required` with no recorded method is a blocker rather than a warning.
 */
export const METHOD_REQUIREMENT_LABEL: Readonly<Record<ReviewMethodRequirement, string>> = {
  required: "Required",
  optional: "Optional",
  not_applicable: "Not applicable",
};

/** What each requirement means for approval, in the reviewer's terms. */
export const METHOD_REQUIREMENT_MEANING: Readonly<Record<ReviewMethodRequirement, string>> = {
  required:
    "This property means nothing without its test method. A specification that records none " +
    "cannot be approved.",
  optional: "A test method adds precision here but is not required for approval.",
  not_applicable:
    "No test method applies to this property. One recorded anyway is reported as a warning, not " +
    "as an obstacle.",
};

/* -------------------------------------------------------------------------- */
/*  Result basis                                                               */
/* -------------------------------------------------------------------------- */

/**
 * What a recorded number actually IS — the difference between a marketing figure and a
 * specification limit.
 *
 * `unspecified` is spelled as what it is: the source did not say. It is never rendered as
 * "typical", and no default is applied anywhere on this surface.
 */
export const RESULT_BASIS_LABEL: Readonly<Record<ReviewResultBasis, string>> = {
  average: "Average test results",
  typical: "Typical value",
  specification_limit: "Specification limit",
  measured: "Measured value",
  unspecified: "Not stated by the source",
};

/* -------------------------------------------------------------------------- */
/*  Evidence                                                                   */
/* -------------------------------------------------------------------------- */

/** How one source fact supports the subject. */
export const EVIDENCE_ROLE_LABEL: Readonly<Record<ReviewEvidenceRole, string>> = {
  primary: "Primary evidence",
  corroborating: "Corroborating evidence",
  superseded: "Superseded evidence",
};

/** How the reading was got out of its document. An OCR reading is not a spreadsheet cell. */
export const EXTRACTION_METHOD_LABEL: Readonly<Record<ReviewExtractionMethod, string>> = {
  spreadsheet_cell: "Spreadsheet cell",
  pdf_text_layer: "PDF text layer",
  pdf_ocr: "PDF OCR",
  manual_transcription: "Manual transcription",
};

/**
 * What the source said about units, and what each answer does NOT license.
 *
 * This is the field a technical review surface is most able to do harm with. `absent` and
 * `unrecognized` are ambiguity, and ambiguity is shown as ambiguity: nothing on this surface
 * substitutes a plausible unit, infers one from the property, or presents a normalized unit as
 * though the source had stated it.
 */
export const UNIT_CLASSIFICATION_LABEL: Readonly<Record<ReviewUnitClassification, string>> = {
  stated: "Stated by the source",
  absent: "Not stated by the source",
  dimensionless: "Dimensionless quantity",
  unrecognized: "Stated, but not interpretable",
};

export const UNIT_CLASSIFICATION_MEANING: Readonly<Record<ReviewUnitClassification, string>> = {
  stated: "The source document gave a unit for this reading.",
  absent:
    "The source document gave no unit. Any unit shown against the normalized value came from " +
    "elsewhere and is not what the source said.",
  dimensionless: "The quantity has no unit — a viscosity index, for example.",
  unrecognized:
    "The source document gave a unit this platform cannot yet interpret. It has not been " +
    "converted, and it has not been corrected.",
};

/** Whether the source's unit is unsettled, and a reviewer must resolve it rather than assume. */
export function unitIsAmbiguous(classification: ReviewUnitClassification): boolean {
  return classification === "absent" || classification === "unrecognized";
}

/* -------------------------------------------------------------------------- */
/*  Source documents                                                           */
/* -------------------------------------------------------------------------- */

/** How the document is addressed. Never a link — see `SOURCE_DOCUMENT_ACCESS_NOTE`. */
export const LOCATOR_TYPE_LABEL: Readonly<Record<ReviewLocatorType, string>> = {
  url: "Cited by URL",
  uploaded_file: "Uploaded file",
};

/**
 * The frozen source-document boundary, stated on the page rather than left to be inferred.
 *
 * ADR-014 stores no document bytes and the API creates no proxy, no redirect and no signed URL.
 * There is therefore nothing to open from this screen, and this sentence says so — because the
 * alternative readings of a document panel with no link are both wrong: that the evidence is
 * missing, or that the link was forgotten. Neither is true. The evidence exists, it is cited, and
 * it is retrieved through the channel the reviewer already has.
 */
export const SOURCE_DOCUMENT_ACCESS_NOTE =
  "Source documents cannot be opened or downloaded from this interface: this platform stores no " +
  "document files and publishes no document links. The evidence below is cited in full — title, " +
  "publisher, revision, retrieval date and file fingerprint — and is retrieved through the source " +
  "channel it was recorded from.";

/**
 * Why a URL locator's value is not printed.
 *
 * The document's identity is served in full and shown in full. The one part withheld is the URL
 * string itself, because rendering a third-party address on this surface is what the frozen
 * boundary refuses — as text it would still be copied, pasted and followed, which is the behaviour
 * the boundary exists to prevent. An uploaded file's locator is a FILE NAME, not an address, and is
 * shown.
 */
export const URL_LOCATOR_WITHHELD =
  "Recorded as a URL. The address is not displayed on this interface.";

/* -------------------------------------------------------------------------- */
/*  Property mapping                                                           */
/* -------------------------------------------------------------------------- */

export const MAPPING_CONFIDENCE_LABEL: Readonly<Record<ReviewMappingConfidence, string>> = {
  high: "High",
  medium: "Medium",
  low: "Low",
};

/**
 * What the mapping panel is actually telling a reviewer.
 *
 * Only a HIGH-confidence mapping into a seeded dictionary key resolves a property, and a mapping a
 * human has already rejected or superseded stops resolving anything. Everything else is stored
 * without being treated as domain truth — which is the distinction the panel has to carry, because
 * "there is a mapping" and "the property resolves" are not the same statement.
 */
export const MAPPING_MEANING =
  "A source property resolves to the controlled dictionary only through a high-confidence mapping " +
  "that has not been rejected or superseded. A mapping listed below at medium or low confidence is " +
  "recorded, not accepted.";

export const MAPPING_RESOLVES_LABEL = {
  yes: "Resolves this property key",
  no: "Does not resolve this property key",
} as const;

/* -------------------------------------------------------------------------- */
/*  Eligibility                                                                */
/* -------------------------------------------------------------------------- */

export const ELIGIBILITY_LABEL = {
  eligible: "No approval blocker recorded",
  blocked: "Cannot be approved as it stands",
} as const;

/**
 * What eligibility is, and — just as important — what it is not.
 *
 * "No blocker recorded" is a statement about the platform's mechanical checks, not a
 * recommendation. Nothing on this surface may read as an endorsement of a value, because the whole
 * point of technical review is that a person decides.
 */
export const ELIGIBILITY_MEANING =
  "Eligibility describes the platform's own checks only — evidence, dictionary mapping, value " +
  "shape, claim identity, the required test method and whether the cited source was captured. It " +
  "is not an opinion about whether the value is correct, and it is not a recommendation to " +
  "approve.";

/* -------------------------------------------------------------------------- */
/*  Warnings — reasons to look twice, never reasons to refuse                  */
/* -------------------------------------------------------------------------- */

/**
 * The warnings panel's own wording.
 *
 * The heading and this sentence carry the whole distinction, because it is the one a reviewer is
 * most likely to get wrong in the direction that matters: a warning looks like a blocker, and a
 * reviewer who reads it as one will leave a perfectly approvable value sitting in the queue.
 *
 * Every source document in the catalogue is missing both its date and its revision label, so every
 * subject currently carries two warnings. If that read as "cannot approve", nothing would ever be
 * approved.
 */
export const WARNINGS_HEADING = "Review warnings";

export const WARNINGS_MEANING =
  "Warnings are things to look at before approving. They are not approval blockers and none of " +
  "them makes a subject ineligible.";

export const WARNINGS_EMPTY = "No warning recorded.";

/**
 * What each warning means, beyond the sentence the API already sends.
 *
 * The API's message is authoritative and is what the list renders; this table is the standing
 * explanation shown once per panel, and it exists so the two document warnings are not read as a
 * defect in the catalogue. They describe what the source documents recorded, and no surface may
 * invent a date or a revision that was never stated.
 */
export const WARNING_MEANING: Readonly<Record<ReviewWarningCode, string>> = {
  METHOD_NOT_APPLICABLE_BUT_PRESENT:
    "The dictionary says this property takes no test method, and one is recorded anyway. Neither " +
    "field has been changed to agree with the other.",
  DOCUMENT_DATE_UNKNOWN:
    "The source document stated no publication date. None is inferred, and none is displayed.",
  DOCUMENT_REVISION_UNKNOWN:
    "The source document stated no revision label. None is inferred, and none is displayed.",
};

/**
 * The blockers panel's own wording, kept beside the warnings' so the pair reads as a pair.
 *
 * The count sentence is rendered above the list. A blocker is never a colour, never an icon and
 * never a tooltip.
 */
export const BLOCKERS_HEADING = "Approval blockers";

export const BLOCKERS_MEANING =
  "Every one of these must be resolved in the catalogue before this subject can be approved. " +
  "They are the platform's mechanical checks, not a reviewer's judgement.";

/* -------------------------------------------------------------------------- */
/*  Claim kinds — the legal reading                                            */
/* -------------------------------------------------------------------------- */

/**
 * What each claim kind ACTUALLY asserts, in the terms that matter if it is ever published.
 *
 * The strength ladder is legal, not stylistic, and the UI's job is to keep the rungs apart. Three
 * distinctions are load-bearing and each has been got wrong in this industry before:
 *
 *   * **`classification_stated`** records that the source stated a class. It is not a claim that
 *     the product meets it, and there is no claim verb in the source sentence at all.
 *   * **`formulated_for`** is an additive target level. It is NOT an approval and must never be
 *     rendered as one, or beside one, in a way that lets the two blur.
 *   * **`approved_by` and `licensed_by`** name a body. `licensed_by` is the stronger of the two and
 *     is nevertheless never approvable here — a licence is the licensing body's statement to make,
 *     not SAM's.
 *
 * No wording below upgrades a kind. Nothing is paraphrased into a stronger verb, and nothing is
 * softened into a weaker one either.
 */
export const CLAIM_KIND_MEANING: Readonly<Record<ReviewClaimKind, string>> = {
  classification_stated:
    "The source states a classification. It records what the source said; it is not a claim that " +
    "the product meets that classification, and the source sentence carries no claim verb.",
  meets: "The source states that the product meets the standard named.",
  suitable_for: "The source states suitability for the application named — not conformance to it.",
  recommended_for: "The source recommends the product for the application named.",
  formulated_for:
    "An additive target level: the product was formulated towards the specification named. This " +
    "is not an approval and must never be presented as one.",
  approved_by: "A named body has approved the product. The body must be named for this to stand.",
  licensed_by:
    "A named body has licensed the product. A licence is the licensing body's statement, not " +
    "SAM's, so this platform never approves it for publication.",
  reference_only:
    "Recorded for internal reference only. It is never publishable and can never be approved.",
};

/** Why a kind can never be approved, stated as the reason rather than as a refusal. */
export const CLAIM_KIND_PROHIBITED_REASON: Readonly<Partial<Record<ReviewClaimKind, string>>> = {
  licensed_by:
    "Approval is not available for a licence claim: the statement belongs to the licensing body.",
  reference_only:
    "Approval is not available for a reference-only record: it is not publishable content.",
};

/* -------------------------------------------------------------------------- */
/*  History                                                                    */
/* -------------------------------------------------------------------------- */

/** A recorded, immutable decision, as words. */
export const HISTORY_DECISION_LABEL: Readonly<Record<ReviewHistoryDecision, string>> = {
  approved: "Approved",
  rejected: "Rejected",
  needs_review: "Returned for review",
  superseded: "Marked superseded",
};

export const HISTORY_EMPTY =
  "No decision has ever been recorded against this subject. Its status is the one the importer " +
  "wrote when the row was created.";

export const HISTORY_MEANING =
  "Review decisions are appended and never edited or removed. Each entry names the reviewer as " +
  "they were recorded at the time, and states whether the evidence behind that decision is still " +
  "the evidence that stands now.";

export const HISTORY_EVIDENCE_LABEL = {
  current: "Evidence unchanged since this decision",
  stale: "Evidence has changed since this decision",
} as const;

/* -------------------------------------------------------------------------- */
/*  System invalidation events                                                 */
/* -------------------------------------------------------------------------- */

/**
 * What the system did, said as something the system did.
 *
 * ## The wording rule these follow
 *
 * Every sentence is passive about the approval and explicit about the cause, and **none of them
 * contains a person**. "Approval invalidated because mapping data changed" is a statement about
 * data; "Returned for review by …" would be a statement about somebody, and there is nobody. The
 * entries carry no reviewer because `review_invalidations` stores none — see ADR-017.
 *
 * They are also deliberately not phrased as decisions. A reviewer scanning this panel must be able
 * to tell at a glance which entries are decisions people made and which are consequences the
 * database drew, and the wording is the first thing doing that work — the visual treatment and the
 * separate heading are the second and third.
 *
 * ## No locator, ever
 *
 * `SOURCE_CAPTURE_CHANGED` says a cited source gained its captured file and names no document, no
 * URL, no file name and no hash — the same boundary the `SOURCE_ASSET_ABSENT` blocker observes.
 */
export const INVALIDATION_REASON_LABEL: Readonly<Record<ReviewInvalidationReasonCode, string>> = {
  SUBJECT_STATE_CHANGED: "Approval invalidated because the recorded value changed.",
  EVIDENCE_CHANGED: "Approval invalidated because the cited evidence changed.",
  DICTIONARY_CHANGED: "Approval invalidated because the property dictionary changed.",
  MAPPING_CHANGED: "Approval invalidated because mapping data changed.",
  SOURCE_CAPTURE_CHANGED: "Approval invalidated because a cited source was captured.",
};

/** The fallback for a reason code this build does not know. Never a blank, never a guess. */
export const INVALIDATION_REASON_UNKNOWN =
  "Approval invalidated because something it depended on changed.";

export const INVALIDATION_HEADING = "Automatic invalidations";

export const INVALIDATION_MEANING =
  "These are not decisions. When an approved value, its evidence, its dictionary entry, its " +
  "mapping or its captured source changes, the platform withdraws the approval automatically and " +
  "records why. No reviewer is named, because none was involved. The subject returns to the " +
  "review queue and stops being published.";

export const INVALIDATION_EMPTY =
  "No approval on this subject has ever been withdrawn automatically.";

/** What one entry says about the decision it retired, without naming who made it. */
export const INVALIDATION_RETIRED_APPROVAL = "Withdrew an earlier approval of this subject";

/* -------------------------------------------------------------------------- */
/*  Shared field wording                                                       */
/* -------------------------------------------------------------------------- */

/**
 * What an empty field says.
 *
 * "Not recorded" rather than a blank, and never a dash on its own: a blank reads as a rendering
 * fault, and a reviewer cannot tell whether the source omitted the value or the page failed to
 * show it. It is also never "None" — that would assert the source said there was none.
 */
export const NOT_RECORDED = "Not recorded";
