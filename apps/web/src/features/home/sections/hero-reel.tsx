"use client";

import Image from "next/image";
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";

import { Arrow } from "@/features/site/logo-mark";

import { Counter } from "../motion/counter";

/** One shot of the reel, already resolved: the /admin photograph or the built-in one. */
export type ReelShot = {
  readonly name: string;
  readonly src: string;
  readonly focus: string;
  readonly drift: string;
};

export type ReelFact = { readonly value: string; readonly label: string };

/** How long each shot holds before the next one dissolves in. */
const HOLD_MS = 6500;

/**
 * The cinematic hero (Concept 03, option A).
 *
 * Four photographs play as one graded film: a slow push-in on the shot that is on, a soft
 * blur-dissolve to the next every 6.5 s, letterbox bars that open once the page is ready, and a
 * bottom "player bar" carrying the facts and the shot timeline. There is deliberately **no
 * pointer-driven motion** (owner's decision). The reel pauses when the hero is off screen or the
 * tab is hidden, and holds on the first shot under reduced motion.
 *
 * The copy is passed in as `children`, so the text stays a Server Component and only the reel
 * itself ships JavaScript.
 */
export function HeroReel({
  shots,
  facts,
  barTitle,
  exploreLabel,
  exploreHref,
  children,
}: {
  readonly shots: readonly ReelShot[];
  readonly facts: readonly ReelFact[];
  readonly barTitle: string;
  readonly exploreLabel: string;
  readonly exploreHref: string;
  readonly children: ReactNode;
}): ReactNode {
  const ref = useRef<HTMLElement>(null);
  const [on, setOn] = useState(0);
  const [ready, setReady] = useState(false);
  // Shots 2 to 4 load a moment after the first is on screen, so the hero's LCP image never shares
  // bandwidth with photographs that only appear 6.5 s later.
  const [warm, setWarm] = useState(false);

  // Release the entrance (letterbox, headline lines, copy) one frame after mount, so the hidden
  // state is painted first and the transition actually plays.
  useEffect(() => {
    const t = window.setTimeout(() => setReady(true), 60);
    const w = window.setTimeout(() => setWarm(true), 2000);
    return () => {
      window.clearTimeout(t);
      window.clearTimeout(w);
    };
  }, []);

  useEffect(() => {
    const node = ref.current;
    if (!node || shots.length < 2) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let visible = true;
    let timer = 0;
    const run = (): void => {
      window.clearInterval(timer);
      if (visible && !document.hidden)
        timer = window.setInterval(() => setOn((n) => (n + 1) % shots.length), HOLD_MS);
    };
    const io = new IntersectionObserver(([entry]) => {
      visible = entry?.isIntersecting ?? true;
      run();
    });
    io.observe(node);
    document.addEventListener("visibilitychange", run);
    run();
    return () => {
      window.clearInterval(timer);
      io.disconnect();
      document.removeEventListener("visibilitychange", run);
    };
  }, [shots.length]);

  const current = shots[on] ?? shots[0];

  return (
    <section
      ref={ref}
      className="fs-cine"
      id="top"
      data-surface="midnight"
      data-ready={ready ? "true" : undefined}
    >
      <div className="fs-cine-bg" aria-hidden="true">
        {shots.map((shot, i) => (
          <div
            className="fs-cine-shot"
            data-on={i === on ? "true" : undefined}
            key={shot.src + i}
            style={{ "--focus": shot.focus, "--drift": shot.drift } as CSSProperties}
          >
            {(i === 0 || warm) && (
              <Image src={shot.src} alt="" fill sizes="100vw" priority={i === 0} />
            )}
          </div>
        ))}
        <span className="fs-cine-grade" />
        <span className="fs-cine-dof" />
        <span className="fs-cine-sweep" />
        <span className="fs-cine-grain" />
        <span className="fs-cine-vignette" />
      </div>
      <span className="fs-cine-lb fs-cine-lb--top" aria-hidden="true" />
      <span className="fs-cine-lb fs-cine-lb--bottom" aria-hidden="true" />

      <div className="fs-wrap fs-cine-main">{children}</div>

      <div className="fs-cine-bar" aria-label={barTitle}>
        <div className="fs-wrap fs-cine-bar-in">
          <p className="fs-cine-bar-title">{barTitle}</p>
          {facts.length > 0 && (
            <dl className="fs-cine-facts">
              {facts.map((fact, i) => {
                const n = Number(fact.value);
                return (
                  <div key={i}>
                    <dt>{fact.label}</dt>
                    <dd className="fs-tnum">
                      {Number.isInteger(n) && String(n) === fact.value.trim() ? (
                        <Counter value={n} />
                      ) : (
                        fact.value
                      )}
                    </dd>
                  </div>
                );
              })}
            </dl>
          )}
          {shots.length > 1 && current && (
            <div className="fs-cine-reel" aria-hidden="true">
              <span className="fs-cine-reel-label" key={on}>
                {current.name}
              </span>
              <div className="fs-cine-reel-bars">
                {shots.map((shot, i) => (
                  <span
                    key={shot.src + i}
                    data-state={i === on ? "on" : i < on ? "done" : undefined}
                  >
                    <i />
                  </span>
                ))}
              </div>
            </div>
          )}
          <a className="fs-cine-explore" href={exploreHref}>
            {exploreLabel}
            <span className="fs-cine-explore-ar">
              <Arrow size={14} />
            </span>
          </a>
        </div>
      </div>
    </section>
  );
}
