"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

import { LogoMark } from "@/features/site/logo-mark";

/** sessionStorage key: the loader has been seen in this browser session. */
const SEEN_KEY = "sam:loader-seen";
/** Fired on `window` when the loader has handed over to the page (the hero waits for it). */
export const LOADER_DONE_EVENT = "sam:loader-done";

/** Never shorter than this, so the mark registers; never longer than the cap, whatever the load. */
const MIN_MS = 900;
const MAX_MS = 2600;
/** Once the mark has arrived it stays on screen at least this long, so it is never a flash. */
const MARK_MS = 700;
/**
 * The cap when the mark itself is late: the loader never waits past this, so the hero (which
 * starts on its own at 4.5 s) and the CSS failsafe (5 s) are never reached while it is up.
 */
const HARD_MS = 3200;
/** How long the curtain takes to part into the letterbox bars (matches the CSS transition). */
const PART_MS = 1000;

/**
 * Runs during HTML parsing, before the first paint: it decides whether this visit shows the loader
 * at all, so a returning visitor (or reduced motion) never sees the curtain flash before React
 * hydrates. The decision lives on <html data-loader="active|skip|done">.
 */
const DECIDE = `(function(){var d=document.documentElement,s=null;try{s=sessionStorage.getItem(${JSON.stringify(SEEN_KEY)})}catch(e){s="1"}var r=window.matchMedia&&matchMedia("(prefers-reduced-motion: reduce)").matches;d.setAttribute("data-loader",s||r?"skip":"active")})();`;

/**
 * The home page loader (Concept 03, option B), shown once per browser session.
 *
 * The ink curtain carries the official mark, the wordmark and a gold progress hairline. When the
 * page is ready it parts into two bars that become the hero's own letterbox, and the hero's
 * entrance takes over from there (`hero-reel.tsx` waits for {@link LOADER_DONE_EVENT}). Without
 * JavaScript the loader never covers the page (`@media (scripting: none)` and a CSS failsafe).
 */
export function Preloader(): ReactNode {
  const [state, setState] = useState<"load" | "part" | "done">("load");
  const fill = useRef<HTMLElement>(null);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const html = document.documentElement;
    if (html.dataset.loader !== "active") {
      setState("done");
      return;
    }

    html.style.overflow = "hidden";
    const started = performance.now();
    const timers: number[] = [];
    let pct = 0;
    let finished = false;
    const grow = window.setInterval(() => {
      pct = Math.min(92, pct + 8 + Math.random() * 14);
      if (fill.current) fill.current.style.width = `${pct}%`;
    }, 110);

    const finish = (): void => {
      if (finished) return;
      finished = true;
      window.clearInterval(grow);
      if (fill.current) fill.current.style.width = "100%";
      timers.push(
        window.setTimeout(() => {
          html.style.overflow = "";
          setState("part");
          timers.push(
            window.setTimeout(() => {
              setState("done");
              html.dataset.loader = "done";
              try {
                sessionStorage.setItem(SEEN_KEY, "1");
              } catch {
                /* Storage unavailable (private mode): the loader simply shows on the next visit. */
              }
              window.dispatchEvent(new Event(LOADER_DONE_EVENT));
            }, PART_MS),
          );
        }, 240),
      );
    };

    // Two conditions before the curtain parts: the page is ready (or the cap has passed), and the
    // mark has been on screen for a moment. The loader exists to show the mark, so it waits for it.
    let pageReady = false;
    let markAt: number | null = null;
    const check = (): void => {
      if (!pageReady || markAt === null) return;
      const now = performance.now();
      const wait = Math.max(240, MIN_MS - (now - started), MARK_MS - (now - markAt));
      timers.push(window.setTimeout(finish, wait));
    };
    const onPage = (): void => {
      if (pageReady) return;
      pageReady = true;
      check();
    };
    const onMark = (): void => {
      if (markAt !== null) return;
      markAt = performance.now();
      check();
    };

    const mark = root.current?.querySelector("img");
    if (!mark || (mark.complete && mark.naturalWidth > 0)) onMark();
    else {
      mark.addEventListener("load", onMark, { once: true });
      mark.addEventListener("error", onMark, { once: true });
    }
    if (document.readyState === "complete") onPage();
    else window.addEventListener("load", onPage, { once: true });
    timers.push(window.setTimeout(onPage, MAX_MS));
    timers.push(window.setTimeout(finish, HARD_MS));

    return () => {
      window.clearInterval(grow);
      timers.forEach(window.clearTimeout);
      window.removeEventListener("load", onPage);
      mark?.removeEventListener("load", onMark);
      mark?.removeEventListener("error", onMark);
      html.style.overflow = "";
    };
  }, []);

  return (
    <>
      <script dangerouslySetInnerHTML={{ __html: DECIDE }} />
      {state !== "done" && (
        <div className="fs-loader" data-state={state} aria-hidden="true" ref={root}>
          <span className="fs-loader-half fs-loader-half--top" />
          <span className="fs-loader-half fs-loader-half--bottom" />
          <div className="fs-loader-in">
            <LogoMark height={38} priority />
            <span className="fs-loader-txt">SAM GROUP</span>
            <i className="fs-loader-bar">
              <b ref={fill} />
            </i>
          </div>
        </div>
      )}
    </>
  );
}
