import { VisuallyHidden } from "@sam-group/ui";
import type { ReactNode } from "react";

import { groupSubRanges, hasClassificationDetail } from "../../category-contract";
import type { SectionProps } from "../../category-section";

/**
 * v2 · Block 3 (part 1) — compact selection guidance: Overview + the range.
 *
 * Sits in the rail shell, beside the sticky rail. The specification axis and its conditional
 * typical-properties table follow immediately below the shell, rendered by the unchanged
 * `CategoryProperties` section so its populated-table behaviour and its `id="specifications"`
 * are preserved exactly.
 *
 * ── Two shapes, chosen by the family's own content ────────────────────────
 *
 * `hasClassificationDetail` decides:
 *
 * - **Table** — the family names a formal classification, or a place in one, or individual
 *   grades. Base Oils: API groups, SN / BS designations, PAO / Ester / PAG. One row per group
 *   (`Group · Classification · Published grades`), and the prose descriptions in a native
 *   `<details>` list beneath it so seven of them do not push the table down the page. On a phone
 *   the table becomes a card per group (`category-v2.css`).
 * - **List** — the family's range is a set of duties with a sentence each and nothing to
 *   tabulate. Engine Oils: six vehicle segments, no grades, no classification. Industrial Oils:
 *   nine plant-system duties, split Fluids / Greases on their own `axis`. Each entry is a row
 *   with its heading and summary; where the fixture sets an `axis` the rows group under it
 *   (`groupSubRanges`), with the ordinal running continuously across the groups so it and the
 *   `#range-<id>` anchors match the range register one level up. There is no second or third
 *   column to leave empty.
 *
 * ── Content is preserved, not trimmed ─────────────────────────────────────
 *
 *  - Overview heading + every paragraph — verbatim, under `id="overview"`.
 *  - Range heading + intro + classification axes (where the family names them) — verbatim.
 *  - Every sub-range: designation, its `qualifier` and grades where present, and its full prose
 *    summary. Each carries `id="range-<sub-range id>"` so links and bookmarks that predate the
 *    redesign still land.
 *  - The range block answers to **both** `#classification` (the v2 id, and the rail's target) and
 *    the legacy `#range` (the v1 range section's id) — the second via an empty anchor span, no
 *    duplicate id.
 *
 * The family quick-facts (`overview.markers`) are NOT rendered here — the sticky rail owns them,
 * so the same set is not printed twice.
 *
 * ── The framing line ─────────────────────────────────────────────────────
 *
 * New copy on this component: it states that the block below is how the range is organised, not
 * the catalogue (which is the block directly above). It makes no product claim. The table
 * variant keeps Base Oils' committed wording; the list variant uses a family-neutral line.
 *
 * A Server Component. No `reveal-*` class — legible at rest.
 */
export function Guidance({ content }: SectionProps): ReactNode {
  const { overview, range } = content;
  const asTable = hasClassificationDetail(content);

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
          {/*
           * The v1 range section carried `id="range"`; this v2 block is `id="classification"`.
           * Links and bookmarks that predate the redesign use `#range`, so it must land here too.
           * An empty, non-focusable span holds the legacy id at the very top of this block — same
           * position as `id="classification"` on the wrapper, so both fragments scroll to exactly
           * the same place. No duplicate id, no second visible element, no box, no layout change.
           * `.pcv2-guide-range` is plain block flow, so an empty inline child contributes nothing.
           */}
          <span id="range" aria-hidden="true" />
          <p className="fs-eyebrow">How the range is organised</p>
          <h2 className="fs-d3">{range.heading}</h2>
          <p className="fs-lead pcv2-guide-para">{range.intro}</p>
          <p className="pcv2-guide-frame">
            {asTable
              ? "Classification, not availability — the groups below are the classification system; the products currently in the catalogue are listed above."
              : "This is how the range is organised. The products currently held in the catalogue are listed above."}
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

          {asTable ? (
            <>
              <div className="pcv2-cls-frame">
                <table className="pcv2-cls-table">
                  <caption>
                    <VisuallyHidden>
                      Base-oil classification groups, their place in the API base-stock
                      classification, and the grade designations published for each.
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
            </>
          ) : (
            <div className="pcv2-seg-groups">
              {groupSubRanges(range).map((group) => (
                <div className="pcv2-seg-group" key={group.axis ?? "ungrouped"}>
                  {group.axis && (
                    <p className="pcv2-seg-axis">
                      <span>{group.axis}</span>
                      <span>{String(group.subRanges.length).padStart(2, "0")}</span>
                    </p>
                  )}

                  <ol className="pcv2-seg-list" start={group.offset + 1}>
                    {group.subRanges.map((subRange, i) => (
                      <li className="pcv2-seg-item" id={`range-${subRange.id}`} key={subRange.id}>
                        <p className="pcv2-seg-idx">
                          {String(group.offset + i + 1).padStart(2, "0")}
                        </p>
                        <div>
                          <h3 className="pcv2-seg-name">{subRange.designation}</h3>
                          <p className="pcv2-seg-summary">{subRange.summary}</p>
                        </div>
                      </li>
                    ))}
                  </ol>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
