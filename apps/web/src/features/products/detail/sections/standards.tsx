import type { ReactNode } from "react";

import type { ProductDetailResponse } from "@sam-group/types";

const GRADE_SYSTEM_LABEL: Record<string, string> = {
  sae: "SAE",
  iso_vg: "ISO VG",
  nlgi: "NLGI",
};

/**
 * "Standards and classifications" — item 6 of the owner's required Product Detail section
 * order. Built entirely from fields already on the wire: the product's Product Type name and
 * the set of generic grade-classification systems (`SAE`/`ISO VG`/`NLGI`) its own Grades use.
 * Nothing here is a new fact or a new field — it is a small, separately-labelled surfacing of
 * data the identity block and the technical-data table already carry individually, so a reader
 * scanning specifically for "what standard does this meet" has one place to look rather than
 * having to read every specification row.
 *
 * Renders nothing when a product has neither — most products today, including both new Base Oil
 * catalog records (`productType: null`, and Solvent Neutral / Bright Stock grades use no SAE/
 * ISO VG/NLGI system) — matching the owner's instruction not to force an empty section.
 */
export function ProductStandards({
  product,
}: {
  readonly product: ProductDetailResponse;
}): ReactNode {
  const gradeSystems = [
    ...new Set(
      product.grades
        .map((grade) => grade.gradeSystem)
        .filter((system): system is NonNullable<typeof system> => system !== null),
    ),
  ];

  if (product.productType === null && gradeSystems.length === 0) return null;

  return (
    <section className="fs-sec pd-standards" id="standards" data-surface="light">
      <div className="fs-wrap">
        <header className="pd-section-head reveal-fade-rise">
          <p className="fs-eyebrow">Standards and classifications</p>
          <h2 className="fs-d2">General technical classification</h2>
        </header>

        <dl className="pd-standards-list reveal-fade-rise">
          {product.productType !== null && (
            <div>
              <dt>Product type</dt>
              <dd>{product.productType.name}</dd>
            </div>
          )}
          {gradeSystems.length > 0 && (
            <div>
              <dt>{gradeSystems.length === 1 ? "Grade system" : "Grade systems"}</dt>
              <dd>
                {gradeSystems.map((system) => GRADE_SYSTEM_LABEL[system] ?? system).join(", ")}
              </dd>
            </div>
          )}
        </dl>
      </div>
    </section>
  );
}
