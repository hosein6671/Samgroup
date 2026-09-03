"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

import { BrandedPhoto } from "../branded-photo";
import { HQ, HUBS, LAND, NETWORK_STATS } from "../home-data";
import { useCanvas } from "../motion/use-canvas";

/**
 * 5 · Global export network.
 *
 * ── Restored, with its data brought in line ────────────────────────────────────────────────
 *
 * This section was removed with the Home-page realignment — the workbook has no segment for it —
 * and the owner asked for it back. The construction below is unchanged. Its **destinations** are
 * not: thirteen named ports with invented transit times became the three regions the workbook’s
 * `Notes` sheet names, drawn as six points. See `HUBS` in `home-data.ts`. Nothing on this map is
 * labelled "illustrative" any more, because nothing on it is.
 *
 * A dot-matrix world with animated lanes departing one complex. Continents are coarse polygons
 * rasterised by point-in-polygon at ~2° — so the dots visibly *are* the drawing's precision,
 * which is more honest than a traced coastline that is wrong at the third decimal.
 *
 * Rendered to canvas rather than SVG because the dot count runs to a few thousand: as SVG that
 * is a few thousand DOM nodes and a layout the browser has to maintain, against one draw call
 * per frame here.
 *
 * **Hovering a hub is an enhancement, not the content.** Every lane is also listed as text in
 * the HUD chip and the stats grid below, so nothing is reachable only by pointer.
 */
/*
 * The map's palette, named once.
 *
 * Canvas cannot read a CSS custom property, so these are the only place the Flagship values are
 * written as literals on this surface — and writing them once is what stops a sixth shade
 * appearing the next time a stroke is tuned.
 *
 * They replace the approved prototype's BLUE accent — #7FA8FF and rgba(127,168,255,…) — which is
 * in neither the Flagship palette nor the documented system. ADR-022 §1 records the public
 * identity as dark navy with brass/gold as the accent; a cornflower-blue route map reads as a
 * different brand sitting inside this one.
 */
const GOLD_2 = "#e3c689"; /* --fs-gold-2 */
const STEEL_2 = "#98a3b4"; /* --fs-steel-2 */
const LANE = "rgba(152, 163, 180, 0.26)"; /* --fs-steel-2, at the alpha the blue lane used */
const LANE_RING = "rgba(152, 163, 180, 0.3)";
const LAND_DOT = "rgba(152, 163, 180, 0.3)";

