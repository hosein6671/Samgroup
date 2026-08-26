"use client";

import { useActionState, useEffect, useId, useRef, useState } from "react";
import { useFormStatus } from "react-dom";

import { submitReviewDecision } from "./decision-actions";
import { DECISION_IDLE, DECISION_LABEL, decisionFailed } from "./decision-state";

import type { DecisionState } from "./decision-state";
import type { ReviewDecisionInput, ReviewStatus, ReviewSubjectType } from "@sam-group/types";
import type { ReactNode } from "react";

const TARGET_STATUS: Readonly<Record<ReviewDecisionInput, ReviewStatus>> = {
  approve: "approved",
  reject: "rejected",
  return_to_needs_review: "needs_review",
};

export function ReviewDecisionControl({
  subjectType,
  id,
  reviewStatus,
  evidenceSetHash,
  eligibleForApproval,
}: {
  readonly subjectType: ReviewSubjectType;
  readonly id: string;
  readonly reviewStatus: ReviewStatus;
  readonly evidenceSetHash: string;
  readonly eligibleForApproval: boolean;
}): ReactNode {
  const options = (Object.keys(TARGET_STATUS) as ReviewDecisionInput[]).filter(
    (decision) => TARGET_STATUS[decision] !== reviewStatus,
  );
  const first = options.find((decision) => decision !== "approve" || eligibleForApproval);
  const [decision, setDecision] = useState<ReviewDecisionInput | null>(first ?? null);
  const [state, action] = useActionState<DecisionState, FormData>(
    submitReviewDecision,
    DECISION_IDLE,
  );
  const select = useRef<HTMLSelectElement>(null);
  const fieldId = useId();
  const feedbackId = `${fieldId}-feedback`;
  const noteId = `${fieldId}-note`;
  const noteRequired = decision !== null && decision !== "approve";

  useEffect(() => {
    if (state.status !== "idle") select.current?.focus();
  }, [state.status]);

  if (reviewStatus === "superseded" || first === undefined) return null;

  return (
    <form action={action} className="ad-review-decision-form">
      <input type="hidden" name="subjectType" value={subjectType} />
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="expectedReviewStatus" value={reviewStatus} />
      <input type="hidden" name="expectedEvidenceSetHash" value={evidenceSetHash} />

      <label className="ad-label" htmlFor={fieldId}>
        Decision
      </label>
      <select
        className="ad-select"
        id={fieldId}
        name="decision"
        ref={select}
        value={decision ?? first}
        onChange={(event) => setDecision(event.target.value as ReviewDecisionInput)}
        aria-describedby={state.status === "idle" ? undefined : feedbackId}
        aria-invalid={decisionFailed(state) ? true : undefined}
      >
        {options.map((option) => (
          <option
            value={option}
            key={option}
            disabled={option === "approve" && !eligibleForApproval}
          >
            {DECISION_LABEL[option]}
            {option === "approve" && !eligibleForApproval ? " — unavailable" : ""}
          </option>
        ))}
      </select>

      <label className="ad-label" htmlFor={noteId}>
        Reviewer note{noteRequired ? " (required)" : " (optional for approval)"}
      </label>
      <textarea
        className="ad-textarea"
        id={noteId}
        name="note"
        rows={4}
        maxLength={2000}
        required={noteRequired}
        aria-describedby={`${noteId}-hint${state.status === "idle" ? "" : ` ${feedbackId}`}`}
        aria-invalid={decisionFailed(state) ? true : undefined}
      />
      <p className="ad-field-hint" id={`${noteId}-hint`}>
        Explain a rejection or why the subject needs more review. The note becomes immutable review
        history.
      </p>

      <DecisionSubmit />
      <DecisionFeedback state={state} id={feedbackId} />
    </form>
  );
}

function DecisionSubmit(): ReactNode {
  const { pending } = useFormStatus();
  return (
    <button className="ad-workflow-submit" type="submit" disabled={pending}>
      {pending ? "Recording…" : "Record decision"}
    </button>
  );
}

function DecisionFeedback({
  state,
  id,
}: {
  readonly state: DecisionState;
  readonly id: string;
}): ReactNode {
  if (state.status === "idle") return null;
  const failed = decisionFailed(state);

  return (
    <div
      className={failed ? "ad-feedback ad-feedback--bad" : "ad-feedback"}
      id={id}
      role={failed ? "alert" : "status"}
    >
      <p>{state.message}</p>
      {state.status === "conflict" && state.issues.length > 0 ? (
        <ul>
          {state.issues.map((issue) => (
            <li key={issue}>{issue}</li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
