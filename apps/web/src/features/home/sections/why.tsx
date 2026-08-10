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
  const [vi, setVi] = useState(168);
  const [arcOffset, setArcOffset] = useState(0);

  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const full = 741;
    // 168 of a 220 scale, over the gauge's 280° sweep.
    const target = full - full * (168 / 220) * (280 / 360);

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
        setVi(Math.round(168 * (1 - Math.pow(1 - p, 3))));
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
    <section
      className="fs-sec fs-why"
      id="why"
      data-surface="light"
      style={{ paddingBlock: "clamp(40px,5vw,72px)" }}
    >
      <div className="fs-wrap">
        <div className="fs-rv" style={{ marginBottom: "clamp(30px,4vw,54px)" }}>
          <div className="fs-eyebrow">Why Sam Group</div>
          <h2 className="fs-d2" style={{ marginTop: 22, maxWidth: "18ch" }}>
            Four reasons procurement teams keep the contract.
          </h2>
        </div>

        {/* A · capability */}
        <div className="fs-why-block">
          <div className="fs-grid12" style={{ alignItems: "end" }}>
            <div className="fs-cap-copy fs-rv">
              <div className="fs-wb-num">01 / CAPABILITY</div>
              <h3 className="fs-d3" style={{ marginTop: 16, color: "var(--fs-navy)" }}>
                Global manufacturing capability
              </h3>
              <p className="fs-lead" style={{ marginTop: 18 }}>
                Four blending lines, automated additive dosing and dual-terminal loading let us hold
                delivery windows that most regional producers quote as “subject to availability”.
              </p>
              <div style={{ display: "flex", gap: 38, marginTop: 28, flexWrap: "wrap" }}>
                {[
                  ["240K", "MT annual capacity"],
                  ["14", "Days avg. lead time"],
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
                Output by line · thousand MT / year
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
                  Premium quality, proven per batch
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
                  Every batch is held until the certificate of analysis clears. Retained samples
                  stay in the archive for five years, so a claim raised in 2030 can still be traced
                  to the drum it came from.
                </p>
                <table>
                  <caption>Typical release specification — SAE 5W-30 SN</caption>
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
                  aria-label="Viscosity index performance gauge showing 168 against an industry benchmark of 120"
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
                    VISCOSITY INDEX
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
                    BENCHMARK 120
                  </text>
                </svg>
              </div>
            </div>
          </div>
        </div>

        {/* C · technology */}
        <div className="fs-why-block">
          <div className="fs-grid12" style={{ alignItems: "center" }}>
            <div className="fs-tech-viz fs-rv">
              <svg
                className="fs-draw"
                viewBox="0 0 720 400"
                role="img"
                aria-label="Schematic of the blending and additive dosing loop"
              >
                <g fill="none" stroke="rgba(6,19,70,.5)" strokeWidth="1.1">
                  <rect x="40" y="120" width="130" height="160" rx="10" />
                  <rect x="290" y="60" width="150" height="120" rx="10" />
                  <rect x="290" y="230" width="150" height="120" rx="10" />
                  <rect x="560" y="120" width="120" height="160" rx="10" />
                  <path d="M170 200 H290" />
                  <path d="M170 200 V120 H290" />
                  <path d="M170 200 V290 H290" />
                  <path d="M440 120 H500 V200 H560" />
                  <path d="M440 290 H500 V200" />
                  <circle cx="500" cy="200" r="16" />
                  <circle cx="230" cy="200" r="9" />
                  <path d="M40 90 H680" strokeDasharray="4 6" stroke="rgba(195,154,78,.6)" />
                </g>
                <g
                  style={{
                    fontFamily: "var(--font-technical)",
                    fontSize: 9.5,
                    letterSpacing: ".14em",
                    fill: "var(--color-text-secondary)",
                  }}
                >
                  <text x="105" y="205" textAnchor="middle">
                    BASE STOCK
                  </text>
                  <text x="365" y="125" textAnchor="middle">
                    ADDITIVE A
                  </text>
                  <text x="365" y="295" textAnchor="middle">
                    ADDITIVE B
                  </text>
                  <text x="620" y="205" textAnchor="middle">
                    BLEND VESSEL
                  </text>
                  <text x="500" y="240" textAnchor="middle" style={{ fill: "#C39A4E" }}>
                    INLINE QC
                  </text>
                  <text x="40" y="80" style={{ fill: "#C39A4E" }}>
                    SCADA CONTROL LOOP · ±0.15% DOSING TOLERANCE
                  </text>
                </g>
              </svg>
            </div>
            <div className="fs-tech-copy fs-rv">
              <div className="fs-wb-num">03 / TECHNOLOGY</div>
              <h3 className="fs-d3" style={{ marginTop: 16, color: "var(--fs-navy)" }}>
                Advanced process technology
              </h3>
              <p className="fs-lead" style={{ marginTop: 18 }}>
                Gravimetric dosing with inline NIR verification. The loop rejects a blend before it
                reaches the vessel, not after the drum is sealed.
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
              Trusted across borders, audited on site
            </h3>
            <p className="fs-lead" style={{ marginTop: 18 }}>
              Buyers audit us before they buy. The numbers below are what those audits keep
              confirming.
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
