import type { ReactNode } from "react";
import type { ProductEditorialSections } from "@sam-group/types";
import { translator, ordinal } from "@/i18n/translate";

/**
 * `lang`/`dir` for editorial text served in another locale than the page (ADR-027 §4): the API
 * falls a locale without its own sections back to the default locale's, and assistive
 * technology must read that text in its own language (WCAG 2.2 AA 3.1.2).
 */
function contentLanguage(
  locale: string,
  contentLocale: string | undefined,
): { lang?: string; dir?: "auto" } {
  return contentLocale && contentLocale !== locale ? { lang: contentLocale, dir: "auto" } : {};
}

export function ProductEditorialPoints({
  items,
  id,
  title,
  locale = "en",
  contentLocale,
}: {
  items: ProductEditorialSections["applications"];
  id: "applications" | "features";
  title: string;
  locale?: string;
  contentLocale?: string;
}): ReactNode {
  if (!items.length) return null;
  return (
    <section className="fs-sec pd-editorial" id={id} data-surface="light">
      <div className="fs-wrap">
        <h2 className="fs-d2">{title}</h2>
        <ol className="pd-criteria" {...contentLanguage(locale, contentLocale)}>
          {items.map((item, index) => (
            <li key={index}>
              <span aria-hidden="true">{ordinal(locale, index + 1)}</span>
              <div>
                <h3>{item.title}</h3>
                <p>{item.description}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

export function ProductEditorialFaq({
  items,
  locale = "en",
  contentLocale,
}: {
  items: ProductEditorialSections["faq"];
  locale?: string;
  contentLocale?: string;
}): ReactNode {
  if (!items.length) return null;
  return (
    <section className="fs-sec pd-editorial" id="faq" data-surface="light">
      <div className="fs-wrap">
        <h2 className="fs-d2">{translator(locale)("Frequently asked questions")}</h2>
        <div className="pd-editorial-faq" {...contentLanguage(locale, contentLocale)}>
          {items.map((item, index) => (
            <details key={index}>
              <summary>{item.question}</summary>
              <p>{item.answer}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
