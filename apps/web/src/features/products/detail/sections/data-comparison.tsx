import type { ReactNode } from "react";

import { TechnicalDataPendingIcon } from "@/features/site/icons";
import { translator } from "@/i18n/translate";

import { gradeSlug } from "../grade-selection";
import { propertyLabel } from "../property-labels";

import type { SpecMatrix } from "../spec-matrix";

/**
 * Every published value, one column per grade (redesign, 28 October 2026).
 *
 * The column of the grade being viewed is highlighted, and each column heading is a link that
 * selects that grade for the whole page. Only property, values and method are shown: the basis
 * and condition columns of the old table were empty on almost every row; a condition, where one
 * exists, is part of the property's own label instead. The table scrolls inside its own box on a
 * narrow screen, never the page.
 */
export function ProductDataComparison({
  matrix,
  locale,
  activeColumn,
  canonicalPath,
}: {
  readonly matrix: SpecMatrix;
  readonly locale: string;
  readonly activeColumn: string | null;
  readonly canonicalPath: string;
}): ReactNode {
  const t = translator(locale);
  const graded = !(matrix.columns.length === 1 && matrix.columns[0] === "");

  return (
    <section className="fs-sec pd2-data" id="data" data-surface="light">
      <div className="fs-wrap">
        <header className="pd2-head">
          <div>
            <p className="fs-eyebrow">{t("Grades & published data")}</p>
            <h2 className="pd2-h2">
              {graded && matrix.columns.length > 1
                ? t("All grades side by side")
                : t("Published values")}
            </h2>
          </div>
          <p className="pd2-head-note">
            {t("Typical values from the product data sheet, each with its test method.")}
          </p>
        </header>

        {matrix.rows.length === 0 ? (
          <p className="pd-specs-pending">
            <TechnicalDataPendingIcon size="lg" />
            {t("Technical data is under review.")}
          </p>
        ) : (
          <div
            className="pd2-table-box"
            tabIndex={0}
            role="region"
            aria-label={t("Published values")}
          >
            <table className="pd2-table">
              <thead>
                <tr>
                  <th scope="col">{t("Property")}</th>
                  {matrix.columns.map((column) => (
                    <th
                      key={column}
                      scope="col"
                      data-active={column === activeColumn && graded ? "true" : undefined}
                      dir="ltr"
                    >
                      {graded && matrix.columns.length > 1 ? (
                        <a
                          href={`${canonicalPath}?grade=${gradeSlug(column)}#data`}
                          aria-current={column === activeColumn ? "true" : undefined}
                        >
                          {column}
                        </a>
                      ) : column === "" ? (
                        t("Value")
                      ) : (
                        column
                      )}
                    </th>
                  ))}
                  <th scope="col">{t("Method")}</th>
                </tr>
              </thead>
              <tbody>
                {matrix.rows.map((row) => (
                  <tr key={row.id}>
                    <th scope="row">
                      {propertyLabel(row.key, t)}
                      {row.qualifier !== null && row.qualifier !== "" && (
                        <span className="pd2-qualifier">{t(row.qualifier)}</span>
                      )}
                      {row.unit !== null && (
                        <span className="pd2-unit" dir="ltr">
                          {row.unit}
                        </span>
                      )}
                    </th>
                    {matrix.columns.map((column) => (
                      <td
                        key={column}
                        dir="ltr"
                        data-active={column === activeColumn && graded ? "true" : undefined}
                      >
                        {row.cells.get(column) ?? "—"}
                      </td>
                    ))}
                    <td className="pd2-method" dir="ltr">
                      {row.method ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}
