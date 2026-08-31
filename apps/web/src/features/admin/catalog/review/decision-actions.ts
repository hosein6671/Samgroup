"use server";

import { revalidatePath } from "next/cache";

import { decideReviewSubject } from "./review-api";
import { reviewSubjectHref } from "./review-query";
import { DECISION_MESSAGE } from "./decision-state";

import type { DecisionState } from "./decision-state";
import type { ReviewDecisionInput, ReviewStatus, ReviewSubjectType } from "@sam-group/types";

const SUBJECT_TYPES: readonly ReviewSubjectType[] = [
  "specification",
  "product_claim",
  "product_copy",
];
const DECISIONS: readonly ReviewDecisionInput[] = ["approve", "reject", "return_to_needs_review"];
const STATUSES: readonly ReviewStatus[] = [
  "source_recorded",
  "needs_review",
  "approved",
  "rejected",
  "superseded",
];
const HASH = /^[0-9a-f]{64}$/;

function stringValue(formData: FormData, name: string): string | null {
  const value = formData.get(name);
  return typeof value === "string" ? value : null;
}

/** One Server Action for both subject types; NestJS remains the authorization and workflow authority. */
export async function submitReviewDecision(
  _previous: DecisionState,
  formData: FormData,
): Promise<DecisionState> {
  const subjectType = stringValue(formData, "subjectType");
  const id = stringValue(formData, "id");
  const decision = stringValue(formData, "decision");
  const expectedReviewStatus = stringValue(formData, "expectedReviewStatus");
  const expectedEvidenceSetHash = stringValue(formData, "expectedEvidenceSetHash");
  const note = stringValue(formData, "note")?.trim() ?? "";

  if (
    subjectType === null ||
    !(SUBJECT_TYPES as readonly string[]).includes(subjectType) ||
    id === null ||
    id === "" ||
    decision === null ||
    !(DECISIONS as readonly string[]).includes(decision) ||
    expectedReviewStatus === null ||
    !(STATUSES as readonly string[]).includes(expectedReviewStatus) ||
    expectedEvidenceSetHash === null ||
    !HASH.test(expectedEvidenceSetHash)
  ) {
    return { status: "invalid", message: DECISION_MESSAGE.invalid };
  }

  if (decision !== "approve" && note === "") {
    return { status: "invalid", message: "A reviewer note is required for this decision." };
  }

  const result = await decideReviewSubject(subjectType as ReviewSubjectType, id, {
    decision: decision as ReviewDecisionInput,
    expectedReviewStatus: expectedReviewStatus as ReviewStatus,
    expectedEvidenceSetHash,
    ...(note === "" ? {} : { note }),
  });

  if (result.state === "ok") {
    revalidatePath(reviewSubjectHref(subjectType as ReviewSubjectType, id));
    return { status: "saved", message: DECISION_MESSAGE.saved };
  }

  switch (result.state) {
    case "conflict":
      return {
        status: "conflict",
        message: DECISION_MESSAGE.conflict,
        issues: result.blockers,
      };
    case "invalid":
      return {
        status: "invalid",
        message:
          result.issue === null
            ? DECISION_MESSAGE.invalid
            : `${DECISION_MESSAGE.invalid} ${result.issue}`,
      };
    case "forbidden":
      return { status: "forbidden", message: DECISION_MESSAGE.forbidden };
    case "not-found":
      return { status: "not-found", message: DECISION_MESSAGE.notFound };
    case "unauthenticated":
    case "unavailable":
    case "failed":
      return { status: "unavailable", message: DECISION_MESSAGE.unavailable };
  }
}
