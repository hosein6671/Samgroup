"use client";

import type { ReactNode } from "react";

import { Arrow } from "@/features/site/logo-mark";

import { INSIGHTS, LEAD_ARTICLE } from "../home-data";
import { useCanvas } from "../motion/use-canvas";

/**
 * 8 · Editorial insights.
 *
 * A magazine well: one lead with a generated cover, four secondaries as a numbered stack. The
 * structural difference from a card grid is hierarchy — a grid gives every article equal weight,
 * which is a database query rendered as design.
 *
 * The cover is a **refined-cut gradient field**: 34 stacked sine curves over a navy gradient
 * with a warm bloom in the upper right. It is painted once per resize rather than per frame —
 * a still image that happens to be generated, so it costs nothing to leave on screen.
 */
export function Insights(): ReactNode {
  const coverRef = useCanvas(
    ({ ctx, w, h }) => {
      const g = ctx.createLinearGradient(0, 0, w, h);
      g.addColorStop(0, "#061346");
      g.addColorStop(0.55, "#0A1C57");
      g.addColorStop(1, "#030B1F");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);

      // Amplitude and opacity both rise down the field, so the cuts separate toward the base.
      for (let i = 0; i < 34; i++) {
        const y = h * (i / 34);
        ctx.beginPath();
        for (let x = 0; x <= w; x += 10) {
          ctx.lineTo(x, y + Math.sin(x * 0.008 + i * 0.5) * (8 + i * 0.7));
        }
        ctx.strokeStyle = `rgba(227,198,137,${(0.03 + (i / 34) * 0.11).toFixed(3)})`;
        ctx.lineWidth = 1;
        ctx.stroke();
      }

      const bloom = ctx.createRadialGradient(w * 0.72, h * 0.28, 0, w * 0.72, h * 0.28, w * 0.6);
      bloom.addColorStop(0, "rgba(227,198,137,.22)");
      bloom.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = bloom;
      ctx.fillRect(0, 0, w, h);
    },
    { still: true },
  );

  return (
    <section className="fs-sec fs-insights" id="insights" data-surface="light">
      <div className="fs-wrap">
        <div
          className="fs-rv"
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-end",
            gap: 32,
            flexWrap: "wrap",
            marginBottom: "clamp(32px,4vw,56px)",
          }}
        >
          <div>
            <div className="fs-eyebrow">Global Insights</div>
            <h2 className="fs-d2" style={{ marginTop: 22, maxWidth: "14ch" }}>
              Notes from the industry.
            </h2>
          </div>
          <a href="#insights" className="fs-btn fs-btn--outline">
            All articles
            <Arrow />
          </a>
        </div>

        <div className="fs-grid12">
          <article className="fs-ins-lead fs-rv">
            <div className="fs-ins-hero">
              <canvas ref={coverRef} aria-hidden="true" />
              <span className="fs-ins-hero-tag">{LEAD_ARTICLE.tag}</span>
            </div>
            <h3>{LEAD_ARTICLE.title}</h3>
            <div className="fs-ins-meta">
              {LEAD_ARTICLE.meta.map((m, i) => (
                <span key={m}>
                  {i > 0 && (
                    <span aria-hidden="true" style={{ marginInlineEnd: 14 }}>
                      ·
                    </span>
                  )}
                  {m}
                </span>
              ))}
            </div>
            <p className="fs-small" style={{ marginTop: 14, maxWidth: "56ch" }}>
              {LEAD_ARTICLE.body}
            </p>
          </article>

          <div className="fs-ins-side fs-rv">
            {INSIGHTS.map((item) => (
              <article className="fs-ins-item" key={item.n}>
                <div className="n">{item.n}</div>
                <div>
                  <h4>{item.title}</h4>
                  <p>{item.body}</p>
                </div>
              </article>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
