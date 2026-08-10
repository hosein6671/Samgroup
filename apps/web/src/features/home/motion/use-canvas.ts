"use client";

import { useEffect, useRef, type RefObject } from "react";

/**
 * The lifecycle every canvas on this page shares.
 *
 * Six canvases carry the flagship's atmosphere. Written independently they would each get the
 * same four things subtly wrong, so the rules live here once:
 *
 * 1. **Device pixel ratio is capped at 2.** Uncapped, a 3× phone renders nine times the pixels
 *    for a difference nobody can see on a soft gradient field, and drops frames doing it.
 * 2. **Off-screen canvases do not run.** An IntersectionObserver gates the loop, so the page
 *    never has six requestAnimationFrame loops competing for one main thread — this is the
 *    single largest performance decision on the page.
 * 3. **`prefers-reduced-motion` freezes rather than blanks.** The draw callback still runs once
 *    to paint a composed still frame; it simply stops advancing. Answering the preference with
 *    an empty box would be answering it with less content.
 * 4. **Everything is torn down.** The frame is cancelled, the observer disconnected and the
 *    resize listener removed on unmount — a leaked rAF loop survives client-side navigation
 *    and is invisible until the tab is warm.
 */
export type CanvasPainter = (context: {
  readonly ctx: CanvasRenderingContext2D;
  readonly w: number;
  readonly h: number;
  /** Seconds since the loop started. Frozen at a representative value under reduced motion. */
  readonly time: number;
  readonly reduced: boolean;
}) => void;

export type UseCanvasOptions = {
  /** Called after every resize, before the next paint. Rebuild particle sets here. */
  readonly onResize?: (w: number, h: number, reduced: boolean) => void;
  /** Fixes the canvas height to a ratio of its width. Omit to fill the parent box. */
  readonly aspect?: number;
  /** Paint one frame and stop. For static fields that only need to react to resize. */
  readonly still?: boolean;
};

export function useCanvas(
  paint: CanvasPainter,
  { onResize, aspect, still = false }: UseCanvasOptions = {},
): RefObject<HTMLCanvasElement | null> {
  const ref = useRef<HTMLCanvasElement>(null);
  // Held in refs so a re-render never restarts the loop or drops the particle state.
  const paintRef = useRef(paint);
  paintRef.current = paint;
  const resizeRef = useRef(onResize);
  resizeRef.current = onResize;

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    let w = 0;
    let h = 0;
    let frame = 0;
    let running = false;
    let start = performance.now();

    const measure = (): void => {
      w = canvas.clientWidth;
      h = aspect ? Math.round(w * aspect) : canvas.clientHeight;
      if (aspect) canvas.style.height = `${h}px`;
      if (w === 0 || h === 0) return;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      resizeRef.current?.(w, h, reduced);
    };

    const draw = (now: number): void => {
      if (w > 0 && h > 0) {
        // A representative moment rather than zero: at t=0 most of these fields are a flat
        // gradient, which is not what the composition was designed around.
        const time = reduced ? 8 : (now - start) / 1000;
        paintRef.current({ ctx, w, h, time, reduced });
      }
      if (!still && running) frame = requestAnimationFrame(draw);
    };

    const startLoop = (): void => {
      if (running) return;
      running = true;
      start = performance.now() - 8000 * (reduced ? 1 : 0);
      frame = requestAnimationFrame(draw);
    };
    const stopLoop = (): void => {
      running = false;
      cancelAnimationFrame(frame);
    };

    measure();
    // One frame immediately, so a canvas that is never scrolled into view is still painted
    // rather than a transparent hole in the layout.
    draw(performance.now());

    let resizeTimer = 0;
    const onWindowResize = (): void => {
      window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(() => {
        measure();
        draw(performance.now());
      }, 200);
    };
    window.addEventListener("resize", onWindowResize, { passive: true });

    let observer: IntersectionObserver | null = null;
    if (!still && !reduced) {
      observer = new IntersectionObserver(
        (entries) => {
          if (entries.some((e) => e.isIntersecting)) startLoop();
          else stopLoop();
        },
        { threshold: 0.02 },
      );
      observer.observe(canvas);
    }

    return () => {
      stopLoop();
      observer?.disconnect();
      window.clearTimeout(resizeTimer);
      window.removeEventListener("resize", onWindowResize);
    };
  }, [aspect, still]);

  return ref;
}
