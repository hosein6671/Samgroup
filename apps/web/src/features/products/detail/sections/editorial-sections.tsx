import type { ReactNode } from "react";
import type { ProductEditorialSections } from "@sam-group/types";

export function ProductEditorialPoints({
  items,
  id,
  title,
}: {
  items: ProductEditorialSections["applications"];
  id: "applications" | "features";
  title: string;
}): ReactNode {
  if (!items.length) return null;
  return (
    <section className="fs-sec pd-editorial" id={id} data-surface="light">
      <div className="fs-wrap">
        <h2 className="fs-d2">{title}</h2>
        <ol className="pd-criteria">
          {items.map((item, index) => (
            <li key={index}>
              <span aria-hidden="true">{String(index + 1).padStart(2, "0")}</span>
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
}: {
  items: ProductEditorialSections["faq"];
}): ReactNode {
  if (!items.length) return null;
  return (
    <section className="fs-sec pd-editorial" id="faq" data-surface="light">
      <div className="fs-wrap">
        <h2 className="fs-d2">Frequently asked questions</h2>
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
