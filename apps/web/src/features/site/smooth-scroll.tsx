"use client";

import Lenis from "lenis";
import { usePathname } from "next/navigation";
import { useEffect, useRef, type ReactNode } from "react";

/**
 * Inertial wheel scrolling for the public site (Lenis).
 *
 * Lenis eases the page's real scroll position toward where the wheel sent it, so everything that
 * reads the scroll — the pinned formulation track, the reveal engine's observers, sticky chrome —
 * keeps working unchanged. Touch keeps the device's own scrolling (`syncTouch` stays off), reduced
 * motion turns the smoothing off (`respectReducedMotion`), and a scrollable element under the
 * pointer scrolls itself (`allowNestedScroll`).
 *
 * Two hand-offs:
 * - **Scroll locks.** The nav drawer and the home page loader lock the page by setting
 *   `overflow: hidden` on <html>. Lenis would otherwise keep scrolling the page behind them, so it
 *   is paused for exactly as long as that lock is in place.
 * - **Navigation.** A link to another page stops any glide in progress, and on arrival Lenis takes
 *   the position the router left (the top of the new page) instead of gliding back to the old one.
 *
 * Photographs (`.fs-photo`, `.fs-branded-photo`) also drift slightly inside their frames as the page
 * scrolls — a parallax that gives the page depth — except under reduced motion.
 *
 * Mounted in the `[locale]` root layout only; the Admin Dashboard scrolls natively.
 */

/** Exponential ease-out: a quick response to the wheel, then a long, settling glide. */
const expoOut = (t: number): number => Math.min(1, 1.001 - Math.pow(2, -10 * t));

/** Photographs that drift inside their frames as the page scrolls. */
const PARALLAX_FRAMES = ".fs-photo, .fs-branded-photo";

export function SmoothScroll(): ReactNode {
  const lenis = useRef<Lenis | null>(null);
  const pathname = usePathname();

  useEffect(() => {
    const instance = new Lenis({
      autoRaf: true,
      allowNestedScroll: true,
      stopInertiaOnNavigate: true,
      duration: 1.2,
      easing: expoOut,
    });
    lenis.current = instance;

    const html = document.documentElement;
    const sync = (): void => {
      if (html.style.overflow === "hidden") instance.stop();
      else instance.start();
    };
    sync();
    const lock = new MutationObserver(sync);
    lock.observe(html, { attributes: true, attributeFilter: ["style"] });

    // Parallax: each photograph shifts up to ±6% of its frame's height, centred when the frame is
    // centred in the viewport. Only frames on screen are written, once per animation frame.
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const drift = (): void => {
      const vh = window.innerHeight;
      document.querySelectorAll<HTMLElement>(PARALLAX_FRAMES).forEach((frame) => {
        const r = frame.getBoundingClientRect();
        if (r.bottom < -100 || r.top > vh + 100) return;
        const p = (r.top + r.height / 2 - vh / 2) / (vh / 2 + r.height / 2);
        frame.style.setProperty("--fs-par", `${(Math.max(-1, Math.min(1, p)) * 6).toFixed(2)}%`);
      });
    };
    let queued = 0;
    const onScroll = (): void => {
      if (!queued) queued = requestAnimationFrame(() => ((queued = 0), drift()));
    };
    if (!reduce) {
      html.classList.add("fs-parallax");
      window.addEventListener("scroll", onScroll, { passive: true });
      window.addEventListener("resize", onScroll, { passive: true });
      drift();
    }

    return () => {
      lock.disconnect();
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      cancelAnimationFrame(queued);
      html.classList.remove("fs-parallax");
      instance.destroy();
      lenis.current = null;
    };
  }, []);

  useEffect(() => {
    lenis.current?.scrollTo(window.scrollY, { immediate: true, force: true });
    // The new page's photographs take their parallax position before the curtain lifts.
    window.dispatchEvent(new Event("scroll"));
  }, [pathname]);

  return null;
}
