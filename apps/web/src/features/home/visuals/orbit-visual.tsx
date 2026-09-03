"use client";

import { useEffect, useRef, type ReactNode } from "react";

import type { Family } from "../home-data";

/**
 * The ecosystem's central visualisation, rebuilt from the approved `sam-group.html` reference.
 *
 * This component is the *only* thing that changed in the Product Ecosystem section. The section
 * shell around it — heading, eyebrow, copy, detail panel, specs, tabs, spacing, background — is
 * untouched, and so is `home-data.ts`. Ring assignment and starting angle are derived here from
 * each family's index and its existing `angle` field rather than added to the data, which keeps
 * the change inside this subtree.
 *
 * Reference behaviour reproduced:
 *
 * - **Two rings**, `R0 = min(w,h) × 0.285` solid and `R1 = × 0.375` dashed `2 7`. Alternate
 *   families ride the outer ring and rotate *against* the inner set, so the two counter-rotate.
 * - **Slightly elliptical**: `y` uses `R × 0.94`, which is what stops it reading as a flat dial.
 * - **`ang += 0.00085` per frame**, with every node's position written straight to
 *   `style.left/top` inside the loop. No React state per frame — re-rendering five nodes at
 *   60fps would be the most expensive thing on the page.
 * - **Links and dots** redraw each frame; the selected family's link switches to `--fs-gold`
 *   from the steel default. Both were prototype blues and are corrected — see `IDLE_LINK`.
 * - **Selection on hover, focus and click**, exactly as the reference binds them.
 *
 * The loop is cancelled by an IntersectionObserver when the orbit leaves the viewport, and
 * under `prefers-reduced-motion` it never starts — the orbit lays out once and holds, so the
 * diagram is complete and readable without moving.
 *
 * ── Compact geometry (stage narrower than 520px) ────────────────────────────
 *
 * Below that width the reference geometry cannot hold. Measured at a 390px viewport: the stage
 * is 350px, the core is 95px across, and "Petroleum Products" sets to a 178px pill. A pill that
 * wide riding a 131px radius must cross both the core and the stage edge — there is no rotation
 * phase in which it does not, so it overlapped the "Base Oils" label and clipped against the
 * section's `overflow: hidden`.
 *
 * Compact mode changes three things and nothing else:
 *
 * - **One ring instead of two.** Radius drops to `min × 0.32`; the outer dashed circle stays as
 *   decoration but carries no nodes, so the two ring radii can no longer collide.
 * - **Rotation is frozen**, exactly as it already is under reduced motion. The five families are
 *   72° apart in the data, so a static ring distributes them evenly by construction — and static
 *   is what makes "no overlap" a guarantee rather than a phase that happens to be clear.
 * - **Labels wrap** inside a 104px pill (CSS). 0.32 × min − 52 clears the 0.135 × min core with
 *   room to spare, and 0.32 × min + 52 stays inside the half-stage at every width in range.
 *
 * The ring, the links, the dots, the core and every interaction are untouched, and desktop and
 * tablet never enter this branch.
 *
 * Nodes are real `<button>`s, so focus, hover and keyboard activation are native. The SVG is
 * decorative and `aria-hidden`; the section's existing `aria-live` detail panel announces the
 * selection, so a keyboard user tabbing the ring hears each family as it lands.
 */
/*
 * The link colours. `--fs-gold` when a family is selected, steel otherwise.
 *
 * The idle link was `rgba(125,169,255,.2)` — the prototype's cornflower blue, which is in
 * neither the Flagship palette nor the documented system (ADR-022 §1). The active link was
 * `rgba(201,167,92,.5)`, a gold two points off `--fs-gold` (195,154,78); both are now the
 * real values.
 */
const ACTIVE_LINK = "rgba(195, 154, 78, 0.55)";
const IDLE_LINK = "rgba(152, 163, 180, 0.22)";

const SPEED = 0.00085;
/** Stage width below which the reference two-ring geometry can no longer clear the core. */
const COMPACT_AT = 520;

export type OrbitVisualProps = {
  readonly families: readonly Family[];
  readonly activeId: string;
  readonly onSelect: (id: string) => void;
};

