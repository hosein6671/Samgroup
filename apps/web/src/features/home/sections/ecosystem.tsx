"use client";

import { useState, type ReactNode } from "react";

import { Arrow } from "@/features/site/logo-mark";
import { localeHref, productFamilyByKey } from "@/features/site/site-routes";

import { FAMILIES } from "../home-data";
import { OrbitVisual } from "../visuals/orbit-visual";

/**
 * 4 · Product Portfolio Overview — the workbook's "Our Products".
 *
 * ── What changed, and what deliberately did not ─────────────────────────────────────────────
 *
 * The construction is the approved homepage version and is untouched: the orbital canvas, the
 * detail panel, the tab strip, the spacing and the background all stand exactly as they were. The
 * owner asked for an information-architecture alignment, not a visual downgrade, and this section's
 * visual is the page's signature.
 *
 * What changed is what it is about. It presented **five invented "product routes"** — Lubricants,
 * Petroleum Products, Industrial Fluids, Automotive Solutions, Specialty — which exist nowhere in
 * the catalogue, in the workbook, or in `PRODUCT_CATEGORIES`. It now presents **the six real
 * product families**, which is what the workbook's Products sheet names and what every other
 * surface on the platform already routes to. Each family's detail panel carries its own action,
 * which is the sheet's "Explore Products on each Card" requirement met without a card grid
 * replacing a working visual.
 *
 * ── A quieter defect went with it ───────────────────────────────────────────────────────────
 *
 * Each old route published a `["Standards", "API SP · ACEA C3"]` row. `home-data.ts` forbids
 * naming a standard or approval anywhere in this file, and the certification marquee was removed
 * for exactly that reason — these rows were the same claim in a smaller typeface. The replacement
 * `specs` describe how a family is supplied and what an enquiry needs, and name no standard.
 *
 * ── The mapping is data, not a lookup table ─────────────────────────────────────────────────
 *
 * There was a `CATEGORY_BY_BRANCH` record here translating invented route ids to family keys, with
 * two routes pointing at the same category and one at a family it was not about. Each family now
 * carries its own `key`, so the address comes from the record itself and cannot drift.
 */
export function Ecosystem({ locale }: { readonly locale: string }): ReactNode {
  const [active, setActive] = useState<string>(FAMILIES[0]?.id ?? "base");

  const current = FAMILIES.find((f) => f.id === active) ?? FAMILIES[0];
  const index = FAMILIES.findIndex((f) => f.id === active);
  const category = current ? productFamilyByKey(current.key) : undefined;

  return (
    <section className="fs-sec fs-eco" id="products" data-surface="midnight">
      <div className="fs-blueprint" aria-hidden="true" />
      <div className="fs-wrap">
        <div className="fs-eco-head fs-section-head fs-rv">
          <div>
            <div className="fs-eyebrow">Our products</div>
            <h2 className="fs-d2">Six families, and one route into each.</h2>
          </div>
          <p className="fs-lead" style={{ maxWidth: "38ch" }}>
            A range built for lubricant manufacturers, industrial companies and specialised
            industries. Select a family to see what it covers and what an enquiry needs.
          </p>
        </div>

        <div className="fs-eco-stage">
          <div className="fs-eco-canvas">
            <OrbitVisual families={FAMILIES} activeId={active} onSelect={setActive} />
          </div>

          {/*
           * The tab strip and the panel it drives, in one column.
           *
           * The strip used to be a full-width row *below* the whole stage — a sibling of the
           * canvas and the panel rather than a neighbour of either. Measured at this width, its
           * top sat 129px under the bottom of the panel it controls, and the right column carried
           * 206px of unused height beneath that panel because the panel is 414px inside a 620px
           * stage. A control that far from its target reads as an unrelated row of chips, and the
           * dead column was the largest single piece of empty space left in this section.
           *
           * Stacking them puts the control directly on top of what it changes, and the strip wraps
           * to roughly the height the column was wasting. It is also the better reading order: a
           * `role="tablist"` immediately followed by the panel it selects is what assistive
           * technology expects, where the old order announced the panel first and the tabs last.
           */}
          <div className="fs-eco-side">
            {/* The tab strip is the non-moving route to the same content. */}
            <div className="fs-eco-tabs" role="tablist" aria-label="Product families">
              {FAMILIES.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  role="tab"
                  className="fs-eco-tab"
                  aria-selected={f.id === active}
                  onClick={() => setActive(f.id)}
                >
                  {f.short}
                </button>
              ))}
            </div>

            <div className="fs-eco-detail fs-rv" aria-live="polite">
              {current && (
                <>
                  <div className="k">
                    Family 0{index + 1} · {current.sub}
                  </div>
                  <h3>{current.name}</h3>
                  <p>{current.body}</p>
                  <ul className="fs-eco-specs">
                    {current.specs.map(([k, v]) => (
                      <li key={k}>
                        <span>{k}</span>
                        <span>{v}</span>
                      </li>
                    ))}
                  </ul>
                  {category && (
                    <a
                      href={localeHref(locale, category.href)}
                      className="fs-btn fs-btn--glass"
                      style={{ marginTop: 24, minHeight: 46 }}
                      aria-label={`View ${category.label}`}
                    >
                      Explore this range
                      <Arrow size={14} />
                    </a>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
