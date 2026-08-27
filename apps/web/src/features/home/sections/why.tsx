"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

import { LINE_OUTPUT, RELEASE_SPEC, TECH_TAGS, TRUST } from "../home-data";

/**
 * Quantise a coordinate to three decimals before it is serialised into an SVG attribute.
 *
 * `Math.cos` and `Math.sin` are *implementation-approximated* in ECMA-262 — an engine is free to
 * return a slightly different double for the same argument, and Node and Chrome do exactly that
 * here despite both being V8: the server rendered `x1="51.9463112807708"` where the client
 * computed `51.946311280770814`, a difference of 1.4e-14 that React correctly reported as a
 * hydration mismatch. Rounding collapses the divergence long before it can reach an attribute.
 *
 * Three decimals is a thousandth of a viewBox unit on a 300-unit canvas — at the gauge's rendered
 * size, roughly a ten-thousandth of a pixel, far below anything that can be drawn — so the
 * geometry is unchanged. The closest of the 41 ticks sits 2.9e-6 units from a rounding boundary,
 * eight orders of magnitude clear of the divergence being absorbed, so the quantised value is
 * itself deterministic.
 */
const q = (n: number): number => Math.round(n * 1000) / 1000;

/**
 * 4 · Why Sam Group — four bespoke compositions, not four cards.
 *
 *   A · capability — copy against an output bar chart that grows on entry
 *   B · quality    — a navy panel with a viscosity-index gauge and a release table
 *   C · technology — a SCADA schematic that draws itself, copy in the trailing third
 *   D · trust      — a hairline grid of audited figures
 *
 * Each block owns a different grid split, so no two read as the same module reskinned.
 *
 * The bars and the gauge are the only client work: both animate once on entry and then stop.
 * Their final values are in the DOM either way, so a reduced-motion visitor or a crawler reads
 * the same numbers without any of it running.
 */
