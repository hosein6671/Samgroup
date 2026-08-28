import type { ReactNode } from "react";

import { BrandedPhoto } from "@/features/home/branded-photo";
import { Arrow } from "@/features/site/logo-mark";
import { localeHref, ROUTES } from "@/features/site/site-routes";

import { actionHref, groupSubRanges } from "../category-contract";
import type { SectionProps } from "../category-section";

/**
 * 1 · Category hero — SITE_STRUCTURE §4 item 1.
 *
 * "Product family name + scope + primary/secondary CTA (Request a Quote / Request Sample)", and
 * that is exactly what the left column carries. The family name is read from the canonical
 * family record rather than restated in the fixture, so this heading and the header's mega menu
 * cannot disagree.
 *
 * ── The right column ────────────────────────────────────────────────────────
 *
 * The Products landing fills this position with a riser diagram — one stem, six branches, one
 * node per family. This page is a level down, so the equivalent index is two levels deep rather
 * than one: sub-range, then the grades inside it. It is drawn as a stratigraphic column, not a
 * branch tree, because that is what the content is — bands with contents, not a chain that
 * divides.
 *
 * It is also the page's index. Every band anchors into its entry in the range register below,
 * which is the same job the landing's diagram does and the reason neither page needs a separate
 * table of contents.
 *
 * Nothing in it is a metric. Every string is a designation from the frozen taxonomy.
 */
export function CategoryHero({ content, family, locale }: SectionProps): ReactNode {
  const { hero } = content;

  return (
    <section className="pc-hero" data-surface="midnight" data-photo={hero.image ? "true" : "false"}>
      <div className="fs-blueprint" aria-hidden="true" />

      <div className="fs-wrap pc-hero-inner">
        <div className="pc-hero-copy reveal-fade-rise">
          {/*
            A level-2 page, so it says so. The trail is two links deep because the sitemap is:
            Products is level 1, this category is level 2, and there is no level 3 — grades are
            sections inside this page, not routes (SITE_STRUCTURE §4).
          */}
          <nav className="pc-trail" aria-label="Breadcrumb">
            <a href={localeHref(locale, ROUTES.products)}>Products</a>
            <span aria-hidden="true">/</span>
            <span aria-current="page">{family.name}</span>
          </nav>

          <p className="fs-eyebrow">
            {family.code} · {family.name}
          </p>

          <h1 className="fs-d1">{hero.headline}</h1>
          <p className="fs-lead">{hero.lead}</p>

          <div className="pc-hero-actions">
            <a href={actionHref(locale, hero.primary.route)} className="fs-btn fs-btn--gold">
              {hero.primary.label}
              <Arrow size={15} />
            </a>
            <a href={actionHref(locale, hero.secondary.route)} className="fs-btn fs-btn--glass">
              {hero.secondary.label}
            </a>
          </div>
        </div>

        {hero.image && (
          <BrandedPhoto
            src={hero.image.src}
            alt={hero.image.alt}
            caption={hero.image.caption}
            className="pc-hero-photo reveal-fade-rise"
            sizes="(max-width: 980px) calc(100vw - 40px), 48vw"
          />
        )}

        <GradeIndex content={content} family={family} locale={locale} />
      </div>
    </section>
  );
}

/**
 * The stratigraphic column — the hero's right-hand element and the page's index.
 *
 * ── Two levels, from whichever second level the category actually has ──────
 *
 * The point of this panel is that it is a level deeper than the Products landing's diagram: that
 * one indexes six families, this one indexes a category's internal structure. Keeping that true
 * across six categories means the second level cannot always be the grade, because only some
 * categories name grades. Base Oils names five; Antifreeze & Coolants names none at all, and
 * inventing chips to fill the gap would be inventing products.
 *
 * So the second level is whichever one the category publishes:
 *
 * - **Grades**, where the taxonomy names them — inline marks under the band, as before.
 * - **Dimensions**, where it does not — the bands group under the axis they belong to, which for
 *   a category organised "by base fluid and inhibitor technology; concentrate or ready-to-use" is
 *   the more honest reading anyway.
 *
 * Base Oils sets no axis, so it renders as a flat list exactly as it did — no regression there,
 * and the grade marks still supply its second level.
 *
 * CSS only. Borders and pseudo-elements on tokenised colours; no SVG to keep in sync with the
 * data, no canvas, nothing added to the first-load JavaScript budget.
 */
function GradeIndex({ content }: SectionProps): ReactNode {
  const { range } = content;
  const groups = groupSubRanges(range);
  const grouped = groups.some((group) => group.axis !== undefined);

  return (
    <aside className="pc-index reveal-fade-rise" aria-labelledby="pc-index-title">
      <p className="fs-eyebrow" id="pc-index-title">
        Range index
      </p>

      {/*
        The noun comes from the range, not from here.

        "Dimensions" was hardcoded, and it is only true of a category whose axes really are
        independent dimensions. Industrial Oils' two axes are specification families — a fluid set
        and a grease set — and calling them dimensions overstated what the split means. `axisNoun`
        defaults to the old word, so a category that says nothing reads as it always did.
      */}
      <p className="pc-index-note">
        {grouped
          ? `${range.subRanges.length} sub-ranges across ${groups.length} ${range.axisNoun ?? "dimensions"}.`
          : `${range.subRanges.length} sub-ranges.`}
      </p>

      <ol className="pc-index-stack">
        {groups.map((group) => (
          <li className="pc-index-group" key={group.axis ?? "ungrouped"}>
            {group.axis && <p className="pc-index-axis">{group.axis}</p>}

            <ol className="pc-index-bands">
              {group.subRanges.map((subRange, i) => (
                <li className="pc-index-band" key={subRange.id}>
                  <a href={`#range-${subRange.id}`}>
                    <span className="pc-index-num">
                      {String(group.offset + i + 1).padStart(2, "0")}
                    </span>
                    <span className="pc-index-name">{subRange.designation}</span>
                  </a>

                  {subRange.grades.length > 0 && (
                    <ul className="pc-index-grades">
                      {subRange.grades.map((grade) => (
                        <li key={grade.id}>{grade.designation}</li>
                      ))}
                    </ul>
                  )}
                </li>
              ))}
            </ol>
          </li>
        ))}
      </ol>
    </aside>
  );
}
