import "server-only";

import { ROUTES } from "@/features/site/site-routes";
import { getProductBySlug } from "@/lib/products";

import type { ProductContext } from "@/features/forms/inquiry-form";

/**
 * Turns `?product={slug}` into the product context the inquiry form carries, or `null`.
 *
 * ── Why the URL carries a slug and the form carries an id ───────────────────
 *
 * A "Request Sample" / "Request a Quote" CTA on a Product Detail page has to get the product across
 * a navigation, and there are two things it could put in the URL. It puts the **slug**, which is
 * already the product's public identity in that locale — the same value the page it came from is
 * addressed by — and this function resolves it, server-side, into the id the API actually stores in
 * `Inquiry.relatedProductId`.
 *
 * That ordering is what makes the displayed name trustworthy. The alternative — carrying the name
 * in the query string — would render whatever the URL said, so any link could put any words above
 * the form. Here the name comes from `GET /products/:slug`, and the id comes with it, so what the
 * visitor is told the inquiry references and what is stored are the same record.
 *
 * The API verifies the id **again** before writing (`inquiries.service.ts`). This resolution is for
 * the display and the hidden field; it is not the security boundary and does not pretend to be.
 *
 * ── Every failure is the same answer: no context ────────────────────────────
 *
 * A missing parameter, a slug that names nothing, a catalog outage, a malformed payload — all of
 * them return `null`, and the form renders without the context note. That is deliberate and it is
 * the opposite of what a product *page* must do: ADR-010 §7 forbids an infrastructure failure
 * becoming a canonical 404, and here the stake is lower still. A buyer who clicked "Request Sample"
 * should reach a working form even if the catalog service is down; losing the pre-fill costs a
 * sentence in the message box, while a 404 or an error page costs the lead entirely.
 */
export async function resolveProductContext(
  slug: string | undefined,
  locale: string,
): Promise<ProductContext | null> {
  if (slug === undefined || slug.trim() === "") {
    return null;
  }

  const result = await getProductBySlug(slug.trim(), locale);

  if (!result.ok) {
    return null;
  }

  return {
    id: result.record.id,
    name: result.record.name,
    /*
     * Built from the record's OWN slug rather than from the query parameter, so the link cannot
     * point somewhere the resolved product does not live. The Product Detail URL is flat —
     * `/{locale}/products/{product-slug}` — with the family a relationship and never URL ancestry
     * (ADR-007 §4, ADR-010 §2).
     */
    href: `/${locale}${ROUTES.products}/${result.record.slug}`,
  };
}

/**
 * The single string value of a search parameter, or `undefined`.
 *
 * `searchParams` types every value as `string | string[] | undefined` because a parameter can be
 * repeated. A repeated `?product=a&product=b` is not a request this page can honour — there is one
 * `relatedProductId` column — so it is treated as no product at all rather than by silently picking
 * the first, which would answer a question the visitor did not ask.
 */
export function single(value: string | string[] | undefined): string | undefined {
  return typeof value === "string" ? value : undefined;
}
