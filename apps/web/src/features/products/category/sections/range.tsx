import type { ReactNode } from "react";

import { groupSubRanges } from "../category-contract";
import type { SectionProps } from "../category-section";

/**
 * 3 · Product range — SITE_STRUCTURE §4 item 3.
 *
 * ── A flagged deviation from the letter of the spec ─────────────────────────
 *
 * §4 item 3 says the sub-categories and grades are "rendered as accordion or filterable table".
 * This renders them expanded, as a register. Three reasons, and it is flagged rather than
 * assumed:
 *
 * 1. The taxonomy *is* the substance of the page. Collapsing seven sub-ranges behind seven
 *    summary rows hides every designation a buyer is scanning for — "Group III", "BS 150",
 *    "PAO" — behind a click each.
 * 2. A filterable table needs catalogue data to filter, and filtering the range is the Product
 *    Finder's job on its own route. A second, worse finder embedded here would duplicate it.
 * 3. The frozen Products landing already answered the same question the same way, rejecting a
 *    card grid for a full-measure register. Two adjacent pages in the same family should not
 *    disagree about how a taxonomy is presented.
 *
 * The register is one level deeper than the landing's: sub-range, then the grade designations
 * inside it on their own rail. Where a sub-range publishes no individual grades, the rail is
 * absent rather than filled — four of Base Oils' seven are in that state, and that is the
 * accurate rendering of what the source document names.
 *
 * ── Why the rail sits under the content and not beside it ───────────────────
 *
 * It used to be a third column. That made the row's structure depend on data most categories do
 * not have: with four of seven Base Oils rows publishing no grades, the third column was empty
 * more often than not, and on the categories whose frozen taxonomy names no individual grades at
 * all — Industrial Oils, Antifreeze & Coolants — every row would have carried an empty column.
 * A layout that only resolves for one category is not a template.
 *
 * Under the content, the row is index + body at every width and for every category. A sub-range
 * with grades gains a labelled rail beneath its summary; one without simply ends there, with no
 * gap and no empty track to explain. That is why the rail carries its own "Published grades"
 * label: the block announces itself when it is present, so its absence reads as absence rather
 * than as something that failed to render.
 *
 * ── The classification strip renders only where a classification exists ────
 *
 * For Base Oils it names the three axes the API 1509 group system discriminates on, without
 * their thresholds — the boundaries are public, but a numeric limit printed on a product page
 * reads as a specification of the product rather than of the standard.
 *
 * No approved document gives Antifreeze & Coolants an equivalent formal system, so that fixture
 * omits `classificationAxes` and the strip does not render at all. Filling it with three
 * plausible criteria to keep the layout symmetrical would be inventing a standard, which is a
 * worse failure than an absent strip.
 *
 * ── Dimensions ──────────────────────────────────────────────────────────────
 *
 * Where a category is organised by more than one dimension the register groups under them, with
 * numbering running continuously across the groups so the index in the hero and the register
 * still address the same sub-range by the same number. A single-hierarchy category comes back
 * from `groupSubRanges` as one unlabelled group and renders as the flat register it always was.
 *
 * A Server Component. Every entry is static and the reveal is the design system's scroll-driven
 * CSS. No JavaScript.
 */
export function CategoryRangeSection({ content }: SectionProps): ReactNode {
  const { range } = content;
  const groups = groupSubRanges(range);

  return (
    <section className="fs-sec pc-range" id="range" data-surface="light">
      <div className="fs-blueprint fs-blueprint--light" aria-hidden="true" />

      <div className="fs-wrap">
        <header className="pc-range-head reveal-fade-rise">
          <div>
            <p className="fs-eyebrow">Product range</p>
            <h2 className="fs-d2">{range.heading}</h2>
          </div>
          <p className="fs-lead">{range.intro}</p>
        </header>

        {range.classificationAxes && range.classificationAxes.length > 0 && (
          <div className="pc-axes reveal-fade-rise">
            <p className="pc-axes-label">Classified on</p>
            <ul className="pc-axes-list">
              {range.classificationAxes.map((axis) => (
                <li key={axis}>{axis}</li>
              ))}
            </ul>
            <p className="pc-axes-note">
              Axes only — the boundary values belong to the standard, and the values for a given
              grade belong to its data sheet.
            </p>
          </div>
        )}

        <div className="pc-subranges">
          {groups.map((group) => (
            <div className="pc-sub-group" key={group.axis ?? "ungrouped"}>
              {group.axis && (
                <p className="pc-sub-axis reveal-fade-rise">
                  <span>{group.axis}</span>
                  <span>{String(group.subRanges.length).padStart(2, "0")}</span>
                </p>
              )}

              <div className="reveal-stagger">
                {group.subRanges.map((subRange, i) => (
                  <article className="pc-sub" id={`range-${subRange.id}`} key={subRange.id}>
                    {/* Continuous across groups, so this number and the hero index agree. */}
                    <p className="pc-sub-index">{String(group.offset + i + 1).padStart(2, "0")}</p>

                    <div className="pc-sub-body">
                      <h3 className="pc-sub-title">{subRange.designation}</h3>
                      {/* Absent everywhere today: it carried classification wording no approved
                          document supports. See `SubRange.qualifier`. */}
                      {subRange.qualifier && (
                        <p className="pc-sub-qualifier">{subRange.qualifier}</p>
                      )}
                      <p className="pc-sub-summary">{subRange.summary}</p>

                      {/*
                        The grade rail. Present only where the frozen taxonomy names grades — an
                        absent rail is information, and a placeholder mark in its place would not
                        be. The label is what makes the absence read as deliberate: a labelled
                        block that is there or is not, rather than a column that is sometimes
                        empty. Antifreeze & Coolants names no grades at all, so no rail renders on
                        any of its eight sub-ranges and nothing about the row looks unfinished.
                      */}
                      {subRange.grades.length > 0 && (
                        <div className="pc-grade-block">
                          <p className="pc-grade-label">
                            Published grades
                            <span>{String(subRange.grades.length).padStart(2, "0")}</span>
                          </p>

                          <ul className="pc-grades">
                            {subRange.grades.map((grade) => (
                              <li className="pc-grade" key={grade.id}>
                                <b>{grade.designation}</b>
                                {grade.note && <small>{grade.note}</small>}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  </article>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
