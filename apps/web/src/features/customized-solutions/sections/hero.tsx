import { Arrow } from "@/features/site/logo-mark";
import { BrandedPhoto } from "@/features/home/branded-photo";
import { contentRouteHref } from "@/features/site/site-routes";

import { ANCHORS } from "../solutions-anchors";

import type { CustomizedSolutionsHero, CustomizedSolutionsProcess } from "@sam-group/types";
import type { ReactNode } from "react";

/**
 * The Customized Solutions hero — the page's `<h1>`, its lead, and its two actions.
 *
 * ── Two actions, two different kinds, and only one of them has a CMS destination ─
 *
 * The **request action** jumps to the form further down this same page. Its label is editorial; its
 * target is `ANCHORS.request`, read from code and never from the CMS. That is the whole point of
 * the split: an editor can rename the button, and no edit anywhere can send it somewhere else or
 * break a fragment somebody has already shared.
 *
 * The **route action** points at another page and carries a route key, resolved to a locale-prefixed
 * path by `contentRouteHref` — the same handling every editorial route action on the platform gets.
 *
 * Both are optional: an action the CMS holds no label for is simply not rendered.
 */
export function SolutionsHero({
  hero,
  process,
  locale,
}: {
  readonly hero: CustomizedSolutionsHero;
  readonly process: CustomizedSolutionsProcess | null;
  readonly locale: string;
}): ReactNode {
  const hasActions = hero.requestCta !== null || hero.routeCta !== null;

  return (
    <section className="cs-hero" data-surface="midnight">
      <div className="fs-blueprint" aria-hidden="true" />
      <div className="fs-wrap cs-hero-inner">
        <div className="cs-hero-copy reveal-fade-rise">
          {hero.eyebrow !== null && <p className="fs-eyebrow">{hero.eyebrow}</p>}
          <h1 className="fs-d1">{hero.title}</h1>
          {hero.supportingText !== null && <p className="fs-lead">{hero.supportingText}</p>}
          {hasActions && (
            <div className="cs-hero-actions">
              {hero.requestCta !== null && (
                <a href={`#${ANCHORS.request}`} className="fs-btn fs-btn--gold">
                  {hero.requestCta.label}
                  <Arrow size={15} />
                </a>
              )}
              {hero.routeCta !== null && (
                <a
                  href={contentRouteHref(locale, hero.routeCta.route)}
                  className="fs-btn fs-btn--glass"
                >
                  {hero.routeCta.label}
                </a>
              )}
            </div>
          )}
        </div>
        <div className="cs-hero-visual reveal-fade-rise">
          <BrandedPhoto
            src="/images/customized-solutions-requirement-review.webp"
            alt="A technical and commercial team reviewing a lubricant requirement and product sample."
            caption="APPLICATION · SPECIFICATION · QUANTITY · PACKAGING · DESTINATION"
            className="cs-hero-photo"
            sizes="(max-width: 1180px) 100vw, 42vw"
          />
          {process !== null && process.steps.length > 0 && <ProcessIndex steps={process.steps} />}
        </div>
      </div>
    </section>
  );
}

/**
 * The step index beside the hero.
 *
 * Its count is the list's own length rather than a stored number, and each row links to the process
 * section's anchor — structural, code-owned, exactly as the request anchor is.
 */
function ProcessIndex({ steps }: { readonly steps: readonly { name: string }[] }): ReactNode {
  return (
    <aside className="cs-index reveal-fade-rise" aria-labelledby="cs-index-title">
      <p className="fs-eyebrow" id="cs-index-title">
        The process
      </p>
      <p className="cs-index-note">
        {steps.length} defined stages from requirement capture to supply confirmation.
      </p>
      <a className="cs-index-link" href={`#${ANCHORS.process}`}>
        Review the complete path <Arrow size={14} />
      </a>
    </aside>
  );
}
