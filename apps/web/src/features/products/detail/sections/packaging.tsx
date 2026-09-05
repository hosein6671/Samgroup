import type { ReactNode } from "react";

import { INCOTERMS, SUPPLY_FORMATS } from "../../category/data/defaults";

/**
 * "Packaging options" — item 9 of the owner's required Product Detail section order.
 *
 * Deliberately generic and shared rather than per-product: no packaging field exists on
 * `ProductDetailResponse`, and the owner's own instruction forbids inventing "unconfirmed
 * packaging" for a specific product. `SUPPLY_FORMATS`/`INCOTERMS` are the SAME company-wide,
 * already-approved vocabulary every Product Family page's own Supply section already publishes
 * (`category/data/defaults.ts` — every family fixture imports these two constants rather than
 * declaring its own) — this section reuses them rather than restating them, so a change to the
 * approved list is made once and reaches both surfaces. Which formats and terms actually apply
 * to one grade's supply remains a quotation-time confirmation, stated as such rather than
 * implied as a settled fact about this specific product.
 */
export function ProductPackaging(): ReactNode {
  return (
    <section className="fs-sec pd-packaging" id="packaging" data-surface="light">
      <div className="fs-wrap">
        <header className="pd-section-head reveal-fade-rise">
          <p className="fs-eyebrow">Packaging</p>
          <h2 className="fs-d2">Packaging and delivery terms</h2>
          <p className="fs-lead">
            Available combinations, minimum quantity and lead time are confirmed for the selected
            grade and destination when a quotation is requested.
          </p>
        </header>

        <div className="pd-packaging-grid reveal-fade-rise">
          <div>
            <p className="pd-packaging-heading">Supply formats</p>
            <ul>
              {SUPPLY_FORMATS.map((format) => (
                <li key={format}>{format}</li>
              ))}
            </ul>
          </div>
          <div>
            <p className="pd-packaging-heading">Incoterms</p>
            <ul>
              {INCOTERMS.map((term) => (
                <li key={term}>{term}</li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}
