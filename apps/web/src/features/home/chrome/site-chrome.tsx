"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

import { LogoMark } from "./logo-mark";

/**
 * Root-level chrome: the scroll progress bar, the pointer ring, and the boot curtain.
 *
 * All three render nothing meaningful on the server and are purely presentational, so they sit
 * together in one client boundary rather than three.
 */

/** A hairline gold progress bar. Written as a style property, so no re-render per frame. */
export function ScrollProgress(): ReactNode {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const onScroll = (): void => {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      node.style.width = `${max > 0 ? (window.scrollY / max) * 100 : 0}%`;
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return <div ref={ref} className="fs-progress" aria-hidden="true" />;
}

/**
 * The pointer ring — a lagging circle that swells over interactive targets.
 *
 * Gated to fine pointers, so it never appears on touch, and it is `pointer-events: none` with
 * `aria-hidden`, so it is invisible to assistive technology and cannot intercept a click. The
 * lerp is what makes it read as weight rather than as a second cursor glued to the first.
 */
export function PointerRing(): ReactNode {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    if (window.matchMedia("(pointer: coarse)").matches) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let cx = window.innerWidth / 2;
    let cy = window.innerHeight / 2;
    let tx = cx;
    let ty = cy;
    let frame = 0;

    const onMove = (e: MouseEvent): void => {
      tx = e.clientX;
      ty = e.clientY;
    };
    const onOver = (e: MouseEvent): void => {
      const target = e.target;
      node.dataset.big = String(
        target instanceof Element &&
          Boolean(
            target.closest(
              "a, button, .fs-node, .fs-gpanel, .fs-trust-cell, input, select, textarea",
            ),
          ),
      );
    };

    const loop = (): void => {
      cx += (tx - cx) * 0.18;
      cy += (ty - cy) * 0.18;
      node.style.transform = `translate(${cx}px, ${cy}px) translate(-50%, -50%)`;
      frame = requestAnimationFrame(loop);
    };

    window.addEventListener("mousemove", onMove, { passive: true });
    document.addEventListener("mouseover", onOver);
    frame = requestAnimationFrame(loop);

    return () => {
      window.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseover", onOver);
      cancelAnimationFrame(frame);
    };
  }, []);

  return <div ref={ref} className="fs-ring" aria-hidden="true" />;
}

/**
 * The boot curtain.
 *
 * One orchestrated opening instead of eight independent fades: the curtain lifts, and the hero
 * assembles line by line while it is still moving.
 *
 * **It can never trap the page.** Three independent exits — `load`, an immediate path when the
 * document is already complete, and a hard 2.6s ceiling — so a slow font or a stalled image
 * cannot hold the content hostage behind a splash screen. Under reduced motion it does not
 * render at all and the hero is revealed immediately.
 */
export function BootCurtain(): ReactNode {
  const [lifted, setLifted] = useState(false);
  const [gone, setGone] = useState(false);
  const fill = useRef<HTMLBaseElement>(null);

  useEffect(() => {
    const root = document.getElementById("flagship-root");
    const revealHero = (base: number): void => {
      const seq = root?.querySelectorAll<HTMLElement>(".fs-hero .fs-rv-l, .fs-hero .fs-line-mask");
      seq?.forEach((node, i) => {
        const delay = `${base + i * 110}ms`;
        node.style.transitionDelay = delay;
        const inner = node.firstElementChild;
        if (node.classList.contains("fs-line-mask") && inner instanceof HTMLElement) {
          inner.style.transitionDelay = delay;
        }
        node.classList.add("in");
      });
    };

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setGone(true);
      revealHero(0);
      return;
    }

    document.documentElement.style.overflow = "hidden";

    let pct = 0;
    let done = false;
    const grow = window.setInterval(() => {
      pct = Math.min(92, pct + 8 + Math.random() * 14);
      if (fill.current) fill.current.style.width = `${pct}%`;
    }, 110);

    const timers: number[] = [];
    const finish = (): void => {
      if (done) return;
      done = true;
      window.clearInterval(grow);
      if (fill.current) fill.current.style.width = "100%";
      timers.push(
        window.setTimeout(() => {
          setLifted(true);
          document.documentElement.style.overflow = "";
          revealHero(180);
          timers.push(window.setTimeout(() => setGone(true), 1200));
        }, 240),
      );
    };

    const onLoad = (): void => {
      timers.push(window.setTimeout(finish, 240));
    };
    if (document.readyState === "complete") timers.push(window.setTimeout(finish, 420));
    else window.addEventListener("load", onLoad);
    timers.push(window.setTimeout(finish, 2600));

    return () => {
      window.clearInterval(grow);
      timers.forEach(window.clearTimeout);
      window.removeEventListener("load", onLoad);
      document.documentElement.style.overflow = "";
    };
  }, []);

  if (gone) return null;

  return (
    <div className="fs-curtain" data-lift={lifted ? "true" : undefined} aria-hidden="true">
      <div className="fs-curtain-in">
        <LogoMark height={38} priority />
        <span className="fs-curtain-txt">SAM GROUP</span>
        <i className="fs-curtain-bar">
          <b ref={fill} />
        </i>
      </div>
    </div>
  );
}
