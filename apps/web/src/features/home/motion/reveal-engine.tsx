"use client";

import { useEffect, type ReactNode } from "react";

/**
 * The page's reveal orchestration, in one client component that renders nothing.
 *
 * **A section reveals as one moment, not as eight independent fades.** Elements inside an
 * `.fs-rv` block are ordered by DOM position and each is offset from the last, capped so the
 * final item never waits more than half a second. Scattered independent fades read as noise; a
 * sequence reads as intent — which is the single biggest difference between this and a page
 * with `animate-on-scroll` sprinkled over it.
 *
 * **It arms the CSS rather than driving it.** `flagship.css` authors every revealed element in
 * its *finished* state; only when this component mounts does it set `data-reveal-armed` on the
 * root, at which point the hidden-start rules apply. That ordering is deliberate: server HTML
 * and the pre-hydration window show the complete page, so a crawler, a reduced-motion visitor
 * and anyone whose JS fails all get content rather than a blank screen. The usual approach —
 * authoring `opacity: 0` and hoping JS arrives — fails all three.
 */
const STEP = 85;
const CAP = 6 * STEP;

export function RevealEngine(): ReactNode {
  useEffect(() => {
    const root = document.getElementById("flagship-root");
    if (!root) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    // Measure every schematic path so the draw-on animation has a real length to travel.
    root.querySelectorAll<SVGElement>(".fs-draw").forEach((svg) => {
      svg.querySelectorAll<SVGGeometryElement>("path, circle, line, rect").forEach((shape) => {
        try {
          const len = shape.getTotalLength ? shape.getTotalLength() : 600;
          shape.style.setProperty("--len", String(Math.ceil(len || 600)));
        } catch {
          /* getTotalLength throws on a detached or zero-length node; the 600 default holds. */
        }
      });
    });

    root.dataset.revealArmed = "true";

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          observer.unobserve(entry.target);

          const children = entry.target.querySelectorAll<HTMLElement>(".fs-rv-l, .fs-line-mask");
          children.forEach((node, i) => {
            if (!reduced) {
              const delay = `${Math.min(i * STEP, CAP)}ms`;
              node.style.transitionDelay = delay;
              const inner = node.firstElementChild;
              if (node.classList.contains("fs-line-mask") && inner instanceof HTMLElement) {
                inner.style.transitionDelay = delay;
              }
            }
            node.classList.add("in");
          });

          entry.target.classList.add("in");
        }
      },
      { threshold: 0.14, rootMargin: "0px 0px -10% 0px" },
    );

    // An `.fs-rv` block is the unit of orchestration. Anything loose is observed on its own.
    // The hero is excluded because the boot sequence choreographs it instead.
    root.querySelectorAll(".fs-rv").forEach((n) => {
      if (!n.closest(".fs-hero")) observer.observe(n);
    });
    root.querySelectorAll(".fs-rv-l, .fs-line-mask").forEach((n) => {
      if (!n.closest(".fs-rv") && !n.closest(".fs-hero")) observer.observe(n);
    });
    root.querySelectorAll(".fs-draw").forEach((n) => observer.observe(n));

    return () => {
      observer.disconnect();
      delete root.dataset.revealArmed;
    };
  }, []);

  return null;
}
