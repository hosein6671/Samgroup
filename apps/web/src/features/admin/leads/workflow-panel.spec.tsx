import { readFileSync } from "node:fs";

import { describe, expect, it, vi } from "vitest";

import { accessibleName, elementsOf, findTags, tagOf, visibleTextOf } from "@test/element-tree";

import { WorkflowPanel } from "./workflow-panel";

import type { LeadHistoryEntry } from "@sam-group/types";
import type { ReactNode } from "react";

/**
 * The Workflow section — what each role sees, and whether it reads without colour.
 *
 * ## The controls are stubbed, and why that is the right seam
 *
 * `StatusControl` and `AssignmentControl` are Client Components built on `useActionState` and
 * `useFormStatus`, which cannot run in a synchronous tree walk. They are replaced here by markers,
 * so these tests assert **which controls a role is offered** — the question this file exists for —
 * while `workflow-controls.spec.tsx` asserts the controls' own semantics with the hooks stubbed.
 *
 * Splitting it that way keeps each file's failure meaningful: a role regression fails here, a
 * labelling regression fails there, and neither hides the other.
 */

vi.mock("./workflow-views", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./workflow-views")>()),
  StatusControl: () => <div data-control="status" />,
  AssignmentControl: () => <div data-control="assignment" />,
}));

const HISTORY: LeadHistoryEntry[] = [
  {
    kind: "status",
    at: "2026-08-20T11:00:00.000Z",
    actorEmail: "ada@samgp.test",
    fromStatus: "new",
    toStatus: "in_progress",
    note: "Called back",
  },
  {
    kind: "assignment",
    at: "2026-08-20T10:00:00.000Z",
    actorEmail: "admin@samgp.test",
    fromAssigneeEmail: null,
    toAssigneeEmail: "ada@samgp.test",
    note: null,
  },
];

function panel(overrides: Partial<Parameters<typeof WorkflowPanel>[0]> = {}): ReactNode {
  return (
    <WorkflowPanel
      section="inquiries"
      id="11111111-1111-4111-8111-111111111111"
      status="new"
      assigneeId={null}
      assigneeLabel={null}
      assigneeIsInactive={false}
      canAssign={false}
      canChangeStatus={false}
      assigneeOptions={[]}
      history={null}
      {...overrides}
    />
  );
}

function controls(tree: ReactNode): string[] {
  return elementsOf(tree)
    .map((element) => element.props["data-control"])
    .filter((value): value is string => typeof value === "string");
}

describe("what each role is offered", () => {
  it("gives an Admin both controls and the history", () => {
    const tree = panel({ canAssign: true, canChangeStatus: true, history: HISTORY });

    expect(controls(tree).sort()).toEqual(["assignment", "status"]);
    expect(visibleTextOf(tree)).toContain("History");
  });

  /** A Sales Expert works their leads; they do not redistribute them. */
  it("gives a Sales Expert the status control only, with history", () => {
    const tree = panel({ canAssign: false, canChangeStatus: true, history: HISTORY });

    expect(controls(tree)).toEqual(["status"]);
    expect(visibleTextOf(tree)).toContain("History");
  });

  /**
   * Content Manager reads leads and nothing else here. `history: null` is "not permitted", and it
   * renders no History block at all rather than an empty one — an empty list would suggest nothing
   * has happened, which is a different claim.
   */
  it("gives a Content Manager no control and no history", () => {
    const tree = panel({ canAssign: false, canChangeStatus: false, history: null });

    expect(controls(tree)).toEqual([]);
    expect(visibleTextOf(tree)).not.toContain("History");
    // The state itself is still readable — they may read leads.
    expect(visibleTextOf(tree)).toContain("Status");
    expect(visibleTextOf(tree)).toContain("Unassigned");
  });
});

describe("the current state reads without colour", () => {
  it("renders the status as words", () => {
    expect(visibleTextOf(panel({ status: "in_progress" }))).toContain("In progress");
    expect(visibleTextOf(panel({ status: "closed" }))).toContain("Closed");
  });

  it("says Unassigned rather than leaving a blank", () => {
    expect(visibleTextOf(panel())).toContain("Unassigned");
  });

  it("names the owner when there is one", () => {
    expect(visibleTextOf(panel({ assigneeLabel: "ada@samgp.test" }))).toContain("ada@samgp.test");
  });

  /** An operator needs to know the lead is parked with someone who cannot sign in. */
  it("marks a disabled assignee in words", () => {
    const text = visibleTextOf(
      panel({ assigneeLabel: "ada@samgp.test", assigneeIsInactive: true }),
    );

    expect(text).toContain("account disabled");
  });

  it("uses a labelled section with its own heading", () => {
    const sections = findTags(panel(), "section");

    expect(sections).toHaveLength(1);
    expect(sections[0]?.props["aria-labelledby"]).toBe("ad-group-workflow");
    expect(findTags(panel(), "h2")).toHaveLength(1);
  });
});

