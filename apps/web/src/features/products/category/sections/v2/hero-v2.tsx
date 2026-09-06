import Image from "next/image";
import type { ReactNode } from "react";

import { Arrow } from "@/features/site/logo-mark";
import { localeHref, ROUTES } from "@/features/site/site-routes";

import { actionHref } from "../../category-contract";
import type { SectionProps } from "../../category-section";

/**
 * v2 · Block 1 — compact image-led intro (Catalog Rail direction).
 *
 * Full-width, above the rail shell. Image on the left as a contained plate, identity and copy on
 * the right, tight. On mobile the image moves on top (capped height) so the photograph, the
 * family name and the primary action sit together in the first screen.
 *
 * The photograph is a plain `<figure>` — not `BrandedPhoto` — because the asset is a
 * representative, claim-safe laboratory scene (recorded in `docs/PROJECT_HANDOFF.md`). The v2
 * hero keeps the SAM mark off it and captions it "Representative image" on screen.
 *
 * The enquiry actions and the family quick-facts also live in the sticky rail beside the browse
 * zone; repeating the two actions here is deliberate, so the first screen carries them without a
 * scroll.
 *
 * A Server Component. No `reveal-*` class — legible at rest.
 */
export function HeroV2({ content, family, locale }: SectionProps): ReactNode {
  const { hero } = content;

  return (
    <section className="pcv2-hero" data-surface="midnight">
      <div className="fs-blueprint" aria-hidden="true" />

      <div className="fs-wrap pcv2-hero-inner">
        {hero.image && (
          <figure className="pcv2-hero-media">
            <Image
              src={hero.image.src}
              alt={hero.image.alt}
              fill
              sizes="(max-width: 900px) calc(100vw - 40px), 34vw"
              priority
            />
            <figcaption>{hero.image.caption}</figcaption>
          </figure>
        )}

        <div className="pcv2-hero-copy">
          <nav className="pcv2-trail" aria-label="Breadcrumb">
            <a href={localeHref(locale, ROUTES.products)}>Products</a>
            <span aria-hidden="true">/</span>
            <span aria-current="page">{family.name}</span>
          </nav>

          <p className="fs-eyebrow">
            {family.code} · {family.name}
          </p>

          <h1 className="fs-d1">{hero.headline}</h1>
          <p className="fs-lead pcv2-hero-lead">{hero.lead}</p>

          <div className="pcv2-hero-actions">
            <a href={actionHref(locale, hero.primary.route)} className="fs-btn fs-btn--gold">
              {hero.primary.label}
              <Arrow size={15} />
            </a>
            <a href={actionHref(locale, hero.secondary.route)} className="fs-btn fs-btn--glass">
              {hero.secondary.label}
            </a>
          </div>

          <p className="pcv2-hero-jump">
            <a href="#products">
              See published products
              <Arrow size={13} />
            </a>
          </p>
        </div>
      </div>
    </section>
  );
}
