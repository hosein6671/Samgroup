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
  SubjectStatus,
} from "./detail-shell";
import { ReviewDecisionControl } from "./decision-control";

import type { ReviewDetailResponse } from "@sam-group/types";
import type { ReactNode } from "react";

/**
 * The ProductCopy half of the review detail screen (ADR-019).
 *
 * ## What a reviewer is actually being asked here
 *
 * On the other two screens the reviewer compares a NORMALIZED value against the raw source text:
 * "the datasheet says 14.2, the row says 14.2, the unit is right". The comparison is mechanical and
 * the screen's job is to put the two side by side.
 *
 * Copy has no normalized form. The question is "does this sentence say what that document said",
 * which no rule can decide — and that is precisely why copy became a review subject rather than an
 * editable field. So this screen does one thing above all: it shows the drafted prose **verbatim
 * and complete**, beside the raw source text, with nothing between them.
 *
 * ## Nothing here summarises, truncates or reflows the draft
 *
 * The queue truncates to 160 characters because a work list must. This screen must not: a reviewer
 * approving a paragraph they were shown two thirds of is approving text they did not read, and the
 * approval would carry their name. `white-space: pre-wrap` on the draft preserves the author's own
 * line breaks for the same reason.
 *
 * ## The rule that is not enforced by this screen
 *
 * "Copy is transcribed from the bound source document and never synthesized" is a database CHECK
 * inside `product_copy_approval_gate`, not a condition of this component. The reminder below is a
 * reminder; the enforcement is elsewhere, and deliberately somewhere a screen cannot route around.
 *
 * ## Nothing here is a decision
 *
 * Read-only, exactly like its two siblings. The one control is `ReviewDecisionControl`, which is
 * the shared Server Action path and is not special-cased for this subject.
 */
export function ProductCopyDetail({
  subject,
}: {
  readonly subject: ReviewDetailResponse;
}): ReactNode {
  const copy = subject.copy;

  return (
    <div className="ad-detail">
      <div className="ad-review-detail-summary">
        <ProductContext product={subject.product} grade={subject.grade} />
        <SubjectStatus subject={subject} />
      </div>

      {copy === null ? (
        /*
         * The API populates exactly one of `specification`/`claim`/`copy`, matching `subjectType`.
         * This branch is a contract violation, and it is rendered as a stated absence rather than
         * as an empty panel — a blank draft would read as copy that says nothing, which is a
         * different and wrong thing to tell a reviewer.
         */
        <Panel heading="Drafted copy">
          <p className="ad-note ad-note--strong">
            This subject arrived without its copy. Nothing about the draft can be shown, and nothing
            should be concluded from its absence here.
          </p>
        </Panel>
      ) : (
        <Panel heading="Drafted copy">
          <p className="ad-note">
            The draft exactly as written, in full. Compare every statement in it against the source
            text below before deciding — this is the text visitors would read.
          </p>

          {/*
            Read-only, and deliberately not a warning. An inactive locale does not block approval
            (ADR-019); it only keeps the approved sentence out of the public read model until that
            locale is active again, at which point the existing view rule publishes it with no
            second decision.
          */}
          <Fields>
            <Field label="Locale" value={copy.locale} technical />
            <Field
              label="Locale status"
              value={copy.localeActive ? "Active" : "Inactive"}
              hint={
                copy.localeActive
                  ? "Approved copy in this locale is served as the product's description."
                  : "Approval is unaffected. Approved copy stays out of public responses until this locale is active again."
              }
            />
          </Fields>

          <div className="ad-review-copy-draft">
            <h4 className="ad-review-copy-draft__label">Summary</h4>
            <p className="ad-review-copy-draft__text">{copy.summary}</p>
          </div>

          {copy.selectionNote === null ? null : (
            <div className="ad-review-copy-draft">
              <h4 className="ad-review-copy-draft__label">Selection note</h4>
              <p className="ad-review-copy-draft__text">{copy.selectionNote}</p>
            </div>
          )}

          <p className="ad-note ad-note--strong">
            Composition and formulation wording may only be transcribed from this product&apos;s
            bound source document. It is never written from the product name, its category, a
            neighbouring product, or general industry knowledge. If a statement here is not in the
            source below, reject the draft.
          </p>
        </Panel>
      )}

      <EvidencePanel evidence={subject.evidence} />
      <ApprovalBlockers blockers={subject.approvalBlockers} />
      <ReviewWarnings warnings={subject.warnings} />

      <Panel heading="Record a decision" className="ad-review-decision-panel">
        <p className="ad-note">
          Decisions are permanent audit events. Approval is available only when every mechanical
          eligibility rule above passes; rejection and return-to-review remain available.
        </p>
        <p className="ad-note">
          Approving this draft publishes it as the product&apos;s description in this locale.
          Editing the text afterwards returns it to review automatically and withdraws it from the
          site until it is approved again.
        </p>
        <ReviewDecisionControl
          subjectType={subject.subjectType}
          id={subject.id}
          reviewStatus={subject.reviewStatus}
          evidenceSetHash={subject.evidenceSetHash}
          eligibleForApproval={subject.eligibleForApproval}
        />
      </Panel>

      <ReviewHistory history={subject.history} />
      <ReviewInvalidations invalidations={subject.invalidations} />
    </div>
  );
}
