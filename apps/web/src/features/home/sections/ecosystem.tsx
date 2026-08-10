"use client";

import { useState, type ReactNode } from "react";

import { Arrow } from "../chrome/logo-mark";
import { FAMILIES } from "../home-data";
import { OrbitVisual } from "../visuals/orbit-visual";

/**
 * 3 · Petroleum product ecosystem.
 *
 * Section shell is the approved homepage version and is unchanged: heading, eyebrow, copy,
 * layout, detail panel, specs, tabs, spacing and background all stand exactly as they were.
 *
 * The single change is inside `.fs-eco-canvas` — the central visualisation is now
 * `<OrbitVisual>`, rebuilt from the approved `sam-group.html` reference. Selection state and
 * the panel/tab wiring around it are untouched.
 */
export function Ecosystem(): ReactNode {
  const [active, setActive] = useState<string>(FAMILIES[0]?.id ?? "lub");

  const current = FAMILIES.find((f) => f.id === active) ?? FAMILIES[0];
  const index = FAMILIES.findIndex((f) => f.id === active);

  return (
    <section className="fs-sec fs-eco" id="products" data-surface="midnight">
      <div className="fs-blueprint" aria-hidden="true" />
      <div className="fs-wrap">
        <div className="fs-eco-head fs-rv">
          <div>
            <div className="fs-eyebrow">Product Ecosystem</div>
            <h2 className="fs-d2" style={{ marginTop: 22, maxWidth: "16ch" }}>
              One base oil. Five engineered destinations.
            </h2>
          </div>
          <p className="fs-lead" style={{ maxWidth: "38ch" }}>
            Our portfolio is not a catalogue — it is a single refining chain that branches. Select a
            branch to inspect its specification envelope.
          </p>
        </div>

        <div className="fs-eco-stage">
          <div className="fs-eco-canvas">
            <OrbitVisual families={FAMILIES} activeId={active} onSelect={setActive} />
          </div>

          <div className="fs-eco-detail fs-rv" aria-live="polite">
            {current && (
              <>
                <div className="k">
                  Branch 0{index + 1} · {current.sub}
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
                <a
                  href="#partnership"
                  className="fs-btn fs-btn--glass"
                  style={{ marginTop: 24, minHeight: 46 }}
                >
                  Request specification
                  <Arrow size={14} />
                </a>
              </>
            )}
          </div>
        </div>

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
              {f.name}
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
