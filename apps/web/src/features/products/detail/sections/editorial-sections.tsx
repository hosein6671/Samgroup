import type { ReactNode } from "react";
import type { ProductEditorialSections } from "@sam-group/types";
import { translator, ordinal } from "@/i18n/translate";

export function ProductEditorialPoints({
  items,
  id,
  title,
  locale = "en",
}: {
  items: ProductEditorialSections["applications"];
  id: "applications" | "features";
  title: string;
  locale?: string;
}): ReactNode {
  if (!items.length) return null;
  return (
    <section className="fs-sec pd-editorial" id={id} data-surface="light">
      <div className="fs-wrap">
        <h2 className="fs-d2">{title}</h2>
        <ol className="pd-criteria">
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
}: {
  items: ProductEditorialSections["faq"];
  locale?: string;
}): ReactNode {
  if (!items.length) return null;
  return (
    <section className="fs-sec pd-editorial" id="faq" data-surface="light">
      <div className="fs-wrap">
        <h2 className="fs-d2">{translator(locale)("Frequently asked questions")}</h2>
        <div className="pd-editorial-faq">
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
