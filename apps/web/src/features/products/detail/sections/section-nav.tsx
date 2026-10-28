import type { ReactNode } from "react";

import { translator } from "@/i18n/translate";

/**
 * The sticky in-page bar under the hero: jump links to the page's sections, the grade being
 * viewed, and the quote action — so the next step is never more than one click away.
 * Only sections that actually render are linked.
 */
export function ProductSectionNav({
  locale,
  sections,
  gradeLabel,
  quoteHref,
}: {
  readonly locale: string;
  readonly sections: readonly { readonly id: string; readonly label: string }[];
  readonly gradeLabel: string | null;
  readonly quoteHref: string;
}): ReactNode {
  const t = translator(locale);
  return (
    <nav className="pd2-subnav" aria-label={t("On this page")}>
      <div className="fs-wrap pd2-subnav-inner">
        <ul>
          {sections.map((section) => (
            <li key={section.id}>
              <a href={`#${section.id}`}>{t(section.label)}</a>
            </li>
          ))}
        </ul>
        <div className="pd2-subnav-actions">
          {gradeLabel !== null && (
            <span className="pd2-subnav-grade" dir="ltr">
              {gradeLabel}
            </span>
          )}
          <a className="fs-btn fs-btn--gold pd2-subnav-cta" href={quoteHref}>
            {t("Request a quote")}
          </a>
        </div>
      </div>
    </nav>
  );
}
