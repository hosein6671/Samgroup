import Link from "next/link";
import type { ReactNode } from "react";
import { FAMILIES } from "../../products-data";
import { SEGMENTS } from "../../segments-data";
import { PRODUCT_TYPES } from "../../product-types-data";
import { filterHref, type FinderQuery } from "../finder-query";

export function ActiveFilters({
  locale,
  query,
}: {
  readonly locale: string;
  readonly query: FinderQuery;
}): ReactNode {
  const selections = [
    {
      key: "category",
      value: query.category,
      label: FAMILIES.find((f) => f.id === query.category)?.name,
    },
    {
      key: "segment",
      value: query.segment,
      label: SEGMENTS.find((s) => s.slug === query.segment)?.name,
    },
    {
      key: "productType",
      value: query.productType,
      label: PRODUCT_TYPES.find((t) => t.slug === query.productType)?.name,
    },
    { key: "q", value: query.q, label: query.q },
  ] as const;
  if (!selections.some((s) => s.value !== null)) return null;
  return (
    <nav className="pf-active" aria-label="Active search and filters">
      {selections
        .filter((s) => s.value !== null)
        .map((s) => (
          <Link
            scroll={false}
            prefetch={false}
            key={s.key}
            href={filterHref(locale, query, { [s.key]: null })}
            aria-label={`Remove ${s.label ?? s.value}`}
          >
            {s.label ?? s.value}
            <span aria-hidden="true"> ×</span>
          </Link>
        ))}
    </nav>
  );
}
