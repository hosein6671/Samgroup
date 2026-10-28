import Image from "next/image";
import type { ReactNode } from "react";

import { Arrow } from "@/features/site/logo-mark";
import { ROUTES } from "@/features/site/site-routes";
import { translator } from "@/i18n/translate";

import type { ProductListItemResponse } from "@sam-group/types";

/**
 * Other products of the same application group (ADR-029), as the same rows the Product Family page
 * lists — so the two pages read as one catalogue. Omitted when there are none.
 */
export function ProductRelated({
  locale,
  groupName,
  familyName,
  familySlug,
  products,
}: {
  readonly locale: string;
  readonly groupName: string;
  readonly familyName: string;
  readonly familySlug: string;
  readonly products: readonly ProductListItemResponse[];
}): ReactNode {
  if (products.length === 0) return null;
  const t = translator(locale);
  const familyHref = `/${locale}${ROUTES.products}/${familySlug}`;

  return (
    <section className="fs-sec pd2-related" id="related" data-surface="light">
      <div className="fs-wrap">
        <header className="pd2-head">
          <h2 className="pd2-h2">{t("More in {group}", { group: groupName })}</h2>
          <a className="pd2-link" href={familyHref}>
            {t("All of {family}", { family: t(familyName) })}
          </a>
        </header>
        <ul className="pd2-rows">
          {products.map((product) => (
            <li key={product.id}>
              <a href={`/${locale}${ROUTES.products}/${product.slug}`}>
                <span className="pd2-row-thumb" aria-hidden="true">
                  {product.featuredImage && (
                    <Image src={product.featuredImage.url} alt="" width={48} height={48} />
                  )}
                </span>
                <span className="pd2-row-name">
                  <bdi>{product.name}</bdi>
                </span>
                <Arrow size={14} />
              </a>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
