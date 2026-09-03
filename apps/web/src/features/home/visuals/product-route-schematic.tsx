import type { ReactNode } from "react";

import {
  BaseStockIcon,
  BlendIcon,
  DestinationIcon,
  GradeIcon,
  PackagingIcon,
  QualityIcon,
} from "@/features/site/icons";

import { HERO_ROUTE, type RouteStep } from "../home-data";

/**
 * The hero's product-route schematic.
 *
 * ── What it is for ───────────────────────────────────────────────────────────────────────────
 *
 * The hero is `min-height: 100svh` with its copy bottom-aligned, so every pixel of surplus
 * viewport height collected into one dead band. Measured before this component existed: **348px
 * of empty space above the eyebrow at 1478x914, 505px at 1920x1080**, and a 440x736 empty region
 * in columns 9-12 above the specification panel — about 22% ink coverage on the hero body. This
 * fills the tall right-hand column with the one thing a petroleum buyer arrives wanting to know:
 * what SAM Group actually does to a barrel, in order — six stages, matching the supply chain the
 * workbook's `EXPORT & LOGISTICS` sheet sets out.
 *
 * ── Why it is built from DOM rather than drawn as an SVG ─────────────────────────────────────
 *
 * The obvious way to draw a schematic is one inline `<svg>` with a `viewBox`, which is how the
 * manufacturing journey's illustrations are authored. That approach has a defect this component
 * must not repeat: **text inside a `viewBox` is sized in user units and then scaled by the
 * viewport transform**, so its rendered size is a function of the container's width. The journey's
 * art declares `font-size="8.5"` and measures 13.1px at 1440 and under 12px on a narrow column —
 * the only text left on the public site that breaks the 12px floor (DESIGN_SYSTEM 7.1, ADR-022
 * 4.6).
 *
 * Built from elements instead, every label is real text at `--fs-text-technical` — 12px at every
 * width, selectable, translatable, and inside the type scale rather than beside it. Only the
 * connector rules and the node plates are drawn, and neither carries a glyph.
 *
 * ── Decorative, in the precise sense ─────────────────────────────────────────────────────────
 *
 * The whole block is `aria-hidden`. That is not a shortcut around labelling it: the six stages
 * restate the route the page already describes in the lead paragraph and lays out at length in
 * the Journey section further down. Nothing here is the only place a fact appears, so exposing it
 * again would make a screen reader read the same route twice before reaching the call to action.
 *
 * ── Not shown below 1180px ───────────────────────────────────────────────────────────────────
 *
 * At that width `.fs-hero-side` stops being a rail and stacks under the copy, where a six-step
 * vertical route would push the specification panel and both calls to action below the fold. The
 * hero's dead band is already only its 104px padding at that width, so there is nothing to fill.
 */

const GLYPHS: Record<RouteStep["icon"], (props: { readonly size: "lg" }) => ReactNode> = {
  "base-stock": BaseStockIcon,
  blend: BlendIcon,
  grade: GradeIcon,
  quality: QualityIcon,
  packaging: PackagingIcon,
  destination: DestinationIcon,
};

export function ProductRouteSchematic(): ReactNode {
  return (
    <div className="fs-route" aria-hidden="true">
      <p className="fs-route-head">Product route</p>

      <ol className="fs-route-list">
        {HERO_ROUTE.map((step) => {
          const Glyph = GLYPHS[step.icon];

          return (
            <li className="fs-route-step" key={step.index}>
              <span className="fs-route-node">
                <Glyph size="lg" />
              </span>
              <span className="fs-route-copy">
                <span className="fs-route-index fs-tnum">{step.index}</span>
                <span className="fs-route-name">{step.name}</span>
                <span className="fs-route-detail">{step.detail}</span>
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
