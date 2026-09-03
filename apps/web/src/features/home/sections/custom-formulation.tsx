"use client";

import Image from "next/image";
import { useEffect, useRef, useState, type ReactNode } from "react";

import { Arrow } from "@/features/site/logo-mark";
import { localeHref } from "@/features/site/site-routes";

import { CUSTOM_CTA, CUSTOM_STEPS } from "../home-data";

/**
 * 7 · Custom Formulation Highlight — the workbook's seventh Home segment.
 *
 * ── The construction is the manufacturing journey's, and it is kept ────────────────────────
 *
 * This section was "Six decisions that move an enquiry forward", a generic account of the buyer's
 * path. The workbook has no segment for that; it has one for the customization process, and that
 * process happens to be six steps long, which is exactly what this apparatus renders. So the
 * machinery below — the pin, the horizontal track, the ghost numerals, the progress rail — is
 * untouched, and only its subject changed.
 *
 * ── Six steps, not five ──────────────────────────────────────────────────────────────────────
 *
 * The workbook disagrees with itself: its `Home Page` sheet gives five stages and its
 * `Customized Solutions` sheet gives six. The owner chose six, so both surfaces render the
 * `Customized Solutions` sequence and cannot drift apart.
 *
 * ── The section's two actions ────────────────────────────────────────────────────────────────
 *
 * The sheet gives this segment the CTA "Request Custom Solution". A second, quieter action to
 * Contact Us sits beside it because the workbook's Home sheet has **no final-CTA segment** and the
 * page's previous closing section was removed — this is the last point on the page where a reader
 * is holding a specific requirement, so it is where the contact route belongs.
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
/**
 * Vertical scroll spent per horizontal step, in viewport heights.
 *
 * The track's horizontal distance is fixed at one viewport width per step — that is what makes a
 * step fill the screen — but the *vertical* scroll mapped onto it is a free choice, and it was
 * one screen per step. Measured on the finished page, that made this section **6072px of a
 * 13493px homepage: 45%**, 6.6 screens of a 14.8-screen page, for a segment whose own call to
 * action sends the reader to `/customized-solutions`, where the process is the whole page.
 *
 * At 50 the same six steps and the same artwork pass in half the scrolling. Nothing is removed
 * and nothing moves faster on screen than the reader's own gesture — one wheel notch simply
 * advances twice as far along the track. `measure()` derives its span from the section's real
 * height, so this constant is the only place the ratio is written.
 */
const TRAVEL_VH_PER_STEP = 50;

export function CustomFormulation({ locale }: { readonly locale: string }): ReactNode {
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

    const n = CUSTOM_STEPS.length;
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
      // One viewport for the pin itself, then TRAVEL_VH_PER_STEP per transition, with the
      // heading's height on top so travel starts where the pin does. The steps still cross
      // exactly (n − 1) viewports horizontally; only the scroll mapped onto that changes.
      section.style.height = `calc(${100 + (n - 1) * TRAVEL_VH_PER_STEP}vh + ${headOffset()}px)`;
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
      id="custom-formulation"
      data-surface="light"
      data-mode={mode}
    >
      {/* Scrolls away before the sticky track pins; its height is accounted for in the travel. */}
      <div className="fs-jrny-head" ref={headRef}>
        <div className="fs-wrap fs-jrny-intro">
          {/*
           * The only section on the page that arrived with no entrance at all: a reveal-coverage
           * probe across all nine `main > section` elements returned `rv 0, rvl 0, masks 0` here
           * while every neighbour reported at least one block. The heading, the paragraph and both
           * calls to action simply appeared. `.fs-rv` on the copy column makes it the
           * orchestration unit and `.fs-rv-l` on its four parts gives the engine something to
           * stagger — the same construction Who We Are uses one surface change earlier.
           */}
          <div className="fs-jrny-head-copy fs-rv">
            <div className="fs-eyebrow fs-rv-l">Customized solutions</div>
            <h2 className="fs-d2 fs-rv-l">When the catalogue is only part of the answer.</h2>
            <p className="fs-rv-l">
              Where a standard product does not meet the requirement, the product is developed
              against it instead. Six steps take a stated need to a delivered order.
            </p>
            <div className="fs-jrny-cta fs-rv-l">
              <a href={localeHref(locale, CUSTOM_CTA.primary.href)} className="fs-btn fs-btn--gold">
                {CUSTOM_CTA.primary.label}
                <Arrow size={14} />
              </a>
              <a
                href={localeHref(locale, CUSTOM_CTA.secondary.href)}
                /* `--outline`, not `--glass`: this intro is on the light surface, where the glass
                   variant is white text on a near-transparent white fill — measured 1:1. */
                className="fs-btn fs-btn--outline"
              >
                {CUSTOM_CTA.secondary.label}
              </a>
            </div>
          </div>

          <figure className="fs-jrny-photo fs-rv">
            <Image
              src="/images/home/journey-requirement-to-supply.webp"
              alt="Oil sample review beside packaged lubricants and an export container"
              fill
              sizes="(max-width: 900px) calc(100vw - 40px), 54vw"
            />
            <figcaption>From requirement to finished product</figcaption>
          </figure>
        </div>
      </div>

      <div className="fs-jrny-sticky">
        <div className="fs-jrny-track" ref={trackRef}>
          {CUSTOM_STEPS.map((stage) => (
            <article className="fs-jstep" key={stage.n}>
              <span className="fs-jstep-ghost" aria-hidden="true">
                {stage.n}
              </span>

              <div className="fs-jstep-copy">
                <span className="fs-jstep-no">
                  STEP {stage.n} / {String(CUSTOM_STEPS.length).padStart(2, "0")}
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
          {count} / {String(CUSTOM_STEPS.length).padStart(2, "0")}
        </div>
      </div>
    </section>
  );
}
