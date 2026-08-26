import type { ReviewDecisionInput } from "@sam-group/types";

export type DecisionState =
  | { readonly status: "idle" }
  | { readonly status: "saved"; readonly message: string }
  | { readonly status: "conflict"; readonly message: string; readonly issues: readonly string[] }
  | { readonly status: "invalid"; readonly message: string }
  | { readonly status: "forbidden"; readonly message: string }
  | { readonly status: "not-found"; readonly message: string }
  | { readonly status: "unavailable"; readonly message: string };

export const DECISION_IDLE: DecisionState = { status: "idle" };

export const DECISION_MESSAGE = {
  saved: "Decision recorded. The subject and its immutable history have been refreshed.",
  conflict: "This review changed after the page was loaded. Reload the page and review it again.",
  invalid: "That decision could not be applied. Check the selected decision and note.",
  forbidden: "Your account cannot record this decision.",
  notFound: "This review subject no longer exists.",
  unavailable: "The platform is not responding, so no decision was recorded. Try again shortly.",
} as const;

export const DECISION_LABEL: Readonly<Record<ReviewDecisionInput, string>> = {
  approve: "Approve",
  reject: "Reject",
  return_to_needs_review: "Return to needs review",
};

export function decisionFailed(state: DecisionState): boolean {
  return state.status !== "idle" && state.status !== "saved";
}