describe("the history list", () => {
  const tree = panel({ canChangeStatus: true, history: HISTORY });

  it("is an ordered list, newest first", () => {
    const lists = findTags(tree, "ol");

    expect(lists).toHaveLength(1);
    expect(findTags(tree, "li")).toHaveLength(2);
  });

  it("sits under an h3, so the heading hierarchy does not skip a level", () => {
    const levels = elementsOf(tree)
      .map((element) => tagOf(element))
      .filter((tag): tag is string => tag !== null && /^h[1-6]$/.test(tag));

    expect(levels).toEqual(["h2", "h3"]);
  });

  /** Arrows are announced as "right arrow" or skipped; a sentence is neither. */
  it("describes each change in words rather than with a glyph", () => {
    const text = visibleTextOf(tree);

    expect(text).toContain("Status changed from New to In progress");
    expect(text).toContain("Assignment changed from Unassigned to ada@samgp.test");
    expect(text).not.toContain("→");
    expect(text).not.toContain("->");
  });

  it("renders each timestamp as a real time element", () => {
    const times = findTags(tree, "time");

    expect(times).toHaveLength(2);
    expect(times[0]?.props.dateTime).toBe("2026-08-20T11:00:00.000Z");
  });

  it("names the actor from the snapshot", () => {
    expect(visibleTextOf(tree)).toContain("ada@samgp.test");
    expect(visibleTextOf(tree)).toContain("admin@samgp.test");
  });

  /**
   * The snapshot is what survives a deleted account. When it is genuinely absent the entry says
   * "unknown" rather than leaving a gap that reads as a rendering bug.
   */
  it("says unknown when no actor snapshot exists", () => {
    const anonymous = panel({
      canChangeStatus: true,
      history: [
        {
          kind: "status",
          at: "2026-08-20T09:00:00.000Z",
          actorEmail: null,
          fromStatus: null,
          toStatus: "new",
          note: null,
        },
      ],
    });

    expect(visibleTextOf(anonymous)).toContain("unknown");
  });

  it("shows a note when one was given, and nothing when not", () => {
    expect(visibleTextOf(tree)).toContain("Called back");
  });

  it("says so plainly when a lead has no history yet", () => {
    expect(visibleTextOf(panel({ canChangeStatus: true, history: [] }))).toContain(
      "Nothing has happened to this lead yet",
    );
  });

  it("hides the decorative separator from assistive technology", () => {
    const separators = elementsOf(tree).filter(
      (element) => visibleTextOf(element.props.children as ReactNode) === "·",
    );

    for (const separator of separators) {
      expect(String(separator.props["aria-hidden"])).toBe("true");
    }
  });
});

describe("nothing on this panel is a pointer-only control", () => {
  it("has no click handler anywhere", () => {
    for (const element of elementsOf(
      panel({ canAssign: true, canChangeStatus: true, history: HISTORY }),
    )) {
      expect(element.props.onClick).toBeUndefined();
      expect(element.props.onChange).toBeUndefined();
    }
  });

  it("exposes no user id in the rendered tree", () => {
    const tree = panel({
      canAssign: true,
      canChangeStatus: true,
      assigneeId: "22222222-2222-4222-8222-222222222222",
      assigneeLabel: "ada@samgp.test",
      history: HISTORY,
    });

    // The panel names people; the id travels only inside the stubbed control's hidden field.
    expect(visibleTextOf(tree)).not.toContain("22222222-2222-4222-8222-222222222222");
  });
});

describe("accessible names", () => {
  it("gives the section heading a name that says what it is", () => {
    const [heading] = findTags(panel(), "h2");

    expect(accessibleName(heading!)).toBe("Workflow");
  });
});

/**
 * The RSC boundary, asserted structurally.
 *
 * A Server Component that imports a **value** from a `"use client"` module does not receive the
 * value — React hands it a client-reference proxy. That is not a type error and not a runtime
 * throw: `"closed" in STATUS_LABEL` simply evaluates false and every label silently falls back to
 * the raw stored string. It shipped that way briefly and was found in a browser, because a Vitest
 * tree walk has no RSC boundary and every test above passed while the running page was wrong.
 *
 * These assertions are the cheapest thing that catches a recurrence: the vocabulary module must
 * stay free of `"use client"`, and no Server Component may take the vocabulary from the module that
 * has it.
 */
describe("the workflow vocabulary stays outside the client boundary", () => {
  const read = (path: string): string => readFileSync(new URL(path, import.meta.url), "utf8");

  /**
   * The **directive**, not the phrase — every one of these files discusses the boundary in prose,
   * and a substring match would fail on the explanation rather than on the defect.
   */
  const hasClientDirective = (source: string): boolean =>
    source.split("\n").some((line) => /^\s*["']use client["']\s*;?\s*$/.test(line));

  it('is a plain module — carries no "use client" directive', () => {
    expect(hasClientDirective(read("./workflow-vocabulary.ts"))).toBe(false);
  });

  it.each(["./workflow-panel.tsx", "./inquiry-views.tsx", "./formulation-views.tsx"])(
    "%s takes the vocabulary from the plain module, not from the controls",
    (path) => {
      const source = read(path);

      expect(source).not.toMatch(
        /import\s*\{[^}]*STATUS_LABEL[^}]*\}\s*from\s*"\.\/workflow-views"/,
      );
      expect(hasClientDirective(source)).toBe(false);
    },
  );

  /** The client controls may import it — a client module reading a plain module is fine. */
  it("lets the client controls import it", () => {
    expect(read("./workflow-views.tsx")).toContain('from "./workflow-vocabulary"');
  });
});

