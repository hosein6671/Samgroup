import { describe, expect, it, vi } from "vitest";

import { accessibleName, elementsOf, findTags, visibleTextOf } from "@test/element-tree";

import { AssignmentControl, StatusControl } from "./workflow-views";
import { WORKFLOW_MESSAGE } from "./workflow-state";

import type { WorkflowState } from "./workflow-state";
import type { ReactNode } from "react";

/**
 * The two workflow controls, against the **WCAG 2.2 AA** standing target.
 *
 * ## How a Client Component is rendered here
 *
 * Their only client-ness is two hooks — `useActionState` for the Server Action result and
 * `useFormStatus` for the pending state — so both are stubbed and the components are called as the
 * plain functions they otherwise are. Nothing else is faked: the labels, the option lists, the
 * hidden compare-and-set fields, the live regions and the `aria-*` wiring are the real ones.
 *
 * That is the same seam `login-accessibility.spec.tsx` uses, and for the same reason: React Testing
 * Library and a DOM environment would both be new dependencies, and everything asserted below is
 * decidable from the returned tree. Focus behaviour is not decidable from markup and was verified
 * in a browser instead.
 */

const state: { current: WorkflowState } = { current: { status: "idle" } };

const effects: (() => void)[] = [];

vi.mock("react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react")>()),
  useActionState: () => [state.current, vi.fn(), false],
  // Collected rather than run, so a test can fire them and observe what the component intended.
  useEffect: (run: () => void) => {
    effects.push(run);
  },
  // A plain box. The real hook requires a render, and these components are called as functions.
  useRef: <T,>(initial: T) => ({ current: initial }),
}));

vi.mock("react-dom", () => ({ useFormStatus: () => ({ pending: false }) }));

vi.mock("./workflow-actions", () => ({
  submitStatusChange: vi.fn(),
  submitAssignmentChange: vi.fn(),
}));

const LEAD_ID = "11111111-1111-4111-8111-111111111111";
const ADA = "22222222-2222-4222-8222-222222222222";

function statusControl(
  current: "new" | "in_progress" | "closed",
  outcome: WorkflowState = { status: "idle" },
): ReactNode {
  state.current = outcome;

  return StatusControl({ section: "inquiries", id: LEAD_ID, current });
}

function assignmentControl(
  currentAssigneeId: string | null = null,
  outcome: WorkflowState = { status: "idle" },
): ReactNode {
  state.current = outcome;

  return AssignmentControl({
    section: "inquiries",
    id: LEAD_ID,
    currentAssigneeId,
    options: [{ id: ADA, email: "ada@samgp.test" }],
  });
}

function hiddenValue(tree: ReactNode, name: string): unknown {
  return findTags(tree, "input").find((input) => input.props.name === name)?.props.value;
}

function optionValues(tree: ReactNode): unknown[] {
  return findTags(tree, "option").map((option) => option.props.value);
}

