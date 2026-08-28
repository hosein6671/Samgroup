import { VisuallyHidden } from "@sam-group/ui";
import type { ReactNode } from "react";

import { propertyGroups } from "../category-contract";
import type { SectionProps } from "../category-section";

/**
 * 4 · Key specifications — SITE_STRUCTURE §4 item 4.
 *
 * ── Why every value cell is empty ───────────────────────────────────────────
 *
 * §4 item 4 specifies this table — "grade × viscosity/VI/flash point/pour point/colour, test
 * methods cited" — and marks it `[ESTIMATE — CONFIRM]`, "replace with real lab data". CLAUDE.md
 * §4 forbids seeding a marker like that into a page, and a plausible-looking viscosity printed
 * against a real grade name is the most damaging kind of invented content this project could
 * publish: a buyer would specify against it.
 *
 * So the table ships with its axis complete and its values withheld. That is not a placeholder
 * standing in for the finished section — it is the finished section, in its current true state.
 * When lab data is approved it goes into the fixture's `values` map and this component renders
 * it unchanged.
 *
 * ── How the unpublished state is drawn, and why it changed ──────────────────
 *
 * The first version printed an em dash in every cell. Seventy-two em dashes do not read as a
 * blank specification sheet; they read as data that failed to load, and on a phone — where only
 * one property column is visible at a time — that was the whole section.
 *
 * Three things fix it, none of which publishes a value:
 *
 * 1. **A second real column, where the category has one to give.** A category organised by more
 *    than one dimension states each row's dimension before the first property column — derived
 *    from `SubRange.axis`, never authored here. A single-hierarchy category has no dimension, so
 *    it supplies no `groupingHeading` and the column does not render rather than being filled.
 * 2. **A pending mark rather than a character.** The cell draws a short hairline rule in
 *    `category.css`; `VisuallyHidden` carries "Not published" so the state is announced rather
 *    than left as an empty cell. A rule reads as a field waiting to be filled; a dash reads as a
 *    value that is missing.
 * 3. **The condition is stated once.** The fixture's `intro` describes the axis, `pendingNote`
 *    states the pending condition, and nothing repeats it a third time.
 *
 * ── Construction ────────────────────────────────────────────────────────────
 *
 * A real `<table>`: rows are the category's members, columns are properties. The note about where
 * the values actually live is a paragraph above the scroll container, tied to the table by
 * `aria-describedby` — see the comment at its call site for why it is not the `<caption>`.
 *
 * Rows are derived from the range by `catalogueRows`, never listed again here — the
 * specification table and the range register cannot address different members.
 *
 * ── Every visible word comes from the contract ──────────────────────────────
 *
 * "Grade", "Classification", "Sub-range" and "Typical properties, by grade" were hardcoded here.
 * They are Base Oils' vocabulary — the category this component was first written against — and
 * they were wrong for the two built after it, both of which publish no grades at all. They now
 * come from `properties.labels`, so a shared template names no single category's terms.
 *
 * ── One axis, or several ────────────────────────────────────────────────────
 *
 * The section renders one block per property group. A category with a single axis has one group,
 * no label, and renders as it did when the contract held a single `columns` array.
 *
 * Industrial Oils & Lubricants has two, and it is the reason the plural exists: its fluids and its
 * greases are not described by the same measurements. Forcing them into one table would have put
 * blanks meaning *not applicable* in the same grid, drawn the same way, as blanks meaning *pending
 * lab data*. On a specification sheet those two must never look alike. Two tables, two axes, each
 * row appearing exactly once.
 */
