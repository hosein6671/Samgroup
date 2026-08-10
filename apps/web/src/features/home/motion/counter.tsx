"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

/**
 * A figure that counts up once, when it is first seen.
 *
 * **The final value is server-rendered.** It starts at the real number and only drops to zero
 * after mount, so the page is correct before hydration, correct without JavaScript, and correct
 * for a crawler reading the markup. Under reduced motion it simply never animates.
 *
 * Counting once and unobserving matters as much as the easing: a figure that re-counts every
 * time it scrolls back into view reads as a widget, not as a fact.
 */
export function Counter({
  value,
  suffix = "",
  className,
}: {
  readonly value: number;
  readonly suffix?: string;
  readonly className?: string;
}): ReactNode {
  const ref = useRef<HTMLElement>(null);
  const [display, setDisplay] = useState(value);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    setDisplay(0);
    let frame = 0;

    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((e) => e.isIntersecting)) return;
        observer.disconnect();
        const t0 = performance.now();
        const tick = (now: number): void => {
          const p = Math.min(1, (now - t0) / 1600);
          const eased = 1 - Math.pow(1 - p, 3);
          setDisplay(Math.round(value * eased));
          if (p < 1) frame = requestAnimationFrame(tick);
        };
        frame = requestAnimationFrame(tick);
      },
      { threshold: 0.5 },
    );

    observer.observe(node);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
    };
  }, [value]);

  return (
    <b ref={ref} className={className}>
      {display >= 1000 ? display.toLocaleString("en-US") : display}
      {suffix}
    </b>
  );
}
