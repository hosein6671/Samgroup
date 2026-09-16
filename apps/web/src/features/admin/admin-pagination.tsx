import Link from "next/link";

import type { ReactNode } from "react";

/**
 * Shared numbered pagination for the Admin list screens.
 *
 * This is the same control `InboxPagination` (`features/admin/leads/inbox-frame.tsx`) and the
 * Technical Review queue (`features/admin/catalog/review/queue-views.tsx`) each already render —
 * previous/next plus a windowed set of page numbers, the boundary controls rendered inert rather
 * than omitted, and a total-record count instead of a bare "page N". Those two keep their own
 * copies for now (out of scope for this change); this is the version the Products and Articles
 * list pages use, written once here rather than as a third copy.
 */

/** The window of page numbers rendered around the current one, plus the two ends. */
const PAGE_WINDOW = 1;

/**
 * Which page numbers to render, and where the sequence is interrupted.
 *
 * Always the first page, the last page, and `PAGE_WINDOW` either side of the current one. A `null`
 * marks a gap.
 */
function pageItems(page: number, pages: number): (number | null)[] {
  const wanted = new Set<number>([1, pages]);

  for (let n = page - PAGE_WINDOW; n <= page + PAGE_WINDOW; n += 1) {
    if (n >= 1 && n <= pages) wanted.add(n);
  }

  const sorted = [...wanted].sort((a, b) => a - b);
  const items: (number | null)[] = [];

  for (const [index, value] of sorted.entries()) {
    const previous = sorted[index - 1];

    if (previous !== undefined && value - previous > 1) items.push(null);

    items.push(value);
  }

  return items;
}

/**
 * Previous / page numbers / Next, plus how many records there are in total.
 *
 * Links, not buttons — a page of a list is a URL, so it stays shareable, bookmarkable and
 * navigable with the browser's own controls. On the first/last page the boundary control renders
 * as an inert `<span>` rather than a disabled-looking link, since an `<a>` has no disabled state.
 */
export function AdminPagination({
  page,
  pages,
  total,
  unit,
  hrefForPage,
}: {
  readonly page: number;
  readonly pages: number;
  readonly total: number;
  /** The plural noun for a record on this page — "products", "articles". */
  readonly unit: string;
  readonly hrefForPage: (page: number) => string;
}): ReactNode {
  const items = pageItems(page, pages);

  return (
    <nav className="ad-pager" aria-label="Pagination">
      <p className="ad-pager-position">
        {total} {unit} in total
      </p>

      <ol className="ad-pager-list">
        <li>
          {page > 1 ? (
            <Link className="ad-pager-step" href={hrefForPage(page - 1)} rel="prev">
              <span aria-hidden="true">←</span> Previous
            </Link>
          ) : (
            <span className="ad-pager-step ad-pager-step--inert">
              <span aria-hidden="true">←</span> Previous
            </span>
          )}
        </li>

        {items.map((item, index) =>
          item === null ? (
            <li key={`gap-${String(index)}`} className="ad-pager-gap" aria-hidden="true">
              …
            </li>
          ) : (
            <li key={item}>
              <Link
                className="ad-pager-step"
                href={hrefForPage(item)}
                aria-label={`Page ${String(item)}`}
                aria-current={item === page ? "page" : undefined}
              >
                {item}
              </Link>
            </li>
          ),
        )}

        <li>
          {page < pages ? (
            <Link className="ad-pager-step" href={hrefForPage(page + 1)} rel="next">
              Next <span aria-hidden="true">→</span>
            </Link>
          ) : (
            <span className="ad-pager-step ad-pager-step--inert">
              Next <span aria-hidden="true">→</span>
            </span>
          )}
        </li>
      </ol>
    </nav>
  );
}