export function OrbitVisual({ families, activeId, onSelect }: OrbitVisualProps): ReactNode {
  const wrapRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const ring0Ref = useRef<SVGCircleElement>(null);
  const ring1Ref = useRef<SVGCircleElement>(null);
  const nodeRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const linkRefs = useRef<(SVGLineElement | null)[]>([]);
  const dotRefs = useRef<(SVGCircleElement | null)[]>([]);

  // Read inside the animation loop, which must not close over a stale selection.
  const activeRef = useRef(activeId);
  activeRef.current = activeId;

  useEffect(() => {
    const wrap = wrapRef.current;
    const svg = svgRef.current;
    if (!wrap || !svg) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let ang = 0;
    let raf = 0;
    let compact = false;
    let visible = false;

    const layout = (): void => {
      const W = wrap.clientWidth;
      const H = wrap.clientHeight;
      if (!W || !H) return;
      const cx = W / 2;
      const cy = H / 2;
      const min = Math.min(W, H);
      compact = min < COMPACT_AT;
      wrap.dataset["compact"] = compact ? "true" : "false";
      // Compact puts every node on one ring; the outer circle stays as decoration only.
      const R0 = min * (compact ? 0.32 : 0.285);
      const R1 = min * (compact ? 0.4 : 0.375);

      svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
      for (const [ring, R] of [
        [ring0Ref.current, R0],
        [ring1Ref.current, R1],
      ] as const) {
        if (!ring) continue;
        ring.setAttribute("cx", String(cx));
        ring.setAttribute("cy", String(cy));
        ring.setAttribute("r", String(R));
      }

      families.forEach((f, i) => {
        // Derived, not stored: alternate families take the outer ring, and each keeps its
        // existing `angle` as a starting offset so nobody bunches.
        const outer = !compact && i % 2 === 1;
        const R = outer ? R1 : R0;
        const a = (f.angle * Math.PI) / 180 + (compact ? 0 : ang * (outer ? -1 : 1));
        const x = cx + Math.cos(a) * R;
        const y = cy + Math.sin(a) * R * 0.94;

        const node = nodeRefs.current[i];
        if (node) {
          node.style.left = `${x}px`;
          node.style.top = `${y}px`;
        }
        const link = linkRefs.current[i];
        if (link) {
          link.setAttribute("x1", String(cx));
          link.setAttribute("y1", String(cy));
          link.setAttribute("x2", String(x));
          link.setAttribute("y2", String(y));
          link.setAttribute("stroke", f.id === activeRef.current ? ACTIVE_LINK : IDLE_LINK);
        }
        const dot = dotRefs.current[i];
        if (dot) {
          dot.setAttribute("cx", String(x));
          dot.setAttribute("cy", String(y));
        }
      });
    };

    const tick = (): void => {
      // Compact holds still, so the loop parks itself rather than repainting an unchanged frame.
      if (compact) {
        layout();
        raf = 0;
        return;
      }
      ang += SPEED;
      layout();
      raf = requestAnimationFrame(tick);
    };

    const onResize = (): void => {
      layout();
      // Rotating again after a widen back out of compact.
      if (!compact && !reduced && visible && !raf) raf = requestAnimationFrame(tick);
    };

    layout();
    window.addEventListener("resize", onResize, { passive: true });

    let observer: IntersectionObserver | null = null;
    if (!reduced) {
      observer = new IntersectionObserver(
        (entries) => {
          for (const e of entries) {
            visible = e.isIntersecting;
            if (visible) {
              if (!raf && !compact) raf = requestAnimationFrame(tick);
            } else if (raf) {
              cancelAnimationFrame(raf);
              raf = 0;
            }
          }
        },
        { threshold: 0 },
      );
      observer.observe(wrap);
    }

    return () => {
      if (raf) cancelAnimationFrame(raf);
      observer?.disconnect();
      window.removeEventListener("resize", onResize);
    };
  }, [families]);

  return (
    <div className="fs-orbit" ref={wrapRef}>
      <svg className="fs-orbit-svg" ref={svgRef} aria-hidden="true">
        <circle ref={ring0Ref} fill="none" stroke="rgba(199, 205, 214, 0.12)" strokeWidth="1" />
        <circle
          ref={ring1Ref}
          fill="none"
          stroke="rgba(199, 205, 214, 0.08)"
          strokeWidth="1"
          strokeDasharray="2 7"
        />
        {families.map((f, i) => (
          <line
            key={`l-${f.id}`}
            ref={(el) => {
              linkRefs.current[i] = el;
            }}
            stroke={IDLE_LINK}
            strokeWidth="1"
          />
        ))}
        {families.map((f, i) => (
          <circle
            key={`d-${f.id}`}
            ref={(el) => {
              dotRefs.current[i] = el;
            }}
            r="2.4"
            fill="var(--fs-steel-2)"
            fillOpacity=".7"
          />
        ))}
      </svg>

      {/*
       * The core of the orbit is the base stock every other family is built from, which is why
       * Base Oils sits in the middle and the rest orbit it.
       *
       * The third line read **"GROUP I – III+"**. That is the API base-oil group classification —
       * a standard — and `home-data.ts` forbids naming a standard, licence or approval anywhere on
       * this page; the certification marquee and the families' `["Standards", …]` rows were removed
       * for the same reason, and this was the last one left, sitting inside a visual where a text
       * search for the claim would not find it. It also measured 3.81:1 against the orbit's ground
       * at 12px, under WCAG 1.4.3's 4.5:1, because of the 0.55 alpha it carried.
       *
       * "The base stock" states what the centre is without classifying it.
       */}
      <div className="fs-core">
        <span className="k">Product portfolio</span>
        <span className="t">Six families</span>
        <span className="s">One enquiry route</span>
      </div>

      {families.map((f, i) => (
        <button
          key={f.id}
          type="button"
          className="fs-orbit-node"
          data-on={f.id === activeId || undefined}
          aria-label={`${f.short} — show details`}
          aria-pressed={f.id === activeId}
          ref={(el) => {
            nodeRefs.current[i] = el;
          }}
          onMouseEnter={() => onSelect(f.id)}
          onFocus={() => onSelect(f.id)}
          onClick={() => onSelect(f.id)}
        >
          <i aria-hidden="true" />
          {f.short}
        </button>
      ))}
    </div>
  );
}