export function Why(): ReactNode {
  const barsRef = useRef<HTMLDivElement>(null);
  const gaugeRef = useRef<SVGSVGElement>(null);
  const [barsIn, setBarsIn] = useState(false);
  const [vi, setVi] = useState(3);
  const [arcOffset, setArcOffset] = useState(0);

  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const full = 741;
    // Three review stages over the gauge's 280° sweep.
    const target = full - full * (3 / 3) * (280 / 360);

    if (reduced) {
      setBarsIn(true);
      setArcOffset(target);
      return;
    }

    setVi(0);
    setArcOffset(full);

    const observers: IntersectionObserver[] = [];
    const watch = (node: Element | null, run: () => void): void => {
      if (!node) return;
      const io = new IntersectionObserver(
        (entries) => {
          if (!entries.some((e) => e.isIntersecting)) return;
          io.disconnect();
          run();
        },
        { threshold: 0.4 },
      );
      io.observe(node);
      observers.push(io);
    };

    watch(barsRef.current, () => setBarsIn(true));
    watch(gaugeRef.current, () => {
      setArcOffset(target);
      const t0 = performance.now();
      const tick = (now: number): void => {
        const p = Math.min(1, (now - t0) / 2000);
        setVi(Math.round(3 * (1 - Math.pow(1 - p, 3))));
        if (p < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });

    return () => observers.forEach((o) => o.disconnect());
  }, []);

  const ticks = Array.from({ length: 41 }, (_, i) => {
    const a = ((-220 + i * 7) * Math.PI) / 180;
    const r2 = i % 5 === 0 ? 138 : 134;
    return {
      x1: q(150 + 128 * Math.cos(a)),
      y1: q(150 + 128 * Math.sin(a)),
      x2: q(150 + r2 * Math.cos(a)),
      y2: q(150 + r2 * Math.sin(a)),
      major: i % 5 === 0,
    };
  });

  return (
    <section className="fs-sec fs-why" id="why" data-surface="light">
      <div className="fs-wrap">
        <div className="fs-why-intro fs-rv">
          <div>
            <div className="fs-eyebrow">A practical path for B2B buyers</div>
            <h2 className="fs-d2">
              <span className="fs-line-mask">
                <span>Turn a requirement</span>
              </span>
              <span className="fs-line-mask">
                <span>into a product and</span>
              </span>
              <span className="fs-line-mask">
                <span>
                  <i>supply brief.</i>
                </span>
              </span>
            </h2>
          </div>

          <aside className="fs-why-path" aria-label="B2B buyer information path">
            <div className="fs-why-path-label">From operating need to supply brief</div>
            <ol>
              <li>
                <span>01</span>
                <div>
                  <strong>Define the requirement</strong>
                  <small>Application, equipment, and operating conditions</small>
                </div>
              </li>
              <li>
                <span>02</span>
                <div>
                  <strong>Identify the product route</strong>
                  <small>Family, grade, and applicable specification</small>
                </div>
              </li>
              <li>
                <span>03</span>
                <div>
                  <strong>Review the information</strong>
                  <small>Recorded properties, claims, and available documents</small>
                </div>
              </li>
              <li>
                <span>04</span>
                <div>
                  <strong>Prepare the supply brief</strong>
                  <small>Quantity, packaging, destination, and preferred trade term</small>
                </div>
              </li>
            </ol>
          </aside>
        </div>

        {/* A · capability */}
        <div className="fs-why-block">
          <div className="fs-grid12 fs-cap-layout">
            <div className="fs-cap-copy fs-rv">
              <div className="fs-wb-num">01 / CAPABILITY</div>
              <h3 className="fs-d3" style={{ marginTop: 16, color: "var(--fs-navy)" }}>
                Reach the relevant product range faster
              </h3>
              <p className="fs-lead" style={{ marginTop: 18 }}>
                Browse by family, application, and grade. The selected context stays connected to
                the enquiry, reducing repetition and making the requirement easier to assess.
              </p>
              <div style={{ display: "flex", gap: 38, marginTop: 28, flexWrap: "wrap" }}>
                {[
                  ["100", "Catalogue products"],
                  ["6", "Product families"],
                ].map(([v, l]) => (
                  <div key={l}>
                    <b
                      className="fs-tnum"
                      style={{
                        fontFamily: "var(--font-display)",
                        fontSize: 38,
                        fontWeight: 300,
                        letterSpacing: "-.03em",
                        color: "var(--fs-navy)",
                      }}
                    >
                      {v}
                    </b>
                    <br />
                    <span className="fs-mono" style={{ color: "var(--color-text-secondary)" }}>
                      {l}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="fs-cap-viz fs-rv">
              <div
                className="fs-mono"
                style={{ color: "var(--color-text-secondary)", marginBottom: 14 }}
              >
                Current catalogue distribution · relative product count
              </div>
              <div className="fs-bars" ref={barsRef}>
                {LINE_OUTPUT.map((line, i) => (
                  <div
                    key={line.id}
                    className="fs-bar"
                    style={{
                      height: barsIn ? `${line.pct}%` : 0,
                      transitionDelay: `${i * 90}ms`,
                    }}
                  />
                ))}
              </div>
              <div className="fs-bar-lab">
                {LINE_OUTPUT.map((line) => (
                  <span key={line.id}>{line.id}</span>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* B · quality */}
        <div className="fs-why-block">
          <div className="fs-qual fs-rv">
            <div className="fs-blueprint" aria-hidden="true" style={{ opacity: 0.35 }} />
            <div className="fs-qual-grid">
              <div>
                <div className="fs-wb-num">02 / QUALITY</div>
                <h3 className="fs-d3" style={{ marginTop: 16 }}>
                  Review product information in context
                </h3>
                <p
                  style={{
                    marginTop: 18,
                    color: "rgba(238,241,246,.72)",
                    fontSize: 15,
                    lineHeight: 1.66,
                    maxWidth: "46ch",
                  }}
                >
                  Product pages separate general descriptions, recorded typical properties, and
                  supporting documents. Final suitability is assessed against the buyer&apos;s
                  requirement and the applicable specification.
                </p>
                <table>
                  <caption>Product documentation pathway</caption>
                  <tbody>
                    {RELEASE_SPEC.map(([k, v]) => (
                      <tr key={k}>
                        <td>{k}</td>
                        <td>{v}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div>
                <svg
                  ref={gaugeRef}
                  className="fs-gauge"
                  viewBox="0 0 300 300"
                  role="img"
                  aria-label="Three-stage technical review pathway"
                >
                  <defs>
                    <linearGradient id="fsGaugeGold" x1="0" y1="0" x2="1" y2="1">
                      <stop offset="0%" stopColor="#E3C689" />
                      <stop offset="100%" stopColor="#C39A4E" />
                    </linearGradient>
                  </defs>
                  <circle cx="150" cy="150" r="118" fill="none" stroke="rgba(255,255,255,.1)" />
                  <circle cx="150" cy="150" r="96" fill="none" stroke="rgba(255,255,255,.07)" />
                  <g>
                    {ticks.map((t, i) => (
                      <line
                        key={i}
                        x1={t.x1}
                        y1={t.y1}
                        x2={t.x2}
                        y2={t.y2}
                        stroke={t.major ? "rgba(227,198,137,.6)" : "rgba(255,255,255,.16)"}
                        strokeWidth={1}
                      />
                    ))}
                  </g>
                  <circle
                    cx="150"
                    cy="150"
                    r="118"
                    fill="none"
                    stroke="url(#fsGaugeGold)"
                    strokeWidth="6"
                    strokeLinecap="round"
                    transform="rotate(-220 150 150)"
                    strokeDasharray="741"
                    strokeDashoffset={arcOffset}
                    style={{ transition: "stroke-dashoffset 2000ms cubic-bezier(.16,1,.3,1)" }}
                  />
                  <text
                    x="150"
                    y="146"
                    textAnchor="middle"
                    className="fs-tnum"
                    style={{
                      fontFamily: "var(--font-display)",
                      fontSize: 56,
                      fontWeight: 300,
                      fill: "#fff",
                      letterSpacing: "-.03em",
                    }}
                  >
                    {vi}
                  </text>
                  <text
                    x="150"
                    y="172"
                    textAnchor="middle"
                    style={{
                      fontFamily: "var(--font-technical)",
                      fontSize: 10,
                      letterSpacing: ".2em",
                      fill: "#C39A4E",
                    }}
                  >
                    REVIEW STAGES
                  </text>
                  <text
                    x="150"
                    y="196"
                    textAnchor="middle"
                    style={{
                      fontFamily: "var(--font-technical)",
                      fontSize: 9,
                      letterSpacing: ".14em",
                      fill: "rgba(238,241,246,.45)",
                    }}
                  >
                    SOURCE · REVIEW · DECISION
                  </text>
                </svg>
              </div>
            </div>
          </div>
        </div>

        {/* C · technology */}
        <div className="fs-why-block">
          <div className="fs-grid12 fs-tech-layout">
            <div className="fs-tech-viz fs-rv">
              <div className="fs-content-flow" aria-label="Product information review flow">
                <div className="fs-content-flow-head">
                  <span>Product information path</span>
                  <span>Recorded → reviewed → published</span>
                </div>
                <ol>
                  <li>
                    <span className="fs-flow-index">01</span>
                    <strong>Source record</strong>
                    <small>Exact product name, specification and supporting document</small>
                  </li>
                  <li>
                    <span className="fs-flow-index">02</span>
                    <strong>Technical review</strong>
                    <small>Specification context, typical properties and claims checked</small>
                  </li>
                  <li>
                    <span className="fs-flow-index">03</span>
                    <strong>Publication decision</strong>
                    <small>Review status and decision history retained</small>
                  </li>
                  <li>
                    <span className="fs-flow-index">04</span>
                    <strong>Product page</strong>
                    <small>Reviewed information becomes available to the buyer</small>
                  </li>
                </ol>
                <div className="fs-content-flow-output">
                  <span aria-hidden="true" />
                  Buyer-facing output · Product page
                </div>
              </div>
            </div>
            <div className="fs-tech-copy fs-rv">
              <div className="fs-wb-num">03 / INFORMATION CONTROL</div>
              <h3 className="fs-d3" style={{ marginTop: 16, color: "var(--fs-navy)" }}>
                Know how technical information reaches the product page
              </h3>
              <p className="fs-lead" style={{ marginTop: 18 }}>
                Product names remain exact. Specifications, typical properties, claims, and
                supporting documents retain their source and review status before publication.
              </p>
              <div className="fs-tags" style={{ marginTop: 22 }}>
                {TECH_TAGS.map((tag) => (
                  <span className="fs-tag" key={tag}>
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* D · trust */}
        <div className="fs-why-block">
          <div className="fs-rv">
            <div className="fs-wb-num">04 / TRUST</div>
            <h3
              className="fs-d3"
              style={{ marginTop: 16, color: "var(--fs-navy)", maxWidth: "20ch" }}
            >
              Clear scope. Traceable technical content.
            </h3>
            <p className="fs-lead" style={{ marginTop: 18 }}>
              The catalogue shows what is available, how information has been reviewed, and which
              documents accompany the product record. Suitability still depends on the buyer&apos;s
              requirement and the applicable specification.
            </p>
            <div className="fs-trust-grid">
              {TRUST.map((cell) => (
                <div className="fs-trust-cell" key={cell.label}>
                  <b className="fs-tnum">{cell.value}</b>
                  <span>{cell.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
