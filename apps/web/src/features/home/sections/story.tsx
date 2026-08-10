"use client";

import { useRef, type ReactNode } from "react";

import { MODULES, STORY_META } from "../home-data";

/**
 * 2 · Manufacturing excellence.
 *
 * A sticky statement column against six disclosure panels. The heading holds while the modules
 * scroll past it — the inverse of every other section, and the reason this one is remembered.
 *
 * **The panels disclose on hover *and* focus.** Body copy sits in a `grid-template-rows: 0fr →
 * 1fr` container, which animates to intrinsic height with no JavaScript measurement and no
 * `max-height` guess that clips long copy. `:focus-within` in the CSS is what makes it work
 * from a keyboard; the panel is focusable, so tabbing through opens each in turn.
 *
 * The tilt is the only part that needs JS: a small perspective rotation tracking the pointer,
 * skipped entirely under reduced motion. It is capped at 4–5° — enough to catch the gradient
 * sheen, not enough to read as a novelty.
 */
export function Story(): ReactNode {
  const reduced = useRef<boolean | null>(null);

  const tilt = (e: React.PointerEvent<HTMLElement>): void => {
    reduced.current ??= window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced.current) return;
    const el = e.currentTarget;
    const r = el.getBoundingClientRect();
    const rx = ((e.clientY - r.top) / r.height - 0.5) * -4;
    const ry = ((e.clientX - r.left) / r.width - 0.5) * 5;
    el.style.transform = `perspective(1000px) rotateX(${rx}deg) rotateY(${ry}deg) translateY(-3px)`;
  };

  const reset = (e: React.PointerEvent<HTMLElement>): void => {
    e.currentTarget.style.transform = "";
  };

  return (
    <section className="fs-sec fs-story" id="story" data-surface="light">
      <div
        className="fs-blueprint fs-blueprint--light"
        aria-hidden="true"
        style={{ opacity: 0.7 }}
      />
      <div className="fs-wrap fs-grid12">
        <div className="fs-story-left fs-rv">
          <div className="fs-eyebrow">Manufacturing Excellence</div>
          <h2 className="fs-d2">
            <span className="fs-line-mask">
              <span>Precision.</span>
            </span>
            <span className="fs-line-mask">
              <span>Technology.</span>
            </span>
            <span className="fs-line-mask">
              <span>
                <i>Global reliability.</i>
              </span>
            </span>
          </h2>
          <p className="fs-lead" style={{ marginTop: 26 }}>
            Every barrel that leaves our terminals carries a molecular record — feedstock origin,
            additive package, viscosity curve, and the signature of the engineer who released it.
            That record is the product.
          </p>
          <div className="fs-story-meta">
            {STORY_META.map((m) => (
              <div key={m.label}>
                <b className="fs-tnum">{m.value}</b>
                <span>{m.label}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="fs-story-right">
          <div className="fs-panel-stack">
            {MODULES.map((m, i) => (
              <article
                key={m.title}
                className="fs-gpanel fs-rv"
                tabIndex={0}
                onPointerMove={tilt}
                onPointerLeave={reset}
              >
                <svg
                  className="fs-gpanel-dia"
                  viewBox="0 0 190 190"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.4"
                  aria-hidden="true"
                  dangerouslySetInnerHTML={{ __html: m.diagram }}
                />
                <div className="fs-gpanel-idx">0{i + 1} — MODULE</div>
                <h3>{m.title}</h3>
                <div className="fs-gpanel-body">
                  <div>
                    <p>{m.body}</p>
                    <div className="fs-tags">
                      {m.tags.map((tag) => (
                        <span className="fs-tag" key={tag}>
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