export function CategoryProperties({ content }: SectionProps): ReactNode {
  const { properties } = content;
  const { labels } = properties;
  const groups = propertyGroups(content);
  const plural = groups.length > 1;

  /*
   * The second column renders only where the category supplies a heading for it *and* its rows
   * carry a dimension. A single-hierarchy category has no dimension to state, so it gets one
   * populated column rather than a column of filler.
   */
  const showGrouping =
    labels.groupingHeading !== undefined && groups.some(({ rows }) => rows.some((r) => r.axis));

  return (
    <section className="fs-sec pc-props" id="specifications" data-surface="midnight">
      <div className="fs-blueprint" aria-hidden="true" />

      <div className="fs-wrap">
        <header className="pc-props-head reveal-fade-rise">
          <div>
            <p className="fs-eyebrow">Key specifications</p>
            <h2 className="fs-d2">{properties.heading}</h2>
          </div>
          <p className="fs-lead">{properties.intro}</p>
        </header>

        {/*
          The note sits outside the scroll container, not in the `<caption>`.

          A caption is a child of the table, so it takes the table's width — and at 390px that put
          the sentence explaining the pending marks behind the same horizontal scroll as the marks
          themselves. Outside, it wraps to the measure and is read before the tables;
          `aria-describedby` keeps it attached for a screen reader, and each caption keeps its job
          of naming its own table. Stated once for the section however many axes it holds.
        */}
        <p className="pc-table-note reveal-fade-rise" id="pc-props-pending">
          {properties.pendingNote}
        </p>

        {groups.map(({ group, rows }) => (
          <div className="pc-props-group" key={group.id}>
            {plural && (
              <div className="pc-props-group-head reveal-fade-rise">
                <p className="pc-props-group-label">
                  {group.label}
                  <span>{String(rows.length).padStart(2, "0")}</span>
                </p>
                {group.note && <p className="pc-props-group-note">{group.note}</p>}
              </div>
            )}

            {/*
              The property axis, stated before the table rather than only as its header row. This
              is the part of the section that has content today, so it leads; the grid beneath is
              the shape those values will occupy.
            */}
            <ol className="pc-axis reveal-stagger">
              {group.columns.map((column, i) => (
                <li className="pc-axis-item" key={column.key}>
                  <span className="pc-axis-num">{String(i + 1).padStart(2, "0")}</span>
                  <span className="pc-axis-name">
                    {column.label}
                    {column.unit && <em>{column.unit}</em>}
                    {column.guidance && <small>{column.guidance}</small>}
                  </span>
                  {/* Only where an approved method exists. None does yet — see the note below. */}
                  {column.method && (
                    <span className="pc-axis-method">
                      {column.method}
                      {column.condition && <small>{column.condition}</small>}
                    </span>
                  )}
                </li>
              ))}
            </ol>

            {/*
              One line per axis, in place of a plausible standard designation per column.

              The earlier revision printed ASTM numbers here. No project document names a test
              standard anywhere, so those were unapproved technical content on a product page —
              removed rather than replaced.
            */}
            {group.columns.every((column) => column.method === undefined) && (
              <p className="pc-method-note">{properties.methodNote}</p>
            )}

            {/*
              The scroll frame. The fade and the cue sit on the frame, not inside the scroller, or
              they would travel away with the content the moment they were needed.
            */}
            {Object.keys(group.values).length > 0 ? (
              <div className="pc-table-frame reveal-mask-wipe">
                <p className="pc-scroll-cue" aria-hidden="true">
                  scroll <span>&rarr;</span>
                </p>

                <div className="pc-table-scroll">
                  <table className="pc-table" aria-describedby="pc-props-pending">
                    <caption>
                      {plural ? `${group.label} — typical properties` : labels.caption}
                    </caption>

                    <thead>
                      <tr>
                        <th scope="col">
                          <span className="pc-th-name">{labels.rowHeading}</span>
                          <span className="pc-th-method">{labels.rowSubHeading}</span>
                        </th>
                        {showGrouping && (
                          <th scope="col">
                            <span className="pc-th-name">{labels.groupingHeading}</span>
                            {labels.groupingSubHeading && (
                              <span className="pc-th-method">{labels.groupingSubHeading}</span>
                            )}
                          </th>
                        )}
                        {group.columns.map((column) => (
                          <th scope="col" key={column.key}>
                            <span className="pc-th-name">
                              {column.label}
                              {column.unit && <em>{column.unit}</em>}
                            </span>
                            {column.method && <span className="pc-th-method">{column.method}</span>}
                          </th>
                        ))}
                      </tr>
                    </thead>

                    <tbody>
                      {rows.map((row) => (
                        <tr key={row.id}>
                          <th scope="row">
                            <span className="pc-row-label">{row.label}</span>
                            {/* A row standing for a whole sub-range says so, in the category's word. */}
                            <span className="pc-row-scope">
                              {row.isRange ? labels.rangeRowLabel : row.subRange}
                            </span>
                          </th>

                          {/* Derived from the range's own dimension, never authored here. */}
                          {showGrouping && <td className="pc-cell-class">{row.axis}</td>}

                          {group.columns.map((column) => {
                            const value = group.values[row.id]?.[column.key];

                            /*
                             * A rule, not a dash. The mark is drawn in CSS on `[data-pending]`; the
                             * cell's only text is the announcement, so a screen reader hears the
                             * state instead of meeting an empty cell.
                             */
                            if (value === undefined) {
                              return (
                                <td key={column.key} data-pending="true">
                                  <VisuallyHidden>Not published</VisuallyHidden>
                                </td>
                              );
                            }

                            return <td key={column.key}>{value}</td>;
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <span className="pc-table-fade" aria-hidden="true" />
              </div>
            ) : (
              <div className="pc-data-route reveal-fade-rise" role="note">
                <p className="fs-eyebrow">How values are confirmed</p>
                <p>
                  Use the property set above to define the enquiry. Exact typical values and test
                  methods are issued in the reviewed TDS for the selected grade; the supplied batch
                  is then identified against its COA.
                </p>
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
