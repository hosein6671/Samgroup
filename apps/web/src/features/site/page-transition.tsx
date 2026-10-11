"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";

import { transitionTarget } from "./page-transition-target";

import "../home/flagship.css";

/** How long the curtain takes to come down (matches the CSS transition, plus a frame). */
const COVER_MS = 720;
/** A breath on the new page, covered, before the curtain carries on down. */
const HOLD_MS = 90;
/** How long the curtain takes to leave from the bottom (matches the CSS transition, plus a frame). */
const REVEAL_MS = 840;
/** If the new page has not arrived by then, navigate the plain way so the visitor is never stuck. */
const SAFETY_MS = 5000;

type Phase = "idle" | "cover" | "reveal";

/**
 * The public site's page transition (Concept 03, transition 1): an ink curtain comes down over the
 * page, the next page is rendered behind it, and the curtain carries on down and leaves from the
 * bottom. No mark on it — the logo belongs to the home page loader only.
 *
 * It works by intercepting link clicks in the capture phase: `next/link` checks
 * `event.defaultPrevented` before navigating, so preventing the default here holds the navigation
 * back while the curtain comes down, and the router is then asked for the same URL. Which clicks
 * qualify is decided by {@link transitionTarget}; back and forward, reduced motion and anything that
 * is not a plain same-site page link are left untouched. Mounted in the `[locale]` root layout only,
 * so the Admin Dashboard never has it.
 */
export function PageTransition(): ReactNode {
  const router = useRouter();
  const pathname = usePathname();
  const [phase, setPhase] = useState<Phase>("idle");
  const phaseRef = useRef<Phase>("idle");
  const fromPath = useRef<string | null>(null);
  const timers = useRef<number[]>([]);

  const go = (next: Phase): void => {
    phaseRef.current = next;
    setPhase(next);
  };
  const later = (fn: () => void, ms: number): void => {
    timers.current.push(window.setTimeout(fn, ms));
  };

  useEffect(() => {
    const onClick = (event: MouseEvent): void => {
      if (event.defaultPrevented) return;
      const link = event.target instanceof Element ? event.target.closest("a[href]") : null;
      if (!(link instanceof HTMLAnchorElement)) return;

      const target = transitionTarget(
        {
          button: event.button,
          metaKey: event.metaKey,
          ctrlKey: event.ctrlKey,
          shiftKey: event.shiftKey,
          altKey: event.altKey,
          href: link.getAttribute("href"),
          target: link.getAttribute("target"),
          download: link.hasAttribute("download"),
        },
        new URL(window.location.href),
      );
      if (target === null) return;
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

      event.preventDefault();
      // One navigation at a time: a second click while the curtain moves is swallowed.
      if (phaseRef.current !== "idle") return;

      fromPath.current = window.location.pathname;
      // Fetch the next page while the curtain comes down, so it is ready the moment the page is covered.
      router.prefetch(target);
      go("cover");
      later(() => router.push(target), COVER_MS);
      later(() => {
        if (phaseRef.current === "cover") window.location.assign(target);
      }, SAFETY_MS);
    };

    document.addEventListener("click", onClick, true);
    const pending = timers.current;
    return () => {
      document.removeEventListener("click", onClick, true);
      pending.forEach(window.clearTimeout);
    };
    // `router` is stable for the app's lifetime, so the listener is installed once.
  }, []);

  // The new page has rendered behind the curtain: let it go.
  useEffect(() => {
    if (phaseRef.current !== "cover" || pathname === fromPath.current) return;
    fromPath.current = null;
    later(() => {
      go("reveal");
      later(() => go("idle"), REVEAL_MS);
    }, HOLD_MS);
  }, [pathname]);

  return (
    <div className="fs-pt" data-phase={phase} aria-hidden="true">
      <span className="fs-pt-panel" />
    </div>
  );
}