describe("the status control", () => {
  it("is a native select and a real submit button, in a form", () => {
    const tree = statusControl("new");

    expect(findTags(tree, "form")).toHaveLength(1);
    expect(findTags(tree, "select")).toHaveLength(1);
    expect(findTags(tree, "button")[0]?.props.type).toBe("submit");
    // No custom widget standing in for a select.
    expect(elementsOf(tree).filter((element) => element.props.role === "listbox")).toHaveLength(0);
  });

  it("associates a real label with the select", () => {
    const tree = statusControl("new");
    const [label] = findTags(tree, "label");
    const [select] = findTags(tree, "select");

    expect(label?.props.htmlFor).toBe(select?.props.id);
    expect(visibleTextOf(label?.props.children as ReactNode)).toBe("Change status");
  });

  it("gives the submit button a name that says what it does", () => {
    expect(accessibleName(findTags(statusControl("new"), "button")[0]!)).toBe("Update status");
  });

  /**
   * `from` is the compare-and-set predicate, carried from the state the page rendered. Without it
   * in the form the mutation would be an unconditional write.
   */
  it("carries the current status as the compare-and-set predicate", () => {
    expect(hiddenValue(statusControl("in_progress"), "from")).toBe("in_progress");
    expect(hiddenValue(statusControl("in_progress"), "id")).toBe(LEAD_ID);
    expect(hiddenValue(statusControl("in_progress"), "section")).toBe("inquiries");
  });

  it.each([
    ["new", ["in_progress", "closed"]],
    ["in_progress", ["closed"]],
    ["closed", ["in_progress"]],
  ] as const)("offers only the transitions reachable from %s", (current, expected) => {
    expect(optionValues(statusControl(current))).toEqual(expected);
  });

  /** Never the current state — a no-op is refused by the API and would be a pointless option. */
  it("never offers the state the lead is already in", () => {
    for (const current of ["new", "in_progress", "closed"] as const) {
      expect(optionValues(statusControl(current))).not.toContain(current);
    }
  });

  it("labels every option in words rather than by its stored value", () => {
    const labels = findTags(statusControl("new"), "option").map((option) =>
      visibleTextOf(option.props.children as ReactNode),
    );

    expect(labels).toEqual(["In progress", "Closed"]);
  });

  it("does not auto-submit — the select carries no change handler", () => {
    for (const element of elementsOf(statusControl("new"))) {
      expect(element.props.onChange).toBeUndefined();
      expect(element.props.onInput).toBeUndefined();
    }
  });
});

describe("the assignment control", () => {
  it("offers Unassigned plus active Sales Experts, and nobody else", () => {
    expect(optionValues(assignmentControl())).toEqual(["unassigned", ADA]);
  });

  it("carries the current owner as the compare-and-set predicate", () => {
    expect(hiddenValue(assignmentControl(ADA), "fromAssigneeId")).toBe(ADA);
  });

  /** An HTML option value cannot be null; the action translates the sentinel at the edge. */
  it("uses the unassigned sentinel when the lead has no owner", () => {
    expect(hiddenValue(assignmentControl(null), "fromAssigneeId")).toBe("unassigned");
    expect(findTags(assignmentControl(null), "select")[0]?.props.defaultValue).toBe("unassigned");
  });

  it("associates a real label and names its button", () => {
    const tree = assignmentControl();
    const [label] = findTags(tree, "label");

    expect(label?.props.htmlFor).toBe(findTags(tree, "select")[0]?.props.id);
    expect(accessibleName(findTags(tree, "button")[0]!)).toBe("Update assignee");
  });
});

