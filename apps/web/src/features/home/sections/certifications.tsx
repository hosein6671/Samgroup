import type { ReactNode } from "react";

import { CERTS } from "../home-data";

/**
 * The certification marquee — a seam between the hero and the manufacturing story.
 *
 * The list is duplicated once and the track translated by exactly −50%, which is what makes the
 * loop seamless: at the end of the cycle the second copy sits precisely where the first began.
 * It pauses on hover, so a reader who wants to actually read a standard can.
 *
 * `aria-hidden` on the duplicate: the marks are announced once, not twice. The whole strip is
 * decorative reinforcement — every standard here appears again as text in the sections below.
 */
export function Certifications(): ReactNode {
  const badge = (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      aria-hidden="true"
    >
      <path d="M12 2l7 3v7c0 5-3 8.5-7 10-4-1.5-7-5-7-10V5z" />
      <path d="M9 12l2 2 4-4" />
    </svg>
  );

  return (
    <div className="fs-certs" data-surface="midnight" aria-label="Certifications and standards">
      <div className="fs-certs-track">
        {CERTS.map((c) => (
          <span className="fs-cert" key={c}>
            {badge}
            {c}
          </span>
        ))}
        <span aria-hidden="true" style={{ display: "contents" }}>
          {CERTS.map((c) => (
            <span className="fs-cert" key={`dup-${c}`}>
              {badge}
              {c}
            </span>
          ))}
        </span>
      </div>
    </div>
  );
}
