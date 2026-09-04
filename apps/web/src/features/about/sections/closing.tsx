import { Arrow } from "@/features/site/logo-mark";
import { contentRouteHref } from "@/features/site/site-routes";

import { ANCHORS } from "../about-anchors";

import type { AboutUsClosing } from "@sam-group/types";
import type { ReactNode } from "react";

/**
 * The closing section — a distinct framed panel, not another plain midnight band.
 *
 * `_v2`'s Final CTA is the page's last word — "Let's Build a Long-Term Partnership" — and every
 * other midnight section on the page (Hero, Expertise, Team) fills the same full-bleed dark band.
 * Ending on an identical band would let the page's one closing argument blend into the three that
 * came before it. The gold-edged panel is the only framed surface on the page, reserved for this
 * section alone, so its border is what tells a reader they have reached the end.
 *
 * The route list is a `<nav>` with an accessible name, because it is a set of destinations rather
 * than prose. Its count comes from the list itself, so it cannot disagree with what is rendered.
 */
export function AboutClosing({
  closing,
  locale,
}: {
  readonly closing: AboutUsClosing;
  readonly locale: string;
}): ReactNode {
  return (
    <section className="fs-sec ab-close" id={ANCHORS.next} data-surface="midnight">
      <div className="fs-blueprint" aria-hidden="true" />
      <div className="fs-wrap">
        <div className="ab-close-panel">
          <div className="ab-close-grid">
            <div className="ab-close-copy reveal-fade-rise">
              {closing.eyebrow !== null && <p className="fs-eyebrow">{closing.eyebrow}</p>}
              {closing.heading !== null && <h2 className="fs-d2">{closing.heading}</h2>}
              {closing.lead !== null && <p className="fs-lead">{closing.lead}</p>}
              {closing.primaryCta !== null && (
                <p className="ab-close-primary">
                  <a
                    href={contentRouteHref(locale, closing.primaryCta.route)}
                    className="fs-btn fs-btn--gold"
                  >
                    {closing.primaryCta.label}
                    <Arrow size={15} />
                  </a>
                </p>
              )}
            </div>

            {closing.routes.length > 0 && (
              <nav
                className="ab-close-routes reveal-fade-rise"
                aria-labelledby="ab-close-routes-title"
              >
                <p className="ab-close-head" id="ab-close-routes-title">
                  <span>Other ways to continue</span>
                  <span className="fs-tnum">{String(closing.routes.length).padStart(2, "0")}</span>
                </p>
                <ul>
                  {closing.routes.map((route) => (
                    <li key={route.route}>
                      <a href={contentRouteHref(locale, route.route)}>
                        <span>{route.label}</span>
                        <Arrow size={16} />
                      </a>
                    </li>
                  ))}
                </ul>
              </nav>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