/**
 * The three shapes an ownership change takes, rendered.
 *
 * Every one names **both** ends. Phrasing the first as "Assigned to A" and the last as "Assignment
 * cleared" would be shorter and would hide half the fact: a reader could not tell a first
 * assignment from a reassignment whose previous owner was deleted, and "cleared" never says what it
 * was cleared from. Preserving ownership changes is the entire reason the table exists.
 */
describe("assignment history — all three forms", () => {
  function assignment(
    fromAssigneeEmail: string | null,
    toAssigneeEmail: string | null,
  ): LeadHistoryEntry {
    return {
      kind: "assignment",
      at: "2026-08-20T10:00:00.000Z",
      actorEmail: "admin@samgp.test",
      fromAssigneeEmail,
      toAssigneeEmail,
      note: null,
    };
  }

  function render(entry: LeadHistoryEntry): string {
    return visibleTextOf(panel({ canChangeStatus: true, history: [entry] }));
  }

  it("renders NULL -> A with Unassigned as real text", () => {
    expect(render(assignment(null, "ada@samgp.test"))).toContain(
      "Assignment changed from Unassigned to ada@samgp.test",
    );
  });

  it("renders A -> B naming both people", () => {
    expect(render(assignment("ada@samgp.test", "grace@samgp.test"))).toContain(
      "Assignment changed from ada@samgp.test to grace@samgp.test",
    );
  });

  it("renders B -> NULL, saying what it was cleared from", () => {
    expect(render(assignment("grace@samgp.test", null))).toContain(
      "Assignment changed from grace@samgp.test to Unassigned",
    );
  });

  /**
   * The state after a physical `User` deletion: the API's FK columns are NULL and the snapshots are
   * not, so the entry still names both people. This is the case the snapshot columns exist for.
   */
  it("still names both ends after the referenced accounts are deleted", () => {
    // Exactly what the API serves once the users are gone — snapshots only, no ids at all.
    const afterDeletion = assignment("ada@samgp.test", "grace@samgp.test");
    const text = render(afterDeletion);

    expect(text).toContain("Assignment changed from ada@samgp.test to grace@samgp.test");
    expect(text).toContain("admin@samgp.test");
  });

  /** A snapshot that is genuinely absent reads as "unknown", never as a blank gap. */
  it("says unknown for a missing actor snapshot rather than leaving a hole", () => {
    const text = render({ ...assignment("a@x.test", "b@x.test"), actorEmail: null });

    expect(text).toContain("unknown");
  });

  it("shows a note on an assignment entry when one exists", () => {
    const text = render({ ...assignment(null, "ada@samgp.test"), note: "Handed over at standup" });

    expect(text).toContain("Handed over at standup");
  });

  /** Ownership must be legible with no colour, no icon and no glyph anywhere in the entry. */
  it("carries the whole meaning in text", () => {
    const tree = panel({ canChangeStatus: true, history: [assignment(null, "ada@samgp.test")] });

    expect(elementsOf(tree).filter((element) => tagOf(element) === "svg")).toHaveLength(0);
    expect(elementsOf(tree).filter((element) => tagOf(element) === "img")).toHaveLength(0);
    expect(visibleTextOf(tree)).not.toMatch(/[→←↔⇒]/);
  });

  it("keeps the semantic list and the time element for assignment entries", () => {
    const tree = panel({
      canChangeStatus: true,
      history: [assignment(null, "ada@samgp.test"), assignment("ada@samgp.test", null)],
    });

    expect(findTags(tree, "ol")).toHaveLength(1);
    expect(findTags(tree, "li")).toHaveLength(2);
    expect(findTags(tree, "time").map((t) => t.props.dateTime)).toEqual([
      "2026-08-20T10:00:00.000Z",
      "2026-08-20T10:00:00.000Z",
    ]);
  });

  /**
   * One vocabulary for "no owner" across the panel: the current-assignee row and every history
   * entry use the same word, so a reader is never asked to map "none" onto "Unassigned".
   */
  it("uses the same word for an absent owner as the current-assignee row", () => {
    const text = visibleTextOf(
      panel({
        canChangeStatus: true,
        assigneeLabel: null,
        history: [assignment("a@x.test", null)],
      }),
    );

    expect(text.match(/Unassigned/g)?.length).toBeGreaterThanOrEqual(2);
  });
});
