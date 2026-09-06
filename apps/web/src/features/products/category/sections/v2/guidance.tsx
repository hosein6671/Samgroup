import { VisuallyHidden } from "@sam-group/ui";
import type { ReactNode } from "react";

import type { SectionProps } from "../../category-section";

/**
 * v2 · Block 3 (part 1) — compact selection guidance: Overview + Classification.
 *
 * Sits in the rail shell, beside the sticky rail. The specification axis and its conditional
 * typical-properties table follow immediately below the shell, rendered by the unchanged
 * `CategoryProperties` section so its populated-table behaviour and its `id="specifications"`
 * are preserved exactly.
 *
 * ── Content is preserved, not trimmed ─────────────────────────────────────
 *
 *  - Overview heading + every paragraph — shown, verbatim, under `id="overview"`.
 *  - Range heading + intro + classification axes — shown, verbatim.
 *  - Every sub-range: designation, its place in the classification (`qualifier`) and its grade
 *    designations — shown in a scannable table, one row per group, each row carrying
 *    `id="range-<sub-range id>"` so links and bookmarks that predate the redesign still land.
 *  - Each sub-range's prose summary — the longest supporting material — sits in a native
 *    `<details>`/`<summary>` in the list beneath the table, open to a keyboard and to in-page
 *    find, so the seven descriptions do not push the scannable table down the page.
 *
 * The family quick-facts (`overview.markers`) are NOT rendered here — the sticky rail owns them,
 * so the same four are not printed twice.
 *
 * ── One new framing line ──────────────────────────────────────────────────
 *
 * "Classification, not availability" — states that the table below is the classification system,
 * not the catalogue (which is the block directly above). It makes no product claim. Flagged in
 * the gate report as new copy.
 *
 * A Server Component. No `reveal-*` class — legible at rest.
 */
export function Guidance({ content }: SectionProps): ReactNode {
  const { overview, range } = content;

  return (
    <section className="fs-sec pcv2-guide" data-surface="light">
      <div className="fs-wrap pcv2-guide-inner">
        <div className="pcv2-guide-overview" id="overview">
          <p className="fs-eyebrow">Overview</p>
          <h2 className="fs-d3">{overview.heading}</h2>

          {overview.body.map((paragraph) => (
            <p className="fs-lead pcv2-guide-para" key={paragraph.slice(0, 32)}>
              {paragraph}
            </p>
          ))}
        </div>

        <div className="pcv2-guide-range" id="classification">
          <p className="fs-eyebrow">How the range is organised</p>
          <h2 className="fs-d3">{range.heading}</h2>
          <p className="fs-lead pcv2-guide-para">{range.intro}</p>
          <p className="pcv2-guide-frame">
            Classification, not availability — the groups below are the classification system; the
            products currently in the catalogue are listed above.
          </p>

          {range.classificationAxes && range.classificationAxes.length > 0 && (
            <p className="pcv2-axes">
              <span className="pcv2-axes-label">Classified on</span>
              {range.classificationAxes.join(" · ")}
              <span className="pcv2-axes-note">
                {" "}
                — axes only; boundary values belong to the standard, grade values to the data sheet.
              </span>
            </p>
          )}

          <div className="pcv2-cls-frame">
            <table className="pcv2-cls-table">
              <caption>
                <VisuallyHidden>
                  Base-oil classification groups, their place in the API base-stock classification,
                  and the grade designations published for each.
                </VisuallyHidden>
              </caption>
              <thead>
                <tr>
                  <th scope="col">Group</th>
                  <th scope="col">Classification</th>
                  <th scope="col">Published grades</th>
                </tr>
              </thead>
              <tbody>
                {range.subRanges.map((subRange) => (
                  <tr id={`range-${subRange.id}`} key={subRange.id}>
                    <th scope="row">{subRange.designation}</th>
                    {/* `data-label` drives the ::before caption when the table becomes a card
                        stack on narrow screens (category-v2.css). */}
                    <td data-label="Classification">{subRange.qualifier ?? "—"}</td>
                    <td data-label="Published grades">
                      {subRange.grades.length > 0
                        ? subRange.grades.map((grade) => grade.designation).join(" · ")
                        : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="pcv2-cls-desc">
            <p className="pcv2-cls-desc-label">Group descriptions</p>
            {range.subRanges.map((subRange) => (
              <details className="pcv2-cls-desc-item" key={subRange.id}>
                <summary>{subRange.designation}</summary>
                <p>{subRange.summary}</p>
              </details>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
