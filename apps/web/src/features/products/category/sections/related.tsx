import type { ReactNode } from "react";

import { Arrow } from "@/features/site/logo-mark";
import { localeHref, ROUTES } from "@/features/site/site-routes";

import { FAMILIES } from "../../products-data";
import type { SectionProps } from "../category-section";

/**
 * Related categories — the next-step navigation between the FAQ and the shared closing CTA.
 *
 * ── Why it exists alongside Applications ────────────────────────────────────
 *
 * The two look adjacent and are not. Applications is an argument: it says where a base stock
 * goes, names the fields it goes into, and deliberately leaves out the one family a base stock
 * does not feed. This strip is navigation: the rest of the range, complete, in the frozen order,
 * with nothing said about any of it.
 *
 * They are drawn to read that way too — Applications is a full-measure register on light ground,
 * this is a compact dark index. The same pair of registers appears on the frozen landing (its
 * hero diagram indexes the same six families its register argues about), so the grammar is the
 * page family's, not something introduced here.
 *
 * The current category is filtered out by id rather than by name, and the list comes from the
 * canonical `FAMILIES` rather than the fixture, so a category can never link to itself and can
 * never miss a sibling.
 */
export function CategoryRelated({ content, locale }: SectionProps): ReactNode {
  const others = FAMILIES.filter((family) => family.id !== content.familyId);

  return (
    <section className="pc-related" data-surface="midnight">
      <div className="fs-wrap pc-related-inner">
        <div className="pc-related-head">
          <p className="fs-eyebrow">The rest of the range</p>
          <a href={localeHref(locale, ROUTES.products)} className="pc-related-all">
            All products
            <Arrow size={13} />
          </a>
        </div>

        <ul className="pc-related-list">
          {others.map((family) => (
            <li key={family.id}>
              <a href={localeHref(locale, family.href)}>
                <span className="pc-related-code">{family.code}</span>
                <span className="pc-related-name">{family.name}</span>
                <Arrow size={14} />
              </a>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
