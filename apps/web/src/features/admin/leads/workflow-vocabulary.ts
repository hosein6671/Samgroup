import type { LeadStatus } from "@sam-group/types";

/**
 * The workflow vocabulary shared by the server-rendered panel and the client-rendered controls.
 *
 * ## Why this is its own module, and it is not a preference
 *
 * These values were briefly declared in `workflow-views.tsx`, which carries `"use client"`. A
 * Server Component importing a **value** from a client module does not receive the value: React
 * gives it a client-reference proxy, so `"closed" in STATUS_LABEL` is `false` and every label
 * silently falls back to the raw stored string. The page still rendered — it just showed
 * `in_progress` where it should have shown "In progress", on the detail panel, the history and both
 * list tables.
 *
 * Nothing catches that in this repository's test setup: a Vitest tree walk has no RSC boundary, so
 * the unit tests passed while the running page was wrong. It was found in a browser. Keeping the
 * vocabulary in a plain module — imported by the server panel and the client controls alike — is
 * what makes it a real object on both sides.
 *
 * ## It mirrors the API, and is not the authority
 *
 * `TRANSITIONS` is the same graph `apps/api`'s `workflow/lead-status.ts` enforces. It exists here
 * so a `<select>` does not offer a move that will be refused; **the server validates every
 * transition independently**, and if the two ever disagree the API wins and the operator sees a
 * refusal rather than a silent success.
 */

/** The visible label for each status. Text, never a colour or an icon — WCAG 2.2 §1.4.1. */
export const STATUS_LABEL: Readonly<Record<LeadStatus, string>> = {
  new: "New",
  in_progress: "In progress",
  closed: "Closed",
};

/** The transitions offered from a given state — a courtesy, not a rule. See the note above. */
export const TRANSITIONS: Readonly<Record<LeadStatus, readonly LeadStatus[]>> = {
  new: ["in_progress", "closed"],
  in_progress: ["closed"],
  closed: ["in_progress"],
};

/** A stored status rendered for a person. An unexpected value is shown as stored, never hidden. */
export function statusLabel(status: string): string {
  return status in STATUS_LABEL ? STATUS_LABEL[status as LeadStatus] : status;
}
