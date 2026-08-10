import type { ReactNode } from "react";

import { Arrow } from "@/features/site/logo-mark";

import { HERO_SPEC, HERO_STATS } from "../home-data";
import { Counter } from "../motion/counter";
import { OilField } from "../visuals/oil-field";

/**
 * 1 · Hero.
 *
 * Full viewport over the oil field, with the veil grading it down at top and bottom so display
 * type never sits on a bright crest. Copy occupies seven columns, the live telemetry panel four
 * — the asymmetry is what keeps it from reading as a centred banner.
 *
 * The headline is server-rendered text in three masked lines. That makes it the LCP element and
 * keeps it crawlable; only the canvas and the counters are client work, and both sit behind it.
 */
export function Hero(): ReactNode {
  return (
    <section className="fs-hero" id="top" data-surface="midnight">
      <OilField />
      <div className="fs-hero-veil" aria-hidden="true" />
      <div className="fs-blueprint" aria-hidden="true" />

      <div className="fs-hero-body">
        <div className="fs-wrap fs-grid12 fs-hero-grid">
          <div className="fs-hero-copy">
            <div className="fs-eyebrow fs-rv-l">Global Petroleum Manufacturing · Est. 1998</div>

            {/* Three lines, three masks — each travels up from behind its own overflow box. */}
            <h1 className="fs-d1">
              <span className="fs-line-mask">
                <span>Engineering</span>
              </span>
              <span className="fs-line-mask">
                <span>Premium Energy</span>
              </span>
              <span className="fs-line-mask">
                <span>
                  <em>Solutions</em>
                </span>
              </span>
            </h1>

            <p className="fs-hero-lead fs-rv-l">
              Sam Group delivers advanced petroleum products, lubricants, base oils, and industrial
              solutions engineered for global industries.
            </p>

            <div className="fs-hero-cta fs-rv-l">
              <a href="#products" className="fs-btn fs-btn--gold">
                Explore products
                <Arrow />
              </a>
              <a href="#partnership" className="fs-btn fs-btn--glass">
                Request partnership
              </a>
            </div>
          </div>

          <aside className="fs-hero-side fs-rv-l">
            <div className="fs-hero-spec">
              {/*
               * `h2`, not the prototype's `h4`. The panel sits directly after the `h1`, and
               * jumping two levels breaks the document outline that screen-reader users
               * navigate by. The visual is unchanged — size lives on the CSS class, not on the
               * tag, which is exactly the role/element separation the design system is built on.
               */}
              <h2>Plant Telemetry · Live</h2>
              <dl style={{ margin: 0 }}>
                {HERO_SPEC.map((row) => (
                  <div className="fs-spec-row" key={row.label}>
                    <dt>{row.label}</dt>
                    <dd className="fs-tnum">{row.value}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </aside>
        </div>
      </div>

      <div className="fs-scroll-hint" aria-hidden="true">
        <i />
        <span>Scroll to enter the facility</span>
      </div>

      <div className="fs-hero-stats">
        <div className="fs-wrap">
          {HERO_STATS.map((stat) => (
            <div className="fs-stat" key={stat.label}>
              <Counter value={stat.value} suffix={stat.suffix} className="fs-tnum" />
              <span>{stat.label}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
