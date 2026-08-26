import { describe, expect, it, vi } from "vitest";

import { accessibleName, elementsOf, findTags, visibleTextOf } from "@test/element-tree";

import { ReviewDecisionControl } from "./decision-control";

import type { DecisionState } from "./decision-state";
import type { ReactNode } from "react";

const state: { current: DecisionState } = { current: { status: "idle" } };

vi.mock("react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react")>()),
  useActionState: () => [state.current, vi.fn(), false],
  useEffect: () => undefined,
  useId: () => "review-decision",
  useRef: <T,>(initial: T) => ({ current: initial }),
  useState: <T,>(initial: T) => [initial, vi.fn()],
}));

vi.mock("react-dom", () => ({ useFormStatus: () => ({ pending: false }) }));
vi.mock("./decision-actions", () => ({ submitReviewDecision: vi.fn() }));

const HASH = "a".repeat(64);

function control(
  reviewStatus: "source_recorded" | "needs_review" | "approved" | "rejected" | "superseded",
  eligibleForApproval = true,
  outcome: DecisionState = { status: "idle" },
): ReactNode {
  state.current = outcome;
  return ReviewDecisionControl({
    subjectType: "specification",
    id: "11111111-1111-4111-8111-111111111111",
    reviewStatus,
    evidenceSetHash: HASH,
    eligibleForApproval,
  });
}

function hidden(tree: ReactNode, name: string): unknown {
  return findTags(tree, "input").find((input) => input.props.name === name)?.props.value;
}

describe("the Phase C decision control", () => {
  it("uses native labelled controls and an explicit submit button", () => {
    const tree = control("source_recorded");
    const [select] = findTags(tree, "select");
    const labels = findTags(tree, "label");
    expect(findTags(tree, "form")).toHaveLength(1);
    expect(labels[0]?.props.htmlFor).toBe(select?.props.id);
    expect(labels[1]?.props.htmlFor).toBe(findTags(tree, "textarea")[0]?.props.id);
    expect(accessibleName(findTags(tree, "button")[0]!)).toBe("Record decision");
    expect(elementsOf(tree).filter((element) => element.props.role === "listbox")).toHaveLength(0);
  });

  it("carries the exact status and hash the reviewer saw", () => {
    const tree = control("needs_review");
    expect(hidden(tree, "expectedReviewStatus")).toBe("needs_review");
    expect(hidden(tree, "expectedEvidenceSetHash")).toBe(HASH);
  });

  it("never offers a no-op or supersede decision", () => {
    const labels = findTags(control("approved"), "option").map((option) =>
      visibleTextOf(option.props.children as ReactNode),
    );
    expect(labels).toEqual(["Reject", "Return to needs review"]);
    expect(labels.join(" ").toLowerCase()).not.toContain("supersede");
  });

  it("marks approval unavailable when blockers exist while retaining rejection", () => {
    const options = findTags(control("source_recorded", false), "option");
    expect(options.find((option) => option.props.value === "approve")?.props.disabled).toBe(true);
    expect(options.find((option) => option.props.value === "reject")?.props.disabled).toBe(false);
  });

  it("announces a stale conflict assertively and associates both fields", () => {
    const tree = control("source_recorded", true, {
      status: "conflict",
      message: "Reload and review again.",
      issues: ["Evidence changed."],
    });
    const [alert] = elementsOf(tree).filter((element) => element.props.role === "alert");
    expect(visibleTextOf(alert?.props.children as ReactNode)).toContain("Reload and review again.");
    expect(findTags(tree, "select")[0]?.props["aria-describedby"]).toBe(alert?.props.id);
    expect(findTags(tree, "textarea")[0]?.props["aria-describedby"]).toContain(alert?.props.id);
  });

  it("renders no decision control for a superseded subject", () => {
    expect(control("superseded")).toBeNull();
  });
});
