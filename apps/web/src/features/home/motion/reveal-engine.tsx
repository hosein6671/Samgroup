"use client";

import { useEffect, type ReactNode } from "react";

/**
 * The page's reveal: **each section assembles from above** as the reader reaches it.
 *
 * When a section's top passes ~78% of the viewport, its parts come down into place one after
 * another in reading order: eyebrow, heading, lead and links, then photographs (opening from the
 * top edge down) and their captions, then cards and panels, then actions. One timing system for the
 * whole page (0.9 s per part, the site's entrance easing, 90 ms between parts), and each section
 * plays once. The hero keeps its own cinematic entrance and is not touched here.
 *
 * **Parts are found by role, not listed per section**, so a section built later follows the same
 * rule without a line of code here. A part is the outermost element matching a role: a card moves
 * as one piece, not as its title and body separately. A heading split into line masks is a frame
 * whose lines are the parts.
 *
 * **It arms the CSS rather than driving it.** The server HTML and the pre-hydration window show
 * the finished page (crawlers, reduced motion and failed JavaScript all get content). Only when this
 * mounts are parts marked and hidden, and only in sections the reader has not reached yet. Once a
 * section has landed, its marks are removed, so every element gets its own transitions back (card
 * hovers, the accordion, the lit steps).
 */
const ROLES: readonly (readonly [role: string, selector: string])[] = [
  ["eyebrow", ".fs-eyebrow"],
  ["heading", ".fs-line-mask, h2"],
  ["photo", ".fs-photo, .fs-branded-photo"],
  [
    "item",
    ".fs-card, .fs-rv-l, .fs-acc-item, .fs-hstep, .fs-eco-tab, .fs-eco-detail, .fs-eco-canvas, .fs-map-shell, .fs-gs, .fs-hprog, .fs-ins-mini, .in-card",
  ],
  ["text", ".fs-lead, .fs-btn, .fs-textlink, figcaption, .fs-ins-meta, h3, p"],
];
const ALL = ROLES.map(([, selector]) => selector).join(",");
const STEP_MS = 90;
const DURATION_MS = 900;
const MAX_INDEX = 16;

function roleOf(el: Element): string {
  for (const [role, selector] of ROLES) if (el.matches(selector)) return role;
  return "text";
}

/** A frame is a container whose children are the parts: a line-masked heading. */
function isFrame(el: Element): boolean {
  return el.matches("h2") && el.querySelector(".fs-line-mask") !== null;
}

function partsOf(section: Element): HTMLElement[] {
  return [...section.querySelectorAll<HTMLElement>(ALL)]
    .filter((el) => {
      if (el.closest(".fs-sr, .fs-photo-brand, canvas, svg")) return false;
      if (isFrame(el) || el.getClientRects().length === 0) return false;
      let up = el.parentElement?.closest(ALL) ?? null;
      while (up && isFrame(up)) up = up.parentElement?.closest(ALL) ?? null;
      return !(up && section.contains(up));
    })
    .sort((a, b) => (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1));
}

export function RevealEngine(): ReactNode {
  useEffect(() => {
    const root = document.getElementById("flagship-root");
    if (!root || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    // Icon strokes still draw themselves; their rules key off this attribute.
    root.dataset.revealArmed = "true";
    root.querySelectorAll<SVGElement>(".fs-draw").forEach((svg) => {
      svg.querySelectorAll<SVGGeometryElement>("path, circle, line, rect").forEach((shape) => {
        try {
          shape.style.setProperty("--len", String(Math.ceil(shape.getTotalLength() || 600)));
        } catch {
          /* getTotalLength throws on a detached or zero-length node; the 600 default holds. */
        }
      });
    });

    const timers = new Set<number>();
    const sections = [...root.querySelectorAll<HTMLElement>("main section")].filter(
      (s) => s.id !== "top",
    );
    const parts = new Map<HTMLElement, HTMLElement[]>();

    const arm = (section: HTMLElement): void => {
      const found = partsOf(section);
      section.dataset.assemble = "armed";
      found.forEach((el, i) => {
        el.dataset.part = roleOf(el);
        el.style.setProperty("--part-i", String(Math.min(i, MAX_INDEX)));
      });
      parts.set(section, found);
    };

    const play = (section: HTMLElement): void => {
      const found = parts.get(section) ?? [];
      void section.offsetHeight; // commit the hidden state before releasing the parts
      section.dataset.assemble = "play";
      section.querySelectorAll(".fs-draw").forEach((n) => n.classList.add("in"));
      const settle = window.setTimeout(
        () => {
          timers.delete(settle);
          delete section.dataset.assemble;
          found.forEach((el) => {
            delete el.dataset.part;
            el.style.removeProperty("--part-i");
          });
        },
        Math.min(found.length, MAX_INDEX + 1) * STEP_MS + DURATION_MS * 1.8 + 100,
      );
      timers.add(settle);
    };

    // Sections already on screen at load keep their finished state; the rest wait to assemble.
    const below = sections.filter((s) => s.getBoundingClientRect().top > window.innerHeight * 0.78);
    below.forEach(arm);
    sections
      .filter((s) => !below.includes(s))
      .forEach((s) => s.querySelectorAll(".fs-draw").forEach((n) => n.classList.add("in")));

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          observer.unobserve(entry.target);
          play(entry.target as HTMLElement);
        }
      },
      { rootMargin: "0px 0px -22% 0px", threshold: 0 },
    );
    below.forEach((s) => observer.observe(s));

    return () => {
      observer.disconnect();
      timers.forEach((t) => window.clearTimeout(t));
      parts.forEach((found, section) => {
        delete section.dataset.assemble;
        found.forEach((el) => {
          delete el.dataset.part;
          el.style.removeProperty("--part-i");
        });
      });
      delete root.dataset.revealArmed;
    };
  }, []);

  return null;
}
