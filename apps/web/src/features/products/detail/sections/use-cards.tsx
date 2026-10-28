import type { ReactNode } from "react";

import { translator } from "@/i18n/translate";

import { BidiText } from "../bidi-text";

import type { ProductEditorialSections } from "@sam-group/types";

/**
 * Overview, applications and features as one card grid (redesign, 28 October 2026).
 *
 * The overview card carries the full description; each application and feature is its own card.
 * Text served in another language than the page (ADR-027 §4 fallback) carries that language's
 * `lang`, and every paragraph takes the direction of the language it is written in, so a Persian
 * sentence that starts with a Latin product name still reads right to left.
 */
export function ProductUseCards({
  locale,
  dir,
  description,
  editorial,
  editorialLocale,
}: {
  readonly locale: string;
  readonly dir: "ltr" | "rtl";
  readonly description: string | null;
  readonly editorial: ProductEditorialSections | undefined;
  readonly editorialLocale: string | undefined;
}): ReactNode {
  const t = translator(locale);
  const paragraphs = (description ?? "")
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);
  const applications = editorial?.applications ?? [];
  const features = editorial?.features ?? [];
  if (paragraphs.length === 0 && applications.length === 0 && features.length === 0) return null;
  const other = editorialLocale !== undefined && editorialLocale !== locale;
  const textLang = other ? { lang: editorialLocale, dir: "auto" as const } : { dir };
  // Text in another language than the page is the default locale's, which is left to right here.
  const textDir = other ? "ltr" : dir;

  return (
    <section className="fs-sec pd2-use" id="applications" data-surface="light">
      <div className="fs-wrap pd2-cards">
        {paragraphs.length > 0 && (
          <article className="pd2-card pd2-card--dark">
            <p className="fs-eyebrow">{t("Overview")}</p>
            {paragraphs.map((paragraph, index) => (
              <p key={index} className="pd2-card-text" dir={dir}>
                <BidiText text={paragraph} dir={dir} />
              </p>
            ))}
          </article>
        )}
        {applications.map((item, index) => (
          <article key={`a${index}`} className="pd2-card" {...textLang}>
            <p className="fs-eyebrow">{t("Application")}</p>
            <h3 className="pd2-card-title">
              <BidiText text={item.title} dir={textDir} />
            </h3>
            <p className="pd2-card-text">
              <BidiText text={item.description} dir={textDir} />
            </p>
          </article>
        ))}
        {features.map((item, index) => (
          <article key={`f${index}`} className="pd2-card" {...textLang}>
            <p className="fs-eyebrow">{t("Feature")}</p>
            <h3 className="pd2-card-title">
              <BidiText text={item.title} dir={textDir} />
            </h3>
            <p className="pd2-card-text">
              <BidiText text={item.description} dir={textDir} />
            </p>
          </article>
        ))}
      </div>
    </section>
  );
}
