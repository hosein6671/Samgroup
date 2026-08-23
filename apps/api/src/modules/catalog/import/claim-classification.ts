/**
 * Classifies what a source SAYS about a product, without ever strengthening it.
 *
 * ── The governing rule ──────────────────────────────────────────────────────
 *
 * A bare designation such as `API CJ-4` is `CLASSIFICATION_STATED` and nothing more. It is
 * not an approval, not a certification and not a "meets" claim. The verb the source used —
 * or the absence of one — decides the kind, and no code path upgrades one kind into a
 * stronger one.
 *
 * ── Two kinds can never be published, by construction ───────────────────────
 *
 * `LICENSED_BY` and `REFERENCE_ONLY` cannot reach APPROVED; the database refuses it with a
 * CHECK, and this file makes sure external licensing statements land there in the first
 * place. The HSB catalogue prints "UNDER LICENSE OF BRITISH PETROLEUM GLOBAL ENGLAND" on
 * both covers — a third party's claim about ITSELF. Republishing it, or anything derived
 * from it, would be a false statement about SAM Group. Only a licensor can assert a licence,
 * so an external `licensed-by` or `approved-by` is `REFERENCE_ONLY` with no promotion path.
 *
 * The same applies to an approval that names nobody: one King Power page claims "approval by
 * reputable global automakers" and names no automaker. An approval by nobody in particular
 * is not an approval.
 *
 * ── The additive claim-transfer trap ────────────────────────────────────────
 *
 * `ADDILEX D-520 can meet the requirements of CD, CC and SC/CC grade oils` means an oil
 * correctly BLENDED with the package at the stated treat rate can meet those levels — not
 * that the additive is a CD-grade oil. The performance level belongs to the treat rate, so
 * every such claim carries the treat-rate context in `contextNote` and is marked non-public
 * pending the deferred treat-rate model. Imported as an ordinary product classification it
 * would state that a barrel of dispersant is an API SN engine oil.
 */

import { ProductClaimKind, TechnicalReviewStatus } from "../../../prisma/generated/enums";

import type { PlanFlag, RawClaim } from "./catalog-import.types";

/** Verb patterns, strongest-binding first. Order matters: `can meet` must beat `suitable`. */
const VERB_PATTERNS: readonly { readonly pattern: RegExp; readonly kind: ProductClaimKind }[] = [
  { pattern: /\bunder licen[cs]e\b|\blicen[cs]ed by\b/i, kind: ProductClaimKind.LICENSED_BY },
  { pattern: /\bapprov(?:ed|al)\b/i, kind: ProductClaimKind.APPROVED_BY },
  { pattern: /\b(?:can meet|meets|meeting)\b/i, kind: ProductClaimKind.MEETS },
  {
    pattern: /\b(?:designed to provide|formulated for|in line with|designed for)\b/i,
    kind: ProductClaimKind.FORMULATED_FOR,
  },
  { pattern: /\brecommended\b/i, kind: ProductClaimKind.RECOMMENDED_FOR },
  {
    pattern: /\b(?:suitable for|used for|primarily used in|for use in|for blending)\b/i,
    kind: ProductClaimKind.SUITABLE_FOR,
  },
];

/** Kinds that an external source can state but this platform can never publish. */
export const NEVER_PUBLISHABLE_KINDS: readonly ProductClaimKind[] = [
  ProductClaimKind.LICENSED_BY,
  ProductClaimKind.REFERENCE_ONLY,
];

export interface ClaimDecision {
  readonly kind: ProductClaimKind;
  readonly standardBody: string | null;
  readonly standardCode: string | null;
  readonly contextNote: string | null;
  /** Always SOURCE_RECORDED or NEEDS_REVIEW. APPROVED is unreachable from here. */
  readonly reviewStatus: TechnicalReviewStatus;
  readonly flags: readonly PlanFlag[];
}

/**
 * Classifies one raw claim.
 *
 * `kindOverride` exists for the cases where the wording alone misleads — a treat-rate table
 * that lists `SN`, `SM`, `SL` with no verb at all is a FORMULATED_FOR target, not a bare
 * classification of the additive — and it is only ever set from evidence recorded in the
 * dataset, never inferred here.
 */
export function classifyClaim(raw: RawClaim, isAdditive: boolean): ClaimDecision {
  const flags: PlanFlag[] = [];
  const text = raw.sourceText;

  let kind =
    raw.kindOverride ??
    VERB_PATTERNS.find((entry) => entry.pattern.test(text))?.kind ??
    ProductClaimKind.CLASSIFICATION_STATED;

  // An external licence or approval is provenance, never a SAM claim. Demoted here so the
  // demotion is visible in the plan rather than only refused later by a database CHECK.
  if (kind === ProductClaimKind.LICENSED_BY) {
    flags.push({
      code: "CLAIM_EXTERNAL_LICENCE",
      severity: "review",
      detail:
        "A third party's licensing statement about itself. Recorded as REFERENCE_ONLY with " +
        "no promotion path: only a licensor can assert a licence.",
    });
    kind = ProductClaimKind.REFERENCE_ONLY;
  } else if (kind === ProductClaimKind.APPROVED_BY && !raw.standardBody) {
    flags.push({
      code: "CLAIM_APPROVAL_NAMES_NOBODY",
      severity: "conflict",
      detail:
        "The source claims an approval and names no approving body. An approval by nobody " +
        "in particular is not an approval; recorded as REFERENCE_ONLY.",
    });
    kind = ProductClaimKind.REFERENCE_ONLY;
  } else if (kind === ProductClaimKind.APPROVED_BY) {
    flags.push({
      code: "CLAIM_EXTERNAL_APPROVAL",
      severity: "review",
      detail:
        `An approval asserted by an external publisher (${raw.standardBody ?? "unnamed"}). ` +
        "Only the approving body may assert it; recorded as REFERENCE_ONLY.",
    });
    kind = ProductClaimKind.REFERENCE_ONLY;
  }

  if (kind === ProductClaimKind.MEETS && /\bmanufacturers?\b/i.test(text) && !raw.standardBody) {
    flags.push({
      code: "CLAIM_MEETS_UNNAMED_PARTY",
      severity: "conflict",
      detail:
        "The source states the product meets 'the manufacturers' requirements' and names no " +
        "manufacturer. Unusable as a conformance claim.",
    });
  }

  // The transfer trap: on an additive, a performance level describes the BLENDED oil.
  let contextNote = raw.contextNote ?? null;
  if (isAdditive && raw.standardCode) {
    flags.push({
      code: "CLAIM_ADDITIVE_TREAT_RATE_TRANSFER",
      severity: "conflict",
      detail:
        "This product is an additive. The performance level belongs to an oil blended with " +
        "it at the stated treat rate, not to the additive. The treat-rate model is deferred, " +
        "so the claim must stay non-public.",
    });
    if (!contextNote) {
      contextNote = "Performance level applies to the blended oil at the stated treat rate.";
    }
  }

  const hasConflict = flags.some((flag) => flag.severity === "conflict");
  return {
    kind,
    standardBody: raw.standardBody ?? null,
    standardCode: raw.standardCode ?? null,
    contextNote,
    reviewStatus: hasConflict
      ? TechnicalReviewStatus.NEEDS_REVIEW
      : TechnicalReviewStatus.SOURCE_RECORDED,
    flags,
  };
}
