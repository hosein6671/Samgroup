"use client";

import Image from "next/image";
import { useEffect, useRef, useState, type ReactNode } from "react";

import { STAGES } from "../home-data";

/**
 * 7 · Manufacturing journey — rebuilt from the approved `sam-group.html` reference.
 *
 * A horizontal storytelling timeline where **each step occupies the full viewport**. A sticky
 * child holds the viewport while the track translates by scroll progress through it, so one
 * vertical scroll walks the six steps sideways.
 *
 * Reference behaviour: `width: 100vw` per step, two columns (copy left, artwork right), a ghost
 * numeral behind each step, a bottom progress rail and an `01 / 06` counter.
 *
 * ── Motion ─────────────────────────────────────────────────────────────────
 *
 * Scroll position is still the single source of truth and the mapping is still 1:1 — the track
 * lands at exactly the position the scroll dictates. What changed is that it *arrives* rather
 * than jumps: `target` is the scroll-derived value, `current` chases it at 0.14 per frame, and
 * the loop parks itself once the gap closes. That is the difference between gliding through a
 * stage and switching a slide, and it costs one short rAF burst per scroll rather than a
 * permanent loop.
 *
 * `prefers-reduced-motion` snaps `current` to `target` immediately — easing is precisely what
 * that preference asks us not to do — and drops the pin for a native swipe list, as narrow
 * viewports also do.
 */
export function Journey(): ReactNode {
  const sectionRef = useRef<HTMLElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const barRef = useRef<HTMLElement>(null);
  const headRef = useRef<HTMLDivElement>(null);
  const [count, setCount] = useState("01");
  const [mode, setMode] = useState<"pin" | "swipe">("pin");

  useEffect(() => {
    const section = sectionRef.current;
    const track = trackRef.current;
    if (!section || !track) return;

    const n = STAGES.length;
    const narrow = window.matchMedia("(max-width: 759px)");
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");

    let shown = "";
    let target = 0;
    let current = 0;
    let raf = 0;

    const isSwipe = (): boolean => narrow.matches || reduced.matches;

    /** The pin only begins once the heading has scrolled past, so travel starts from there. */
    const headOffset = (): number => headRef.current?.offsetHeight ?? 0;

    const measure = (): void => {
      if (isSwipe()) return;
      const r = section.getBoundingClientRect();
      const h = headOffset();
      const span = r.height - h - window.innerHeight;
      if (span <= 0) return;
      target = Math.min(1, Math.max(0, (-r.top - h) / span));
    };

    const paint = (): void => {
      track.style.transform = `translate3d(${-current * (n - 1) * 100}vw,0,0)`;
      if (barRef.current) barRef.current.style.width = `${current * 100}%`;
      const idx = Math.min(n, Math.max(1, Math.round(current * (n - 1)) + 1));
      const next = String(idx).padStart(2, "0");
      if (next !== shown) {
        shown = next;
        setCount(next);
      }
    };

    const tick = (): void => {
      // ~7-frame settle: long enough to read as momentum, short enough that the track never
      // feels detached from the gesture.
      current += (target - current) * 0.14;
      if (Math.abs(target - current) < 0.0002) {
        current = target;
        paint();
        raf = 0;
        return;
      }
      paint();
      raf = requestAnimationFrame(tick);
    };

    const onScroll = (): void => {
      if (isSwipe()) return;
      measure();
      if (reduced.matches) {
        current = target;
        paint();
        return;
      }
      if (!raf) raf = requestAnimationFrame(tick);
    };

    const layout = (): void => {
      if (raf) {
        cancelAnimationFrame(raf);
        raf = 0;
      }
      if (isSwipe()) {
        setMode("swipe");
        section.style.height = "";
        track.style.transform = "";
        if (barRef.current) barRef.current.style.width = "";
        return;
      }
      setMode("pin");
      // The heading's height is added on top of the step travel, so the six steps still get
      // exactly (n − 1) viewports of horizontal movement once the sticky pins.
      section.style.height = `calc(${n * 100}vh + ${headOffset()}px)`;
      measure();
      current = target;
      paint();
    };

    layout();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", layout, { passive: true });
    narrow.addEventListener("change", layout);
    reduced.addEventListener("change", layout);

    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", layout);
      narrow.removeEventListener("change", layout);
      reduced.removeEventListener("change", layout);
      if (raf) cancelAnimationFrame(raf);
      section.style.height = "";
    };
  }, []);

  return (
    <section
      ref={sectionRef}
      className="fs-journey"
      id="journey"
      data-surface="light"
      data-mode={mode}
    >
      {/* Scrolls away before the sticky track pins; its height is accounted for in the travel. */}
      <div className="fs-jrny-head" ref={headRef}>
        <div className="fs-wrap fs-jrny-intro">
          <div className="fs-jrny-head-copy">
            <div className="fs-eyebrow">From requirement to supply planning</div>
            <h2 className="fs-d2">Six decisions that move an enquiry forward.</h2>
            <p>
              Start with the operating need, identify the relevant product route, and carry the
              reviewed technical and commercial details into supply planning.
            </p>
          </div>

          <figure className="fs-jrny-photo">
            <Image
              src="/images/home/journey-requirement-to-supply.webp"
              alt="Oil sample review beside packaged lubricants and an export container"
              fill
              sizes="(max-width: 900px) calc(100vw - 40px), 54vw"
            />
            <figcaption>From product review to supply brief</figcaption>
          </figure>
        </div>
      </div>

      <div className="fs-jrny-sticky">
        <div className="fs-jrny-track" ref={trackRef}>
          {STAGES.map((stage) => (
            <article className="fs-jstep" key={stage.n}>
              <span className="fs-jstep-ghost" aria-hidden="true">
                {stage.n}
              </span>

              <div className="fs-jstep-copy">
                <span className="fs-jstep-no">
                  STEP {stage.n} / {String(STAGES.length).padStart(2, "0")}
                </span>
                <h3>{stage.title}</h3>
                <p>{stage.body}</p>
                <div className="fs-jstep-list">
                  {stage.facts.map(([value, label]) => (
                    <span key={label}>
                      {value} · {label}
                    </span>
                  ))}
                </div>
              </div>

              <div
                className="fs-jstep-art"
                aria-hidden="true"
                dangerouslySetInnerHTML={{ __html: stage.art }}
              />
            </article>
          ))}
        </div>

        <div className="fs-jrny-progress" aria-hidden="true">
          <i ref={barRef} />
        </div>
        <div className="fs-jrny-count" aria-hidden="true">
          {count} / {String(STAGES.length).padStart(2, "0")}
        </div>
      </div>
    </section>
  );
}