describe("feedback, announcement and error association", () => {
  it("announces nothing while idle — no empty live region", () => {
    const tree = statusControl("new");

    expect(elementsOf(tree).filter((element) => element.props.role === "status")).toHaveLength(0);
    expect(elementsOf(tree).filter((element) => element.props.role === "alert")).toHaveLength(0);
    // ...and the select is not described by a message that is not there.
    expect(findTags(tree, "select")[0]?.props["aria-describedby"]).toBeUndefined();
  });

  it("announces success politely", () => {
    const tree = statusControl("new", { status: "saved", message: WORKFLOW_MESSAGE.statusSaved });
    const regions = elementsOf(tree).filter((element) => element.props.role === "status");

    expect(regions).toHaveLength(1);
    expect(visibleTextOf(regions[0]?.props.children as ReactNode)).toBe("Status updated.");
    expect(findTags(tree, "select")[0]?.props["aria-invalid"]).toBeUndefined();
  });

  /**
   * The conflict message is the one that has to teach the operator what to do. "Try again" alone
   * would be wrong advice — retrying the same stale `from` fails identically.
   */
  it("announces a conflict assertively, and says to reload", () => {
    const tree = statusControl("new", { status: "conflict", message: WORKFLOW_MESSAGE.conflict });
    const alerts = elementsOf(tree).filter((element) => element.props.role === "alert");

    expect(alerts).toHaveLength(1);
    expect(visibleTextOf(alerts[0]?.props.children as ReactNode)).toBe(
      "This lead was changed by someone else. Reload and try again.",
    );
  });

  it.each(["conflict", "forbidden", "not-found", "invalid", "unavailable"] as const)(
    "marks the field invalid and describes it on a %s failure",
    (status) => {
      const tree = statusControl("new", { status, message: "Something to say." });
      const [select] = findTags(tree, "select");
      const [message] = elementsOf(tree).filter((element) => element.props.role === "alert");

      expect(select?.props["aria-invalid"]).toBe(true);
      // The message is attached to the control, not merely near it.
      expect(select?.props["aria-describedby"]).toBe(message?.props.id);
    },
  );

  it("gives each control its own message id, so two forms cannot collide", () => {
    const status = statusControl("new", { status: "conflict", message: "x" });
    const assignment = assignmentControl(null, { status: "conflict", message: "x" });

    const statusId = findTags(status, "select")[0]?.props["aria-describedby"];
    const assignmentId = findTags(assignment, "select")[0]?.props["aria-describedby"];

    expect(statusId).not.toBe(assignmentId);
  });

  it("mentions no HTTP status, role or other operator in any message", () => {
    for (const message of Object.values(WORKFLOW_MESSAGE)) {
      expect(message).not.toMatch(/\b(40[0-9]|50[0-9])\b/);
      expect(message.toLowerCase()).not.toContain("admin");
      expect(message.toLowerCase()).not.toContain("token");
    }
  });
});

describe("no credential reaches either control", () => {
  it("renders no token, cookie name or API origin", () => {
    const trees = [
      statusControl("new", { status: "conflict", message: WORKFLOW_MESSAGE.conflict }),
      assignmentControl(ADA, { status: "saved", message: WORKFLOW_MESSAGE.assignmentSaved }),
    ];

    for (const tree of trees) {
      const serialized = JSON.stringify(elementsOf(tree).map((element) => element.props));

      for (const secret of ["bearer", "authorization", "sam_admin_access", "sam_admin_refresh"]) {
        expect(serialized.toLowerCase()).not.toContain(secret);
      }

      expect(serialized).not.toContain("/api/v1");
      expect(serialized).not.toMatch(/https?:\/\//);
    }
  });
});

describe("focus after a mutation", () => {
  /**
   * The defect this exists for: a successful mutation calls `revalidatePath`, the route re-renders,
   * the form subtree is replaced and the focused submit button is unmounted — so focus falls back to
   * `<body>` and a keyboard user is stranded at the top of the document with no idea the change
   * landed. Found in a browser; invisible to a tree walk, which is why this asserts the *intent*
   * (the effect focuses the control) rather than the DOM outcome.
   */
  it("focuses the control once an outcome arrives", () => {
    effects.length = 0;

    const focus = vi.fn();
    const tree = statusControl("new", { status: "saved", message: "Status updated." });
    const select = findTags(tree, "select")[0];

    // The ref the component attached, standing in for the mounted element.
    const ref = select?.props.ref as { current: { focus: () => void } | null };
    ref.current = { focus };

    expect(effects).toHaveLength(1);
    effects[0]?.();

    expect(focus).toHaveBeenCalledTimes(1);
  });

  it("does not steal focus before anything has happened", () => {
    effects.length = 0;

    const focus = vi.fn();
    const tree = statusControl("new");
    const ref = findTags(tree, "select")[0]?.props.ref as { current: { focus: () => void } | null };

    ref.current = { focus };
    effects[0]?.();

    expect(focus).not.toHaveBeenCalled();
  });

  it("restores focus on a failure too, not only on success", () => {
    effects.length = 0;

    const focus = vi.fn();
    const tree = assignmentControl(null, { status: "conflict", message: "…" });
    const ref = findTags(tree, "select")[0]?.props.ref as { current: { focus: () => void } | null };

    ref.current = { focus };
    effects[0]?.();

    expect(focus).toHaveBeenCalledTimes(1);
  });
});