export function Network(): ReactNode {
  const [hover, setHover] = useState(-1);
  const hoverRef = useRef(-1);
  hoverRef.current = hover;

  const dots = useRef<{ x: number; y: number }[]>([]);
  const hubPx = useRef<{ x: number; y: number }[]>([]);
  const hqPx = useRef({ x: 0, y: 0 });
  const size = useRef({ w: 0, h: 0 });

  /*
   * The interaction verb follows the input device, not the viewport: a small laptop still
   * hovers, and a large tablet still taps, so `pointer: coarse` is the question actually being
   * asked. Re-evaluated live, so plugging in a mouse changes the wording rather than leaving
   * it lying.
   */
  const [verb, setVerb] = useState("Hover");
  useEffect(() => {
    const coarse = window.matchMedia("(pointer: coarse)");
    const apply = (): void => setVerb(coarse.matches ? "Tap" : "Hover");
    apply();
    coarse.addEventListener("change", apply);
    return () => coarse.removeEventListener("change", apply);
  }, []);

  /*
   * The plate is taller on small screens. At 0.5 the map was 174px high on a 390px viewport —
   * too little for the routes to separate, and the HUD and legend sat on top of most of it.
   * A taller ratio gives the corridors room without changing anything on desktop.
   */
  const [aspect, setAspect] = useState(0.5);
  useEffect(() => {
    const narrow = window.matchMedia("(max-width: 700px)");
    const apply = (): void => setAspect(narrow.matches ? 0.72 : 0.5);
    apply();
    narrow.addEventListener("change", apply);
    return () => narrow.removeEventListener("change", apply);
  }, []);

  const LON0 = -180;
  const LON1 = 180;
  const LAT0 = -58;
  const LAT1 = 80;

  const ref = useCanvas(
    ({ ctx, w, h, time }) => {
      const t = time * 0.21;
      ctx.clearRect(0, 0, w, h);

      const r = w < 700 ? 1 : 1.3;
      ctx.fillStyle = LAND_DOT;
      for (const d of dots.current) {
        ctx.beginPath();
        ctx.arc(d.x, d.y, r, 0, 6.2832);
        ctx.fill();
      }

      const hq = hqPx.current;
      hubPx.current.forEach((hb, i) => {
        // Control point offset perpendicular to the chord — a great circle on a flat plate.
        const mx = (hq.x + hb.x) / 2;
        const my = (hq.y + hb.y) / 2;
        const dx = hb.x - hq.x;
        const dy = hb.y - hq.y;
        const cx = mx - dy * 0.22;
        const cy = my + dx * 0.22;
        const on = i === hoverRef.current;

        ctx.beginPath();
        ctx.moveTo(hq.x, hq.y);
        ctx.quadraticCurveTo(cx, cy, hb.x, hb.y);
        ctx.strokeStyle = on ? "rgba(227, 198, 137, 0.85)" : LANE;
        ctx.lineWidth = on ? 1.6 : 0.9;
        ctx.stroke();

        // A consignment travelling the lane. Each starts out of phase so the set reads as
        // traffic rather than as a metronome.
        const p = (t * (0.7 + (i % 4) * 0.09) + i * 0.13) % 1;
        const u = 1 - p;
        const px = u * u * hq.x + 2 * u * p * cx + p * p * hb.x;
        const py = u * u * hq.y + 2 * u * p * cy + p * p * hb.y;
        const glow = ctx.createRadialGradient(px, py, 0, px, py, 9);
        glow.addColorStop(0, "rgba(227,198,137,.95)");
        glow.addColorStop(1, "rgba(227,198,137,0)");
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(px, py, 9, 0, 6.2832);
        ctx.fill();
      });

      hubPx.current.forEach((hb, i) => {
        const on = i === hoverRef.current;
        ctx.beginPath();
        ctx.arc(hb.x, hb.y, on ? 5.5 : 3.4, 0, 6.2832);
        ctx.fillStyle = on ? GOLD_2 : STEEL_2;
        ctx.fill();
        ctx.beginPath();
        ctx.arc(hb.x, hb.y, on ? 12 : 8, 0, 6.2832);
        ctx.strokeStyle = on ? "rgba(227, 198, 137, 0.6)" : LANE_RING;
        ctx.lineWidth = 1;
        ctx.stroke();
        // Labels only where there is room for them, or on the hovered hub.
        if (on || w > 900) {
          ctx.font = "500 9.5px var(--font-mono-src), monospace";
          ctx.fillStyle = on ? "rgba(255,255,255,.95)" : "rgba(214,222,238,.42)";
          ctx.fillText((HUBS[i]?.n ?? "").toUpperCase(), hb.x + 13, hb.y + 3.5);
        }
      });

      /*
       * The lanes converge here, and **nothing is painted to say what is here.**
       *
       * This point used to carry a gold pulsing marker with the canvas text "SAM GROUP COMPLEX"
       * beside it, and the legend below named the same swatch "Manufacturing complex". That is a
       * facility-location claim — the identical one removed from the footer in this pass — and it
       * survived the earlier rendered scans precisely because canvas text is painted rather than
       * put in the DOM, so grepping the HTML could never see it.
       *
       * Removed rather than relabelled, and **not** moved to another location. The origin is now
       * only what the geometry needs: the point the lanes are drawn from. A convergence point in a
       * lane diagram asserts no ownership, names no site, and carries no marker distinguishing it
       * from the drawing.
       */
    },
    {
      aspect,
      onResize: (w, h) => {
        size.current = { w, h };
        const proj = (lon: number, lat: number): { x: number; y: number } => ({
          x: ((lon - LON0) / (LON1 - LON0)) * w,
          y: ((LAT1 - lat) / (LAT1 - LAT0)) * h,
        });
        const inPoly = (
          lon: number,
          lat: number,
          poly: readonly (readonly [number, number])[],
        ): boolean => {
          let c = false;
          for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
            const a = poly[i];
            const b = poly[j];
            if (!a || !b) continue;
            if (
              a[1] > lat !== b[1] > lat &&
              lon < ((b[0] - a[0]) * (lat - a[1])) / (b[1] - a[1]) + a[0]
            ) {
              c = !c;
            }
          }
          return c;
        };

        const step = w < 700 ? 2.2 : 1.9;
        const next: { x: number; y: number }[] = [];
        for (let lon = LON0; lon <= LON1; lon += step) {
          for (let lat = LAT0; lat <= LAT1; lat += step) {
            if (LAND.some((poly) => inPoly(lon, lat, poly))) next.push(proj(lon, lat));
          }
        }
        dots.current = next;
        hqPx.current = proj(HQ.lon, HQ.lat);
        hubPx.current = HUBS.map((hb) => proj(hb.lon, hb.lat));
      },
    },
  );

  /**
   * Nearest hub under the pointer. `slack` is wider for touch, because a finger is not a
   * cursor and the markers are 3.4px — without it the map is effectively inert on a phone.
   */
  const pick = (clientX: number, clientY: number, el: HTMLCanvasElement, slack: number): number => {
    const rect = el.getBoundingClientRect();
    const mx = clientX - rect.left;
    const my = clientY - rect.top;
    let best = -1;
    let bd = slack;
    hubPx.current.forEach((hb, i) => {
      const d = Math.hypot(hb.x - mx, hb.y - my);
      if (d < bd) {
        bd = d;
        best = i;
      }
    });
    return best;
  };

  const onMove = (e: React.MouseEvent<HTMLCanvasElement>): void => {
    const best = pick(e.clientX, e.clientY, e.currentTarget, 22);
    if (best !== hover) setHover(best);
  };

  /* Touch has no hover, so a tap selects the nearest hub and the HUD chip reads its lane. */
  const onTap = (e: React.PointerEvent<HTMLCanvasElement>): void => {
    if (e.pointerType === "mouse") return;
    const best = pick(e.clientX, e.clientY, e.currentTarget, 34);
    setHover(best);
  };

  const hovered = hover >= 0 ? HUBS[hover] : null;

  return (
    <section className="fs-sec fs-globe" id="network" data-surface="midnight">
      <div className="fs-wrap">
        <div className="fs-globe-head fs-section-head fs-rv">
          <div>
            <div className="fs-eyebrow">Export enquiry and logistics planning</div>
            <h2 className="fs-d2" style={{ marginTop: 22, maxWidth: "22ch" }}>
              Define the product. Prepare the shipment brief.
            </h2>
          </div>
          <p className="fs-lead" style={{ maxWidth: "36ch" }}>
            Bring the grade, required quantity, packaging format, destination, and preferred trade
            term into the same conversation.{" "}
            {/* Explicit space: JSX trims the whitespace before an expression, which ran the
                sentences together as "sales map.Tap a hub". */}
            {verb} a destination to read it.
          </p>
        </div>

        <BrandedPhoto
          src="/images/home/network-export-logistics.webp"
          alt="Sealed lubricant drums and an IBC prepared beside a shipping container"
          caption="Product packaging and export preparation"
          className="fs-network-photo fs-rv"
          sizes="(max-width: 700px) calc(100vw - 32px), calc(100vw - 128px)"
        />

        <div className="fs-map-shell fs-rv">
          <div className="fs-map-hud">
            <span className="fs-hud-chip">Product + grade</span>
            <span className="fs-hud-chip">Packaging + destination</span>
            <span className="fs-hud-chip" aria-live="polite">
              {hovered ? (
                <>
                  <b>{hovered.n}</b> · {hovered.lane}
                </>
              ) : (
                <span>{verb} a destination</span>
              )}
            </span>
          </div>

          <canvas
            ref={ref}
            onMouseMove={onMove}
            onPointerDown={onTap}
            onMouseLeave={() => setHover(-1)}
            /*
             * Describes the drawing, and names no facility. It previously read "Sam Group export
             * routes from the Persian Gulf to hubs across…", which asserted both a named production
             * site and a served-market list.
             *
             * It then read "Illustrative world map … the routes, hubs and transit times shown are
             * placeholder data", which was true of the thirteen invented ports it was drawing and
             * was the honest label for them. **Both the hedge and the reason for it are gone**: the
             * destinations are now the three regions the workbook's `Notes` sheet names, so the
             * label states what the map shows instead of apologising for it.
             */
            aria-label="World map marking the regions SAM Group exports to: Türkiye, the countries around India, and Africa. Every destination is listed as text beneath the map."
            role="img"
          />

          {/*
           * The "Manufacturing complex" row is gone with the marker it described — it was the DOM
           * half of the same facility claim the canvas was painting. Two rows remain, and both
           * describe marks that are still drawn.
           */}
          <div className="fs-map-legend">
            <span className="fs-lg">
              <i style={{ background: STEEL_2 }} />
              <span>Export destination</span>
            </span>
            <span className="fs-lg">
              <i style={{ background: "rgba(199,205,214,.5)" }} />
              <span>Route drawn to destination</span>
            </span>
          </div>
        </div>

        <div className="fs-globe-stats fs-rv">
          {NETWORK_STATS.map((s) => (
            <div className="fs-gs" key={s.label}>
              <b className="fs-tnum">{s.value}</b>
              <span>{s.label}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
