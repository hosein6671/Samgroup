"use client";

import { useEffect, useRef, type ReactNode } from "react";

import { useCanvas } from "../motion/use-canvas";

/**
 * The hero's metallic oil flow.
 *
 * Three layers painted in order: a deep metallic ground, five viscous bands whose crests travel
 * at different rates, and a field of filaments drawn as fading gradient strokes. A specular
 * sheen over the whole thing tracks the pointer, which is what stops the surface reading as a
 * flat illustration.
 *
 * **Scroll drives the fluid.** Scroll velocity feeds a decaying term into the time step, so
 * moving down the page pushes the oil rather than playing over the top of it. That detail is
 * most of why the hero reads as a material rather than as a video loop.
 *
 * 2D canvas rather than WebGL, deliberately: this is the first viewport on a site served from
 * one VPS with no CDN (ADR-005), and a few hundred stroked paths cost a fraction of what
 * initialising a WebGL context and shipping a 3D runtime would on the critical path.
 */
type Stream = {
  y: number;
  amp: number;
  len: number;
  sp: number;
  ph: number;
  x: number;
  wgt: number;
  gold: boolean;
};

export function OilField(): ReactNode {
  const streams = useRef<Stream[]>([]);
  const pointer = useRef({ x: 0.5, y: 0.5 });
  const velocity = useRef(0);
  const clock = useRef(0);

  const ref = useCanvas(
    ({ ctx, w, h, reduced }) => {
      // The velocity term decays every frame, so a flick accelerates the field and it settles.
      velocity.current *= 0.93;
      clock.current += reduced ? 0 : 0.0055 * (1 + velocity.current);
      const t = clock.current;
      const { x: mx, y: my } = pointer.current;

      ctx.clearRect(0, 0, w, h);

      const ground = ctx.createLinearGradient(0, 0, w, h);
      ground.addColorStop(0, "#04102E");
      ground.addColorStop(0.5, "#061346");
      ground.addColorStop(1, "#030B1F");
      ctx.fillStyle = ground;
      ctx.fillRect(0, 0, w, h);

      for (let b = 0; b < 5; b++) {
        ctx.beginPath();
        const base = h * (0.28 + b * 0.14);
        for (let x = 0; x <= w; x += 14) {
          const y =
            base +
            Math.sin(x * 0.0026 + t * 1.5 + b) * (26 + b * 9) +
            Math.sin(x * 0.0072 - t * 2.1 + b * 1.7) * 11 +
            (mx - 0.5) * 34 * Math.sin(x * 0.002 + b);
          if (x === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.lineTo(w, h);
        ctx.lineTo(0, h);
        ctx.closePath();
        const band = ctx.createLinearGradient(0, base - 70, 0, h);
        // One band in gold: a single warm seam through cold navy reads as refined product.
        band.addColorStop(0, b === 2 ? "rgba(195,154,78,.10)" : "rgba(18,41,110,.16)");
        band.addColorStop(1, "rgba(3,11,31,0)");
        ctx.fillStyle = band;
        ctx.fill();
      }

      for (const s of streams.current) {
        if (!reduced) {
          s.x += s.sp;
          if (s.x - s.len > w) {
            s.x = -s.len;
            s.y = Math.random() * h;
          }
        }
        ctx.beginPath();
        for (let i = 0; i <= s.len; i += 10) {
          const x = s.x - i;
          // Amplitude decays along the filament, so it tapers into the ground rather than
          // ending on a hard edge.
          const y =
            s.y + Math.sin(i * 0.014 + t * 2.4 + s.ph) * s.amp * (1 - i / s.len) + (my - 0.5) * 20;
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        const grad = ctx.createLinearGradient(s.x - s.len, 0, s.x, 0);
        grad.addColorStop(0, "rgba(199,205,214,0)");
        grad.addColorStop(1, s.gold ? "rgba(227,198,137,.5)" : "rgba(199,205,214,.26)");
        ctx.strokeStyle = grad;
        ctx.lineWidth = s.wgt;
        ctx.stroke();
      }

      const sx = w * (0.2 + mx * 0.6);
      const sy = h * (0.15 + my * 0.3);
      const sheen = ctx.createRadialGradient(sx, sy, 0, sx, sy, Math.max(w, h) * 0.55);
      sheen.addColorStop(0, "rgba(227,198,137,.11)");
      sheen.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = sheen;
      ctx.fillRect(0, 0, w, h);
    },
    {
      onResize: (w, h) => {
        streams.current = Array.from({ length: 46 }, () => ({
          y: Math.random() * h,
          amp: 12 + Math.random() * 46,
          len: 120 + Math.random() * 380,
          sp: 0.18 + Math.random() * 0.7,
          ph: Math.random() * Math.PI * 2,
          x: Math.random() * w,
          wgt: 0.4 + Math.random() * 1.6,
          // Roughly one filament in five catches the light.
          gold: Math.random() > 0.78,
        }));
      },
    },
  );

  /*
   * Pointer and scroll are read from the window rather than the canvas: the sheen should follow
   * the cursor anywhere in the hero, including over the headline and buttons that sit above the
   * canvas in the stacking order and would otherwise swallow the events.
   */
  useEffect(() => {
    let lastY = window.scrollY;
    const onMove = (e: MouseEvent): void => {
      pointer.current = { x: e.clientX / window.innerWidth, y: e.clientY / window.innerHeight };
    };
    const onScroll = (): void => {
      const y = window.scrollY;
      velocity.current = Math.min(2.2, velocity.current + Math.abs(y - lastY) / 90);
      lastY = y;
    };
    window.addEventListener("mousemove", onMove, { passive: true });
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("scroll", onScroll);
    };
  }, []);

  return <canvas ref={ref} aria-hidden="true" />;
}
