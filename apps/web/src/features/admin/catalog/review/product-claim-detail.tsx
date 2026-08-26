import {
  ApprovalBlockers,
  EvidencePanel,
  Field,
  Fields,
  Panel,
  ProductContext,
  ReviewHistory,
  ReviewInvalidations,
  ReviewWarnings,
  SubPanel,
  SubjectStatus,
} from "./detail-shell";
import {
  CLAIM_KIND_LABEL,
  CLAIM_KIND_MEANING,
  CLAIM_KIND_PROHIBITED_REASON,
  claimKindIsNeverApprovable,
} from "./review-vocabulary";

import type { ReviewDetailResponse } from "@sam-group/types";
import type { ReactNode } from "react";

/**
 * The ProductClaim-specific half of the review detail screen.
 *
 * Everything shared with the Specification screen — frame, product context, status, blockers,
 * evidence, history — comes from `detail-shell.tsx`. What is written here is the claim itself and
 * its classification, which is the part that has to be got exactly right.
 *
 * ## The UI must not upgrade a claim's legal meaning
 *
 * The claim kinds form a ladder whose rungs are legal rather than stylistic, and the failure mode
 * this screen exists to prevent is a reviewer reading one rung as another. Four distinctions are
 * kept explicitly apart, each with its own labelled field and its own sentence:
 *
 *  * **source-recorded classification** — `classification_stated` records that the source stated a
 *    class. There is no claim verb in it at all, and it is not a statement that the product meets
 *    the class;
 *  * **formulated-for / target wording** — `formulated_for` is an additive target level. It is not
 *    an approval, is never rendered next to one in a way that lets the two blur, and its own
 *    sentence says so;
 *  * **named approval** — `approved_by` and `licensed_by` name a body, and the body's name is a
 *    field of its own rather than being folded into the statement;
 *  * **approval-prohibited kinds** — `licensed_by` and `reference_only` can never be approved here,
 *    and the reason is stated as a reason rather than as a refusal.
 *
 * No wording in this module paraphrases a claim into a stronger verb, and none softens one either.
 * The statement fields are rendered verbatim; the classification is rendered as its own vocabulary;
 * and the two are never merged into a single sentence the source never wrote.
 *
 * ## Nothing here is a decision
 *
 * Read-only. No form, no field, no button, no Server Action, no disabled stand-in.
 */
export function ProductClaimDetail({
  subject,
}: {
  readonly subject: ReviewDetailResponse;
}): ReactNode {
  const claim = subject.claim;
  const prohibited = claim === null ? undefined : CLAIM_KIND_PROHIBITED_REASON[claim.kind];

  return (
    <div className="ad-detail">
      <ProductContext product={subject.product} grade={subject.grade} />
      <SubjectStatus subject={subject} />

      {claim === null ? (
        /*
         * The API populates exactly one of `specification`/`claim`, matching `subjectType`. This
         * branch is a contract violation, and it is rendered as a stated absence rather than as an
         * empty panel — blank fields would read as a claim that says nothing, which is a different
         * and wrong thing to tell a reviewer.
         */
        <Panel heading="Claim statement">
          <p className="ad-note ad-note--strong">
            This subject arrived without its claim. Nothing about the claim can be shown, and
            nothing should be concluded from its absence here.
          </p>
        </Panel>
      ) : (
        <>
          <Panel heading="Claim statement">
            <p className="ad-note">
              The claim as the source recorded it. Each part is shown separately and verbatim; this
              screen does not compose them into a sentence the source did not write.
            </p>
            <Fields>
              <Field label="Standard or specification code" value={claim.standardCode} technical />
              <Field label="Named body" value={claim.standardBody} />
              <Field label="Source context note" value={claim.contextNote} />
            </Fields>
          </Panel>

          <Panel heading="Claim classification">
            <p className="ad-note">
              What this claim asserts, in the terms that decide whether it may ever be published.
              The classification is the source&apos;s own recorded strength — it is not an
              interpretation made here.
            </p>

            <SubPanel heading="Recorded classification">
              <Fields>
                <Field
                  label="Claim kind"
                  value={CLAIM_KIND_LABEL[claim.kind] ?? claim.kind}
                  hint={CLAIM_KIND_MEANING[claim.kind]}
                />
                <Field
                  label="Names an approving or licensing body"
                  value={
                    claim.kind === "approved_by" || claim.kind === "licensed_by"
                      ? (claim.standardBody ??
                        "The kind requires a named body, and none is recorded")
                      : "No — this kind names no approving body"
                  }
                />
                <Field
                  label="Approval available for this kind"
                  value={
                    claimKindIsNeverApprovable(claim.kind)
                      ? "No — this kind can never be approved"
                      : "Subject to the blockers listed below"
                  }
                />
              </Fields>
            </SubPanel>

            {prohibited === undefined ? null : (
              <p className="ad-note ad-note--strong">{prohibited}</p>
            )}

            {claim.kind === "formulated_for" ? (
              <p className="ad-note ad-note--strong">
                This is a formulated-for claim: an additive target level, not an approval by any
                body. It must never be published or summarised as an approval.
              </p>
            ) : null}

            {claim.kind === "classification_stated" ? (
              <p className="ad-note ad-note--strong">
                This records a classification the source stated. The source used no claim verb, so
                it does not assert that the product meets that classification.
              </p>
            ) : null}
          </Panel>
        </>
      )}

      <EvidencePanel evidence={subject.evidence} />
      <ApprovalBlockers blockers={subject.approvalBlockers} prohibited={prohibited} />
      <ReviewWarnings warnings={subject.warnings} />
      <ReviewHistory history={subject.history} />
      <ReviewInvalidations invalidations={subject.invalidations} />
    </div>
  );
}
