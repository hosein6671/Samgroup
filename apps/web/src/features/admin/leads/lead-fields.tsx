import { formatSubmittedAt } from "./lead-vocabulary";

import type { ReactNode } from "react";

/**
 * The detail view's building blocks — a labelled group, a labelled row, and the timestamp element
 * both the list and the detail render.
 *
 * ── Grouping is the whole of the design here ───────────────────────────────
 *
 * A submission is twenty fields, and twenty fields in one list is a wall. They are grouped by what
 * an operator is doing when they read them: who submitted it, how to reach them, what they asked
 * for, and what consent was recorded. Each group is a `<section>` with a real `<h2>`, so the
 * structure a sighted reader gets from the spacing is the same structure a screen-reader user gets
 * from the heading list — and a heading-by-heading scan of the page describes the record.
 *
 * ── An omitted field is shown as omitted, never as blank ───────────────────
 *
 * A missing optional value renders "Not provided" rather than an empty cell. On a lead the
 * difference matters: a blank next to "Phone" reads as a rendering bug, and an operator cannot tell
 * whether the submitter left it out or the page failed to show it. The state is carried by the word
 * as well as by the muted colour, so it survives without colour (WCAG 2.2 §1.4.1).
 */

export function DetailGroup({
  title,
  children,
}: {
  readonly title: string;
  readonly children: ReactNode;
}): ReactNode {
  return (
    <section className="ad-group" aria-labelledby={groupId(title)}>
      <h2 className="ad-group-title" id={groupId(title)}>
        {title}
      </h2>
      <dl className="ad-fields">{children}</dl>
    </section>
  );
}

/** A stable id from the group's own words — the sections are fixed and their titles are unique. */
function groupId(title: string): string {
  return `ad-group-${title.toLowerCase().replaceAll(/[^a-z0-9]+/g, "-")}`;
}

/**
 * One field. `<dt>`/`<dd>` rather than a two-column table: this is a set of name/value pairs about
 * one record, which is exactly what a description list is, and it reflows to one column on a narrow
 * screen without any layout work. The pairing is programmatic, so the label is announced with the
 * value rather than being a nearby piece of text.
 */
export function DetailField({
  label,
  value,
}: {
  readonly label: string;
  readonly value: string | null;
}): ReactNode {
  const absent = value === null || value === "";

  return (
    <div className="ad-field-row">
      <dt className="ad-field-label">{label}</dt>
      <dd className={absent ? "ad-field-value ad-field-value--absent" : "ad-field-value"}>
        {absent ? "Not provided" : value}
      </dd>
    </div>
  );
}

/** A field whose value is a paragraph the submitter wrote, so it keeps its own line breaks. */
export function DetailTextField({
  label,
  value,
}: {
  readonly label: string;
  readonly value: string | null;
}): ReactNode {
  const absent = value === null || value === "";

  return (
    <div className="ad-field-row">
      <dt className="ad-field-label">{label}</dt>
      <dd
        className={
          absent ? "ad-field-value ad-field-value--absent" : "ad-field-value ad-field-value--prose"
        }
      >
        {absent ? "Not provided" : value}
      </dd>
    </div>
  );
}

/** A field whose value is an instant, rendered as a real `<time>`. */
export function DetailTimeField({
  label,
  iso,
}: {
  readonly label: string;
  readonly iso: string;
}): ReactNode {
  return (
    <div className="ad-field-row">
      <dt className="ad-field-label">{label}</dt>
      <dd className="ad-field-value">
        <SubmittedAt iso={iso} />
      </dd>
    </div>
  );
}

/**
 * A submission timestamp.
 *
 * `<time dateTime>` carries the machine-readable instant alongside the human text, which is what
 * the element is for: the visible string is a UTC stamp chosen for determinism, and `dateTime`
 * keeps the unambiguous ISO value available to anything that wants to parse or reformat it.
 *
 * The visible text is not replaced by a relative phrase ("2 hours ago"). An operational record's
 * time is a fact to be read off, and a relative form is both less precise and unstable between two
 * renders of the same page.
 */
export function SubmittedAt({ iso }: { readonly iso: string }): ReactNode {
  return <time dateTime={iso}>{formatSubmittedAt(iso)}</time>;
}
