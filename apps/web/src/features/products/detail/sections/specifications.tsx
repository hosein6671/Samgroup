import type { ReactNode } from "react";

import type { ProductSpecificationResponse } from "@sam-group/types";

/**
 * The product's published specifications — `Specification` rows, exactly as the API returns them.
 *
 * ── It renders nothing when there is nothing ────────────────────────────────
 *
 * The caller renders this only for a non-empty array, and that is the whole design. There is no
 * "specifications pending" panel, no empty table with a full axis, and no placeholder row. Every
 * product in the database has zero specifications today — the demo seed creates none, deliberately,
 * because a specification is a technical claim — so on every page that exists right now this
 * section is simply absent.
 *
 * That is a different decision from the Product FAMILY pages, and the difference is worth stating
 * because the two look contradictory side by side. A family page renders its full property axis
 * with every cell marked unpublished, because the axis itself is approved content from
 * SITE_STRUCTURE §7 — the columns are a real statement about what is measured. A product has no
 * approved axis of its own: its specifications are whatever rows exist for it, so an empty set is
 * not "an approved table awaiting values", it is no table.
 *
 * ── Rendered verbatim, and never interpreted ────────────────────────────────
 *
 * `key`, `value` and `unit` are printed as they arrive. Nothing here maps a key to a friendlier
 * label, infers a unit, sorts by a preferred property order, or groups rows — every one of those
 * would be this component asserting technical knowledge about the catalog that no approved document
 * supplies. The API already orders the rows stably (by key, then value); that order is kept.
 *
 * `key` may legitimately repeat — the schema carries no unique on (product, key), because one
 * product can publish the same property once per grade — so `id` is the React key, never `key`.
 *
 * A Server Component. A `<table>`, no JavaScript.
 */
export function ProductSpecifications({
  specifications,
}: {
  readonly specifications: readonly ProductSpecificationResponse[];
}): ReactNode {
  return (
    <section className="fs-sec pd-specs" id="specifications" data-surface="light">
      <div className="fs-wrap">
        <header className="pd-section-head reveal-fade-rise">
          <p className="fs-eyebrow">Specifications</p>
          <h2 className="fs-d2">Published values</h2>
        </header>

        <div className="pd-table-wrap reveal-fade-rise">
          <table className="pd-table">
            <caption>Specification values as published for this product.</caption>
            <thead>
              <tr>
                <th scope="col">Property</th>
                <th scope="col">Value</th>
              </tr>
            </thead>
            <tbody>
              {specifications.map((specification) => (
                <tr key={specification.id}>
                  <th scope="row">{specification.key}</th>
                  <td>
                    {specification.value}
                    {specification.unit !== null && specification.unit !== "" && (
                      <span className="pd-unit">{specification.unit}</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
