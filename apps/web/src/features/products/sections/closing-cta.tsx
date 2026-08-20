import type { ReactNode } from "react";

import { Arrow } from "@/features/site/logo-mark";
import { localeHref, ROUTES } from "@/features/site/site-routes";

import { CLOSING_ROUTES, type ClosingRoute } from "../products-data";

/** Route ids resolved against the canonical table, so no path is retyped in this file. */
const HREF: Record<ClosingRoute["id"], string> = {
  finder: ROUTES.productFinder,
  sample: ROUTES.contactUs,
  quote: ROUTES.requestQuote,
};

/**
 * What this section needs from the page rendering it.
 *
 * ── Why `locale` is required and no longer bundled with the product ─────────
 *
 * It used to arrive inside an optional `ClosingContext` alongside `productSlug`, which made the
 * locale optional in practice: the Products landing and the six Family pages passed nothing, and
 * every href they rendered came out locale-less for `middleware.ts` to re-negotiate. Worse, even
 * *with* a context the Finder route returned early and skipped the prefix entirely.
 *
 * Splitting them makes that unrepresentable. `locale` is a required prop, so no call site can omit
 * it; `productSlug` stays optional, because the Products landing and the Family pages are not about
 * one product and have none to carry.
 */
export type ClosingCtaProps = {
  /** The route's own locale segment, validated by `app/[locale]/layout.tsx`. */
  readonly locale: string;
  /** The product's own slug, as `GET /products/:slug` returned it in this locale. */
  readonly productSlug?: string;
};

/**
 * One route's href, with the product carried where carrying it means something.
 *
 * ── What travels, and what deliberately does not ────────────────────────────
 *
 * `?product={slug}`, and nothing else. **Not the product name**, which the destination would then
 * be rendering from a query string any link could write; not the `Product.id`, which is an internal
 * identifier with no business in a URL. The Contact Us route resolves the slug server-side through
 * `GET /products/:slug` and gets the id and the display name from the API — see
 * `resolve-product-context.ts`.
 *
 * `sample` also carries `?type=sample_request`, because the shared route's default is a general
 * inquiry. `quote` carries no type: `/contact-us/request-a-quote` IS the type.
 *
 * `finder` never carries a product. It is the "look at something else" route, and pre-filtering it
 * by the product the visitor is leaving would be the opposite of what it offers.
 *
 * ── The prefix is applied before the branch, not inside it ──────────────────
 *
 * `localeHref` runs on the first line, so every path this function can return is already addressed
 * in the reader's locale — including the `finder` early return, which previously left the section's
 * most-used route bare. The query is then appended to an address that is already correct, which is
 * also why no branch below writes a `/${locale}` of its own.
 */
function hrefFor(id: ClosingRoute["id"], locale: string, productSlug?: string): string {
  const path = localeHref(locale, HREF[id]);

  if (productSlug === undefined || id === "finder") {
    return path;
  }

  const product = `product=${encodeURIComponent(productSlug)}`;
  const query = id === "sample" ? `type=sample_request&${product}` : product;

  return `${path}?${query}`;
}

/**
 * 5 · Closing CTA.
 *
 * The heading is SITE_STRUCTURE §3's own wording — "Can't Find Exactly What You Need?" — and
 * §3's own answer to it, Request Custom Solution, is the primary action directly beneath it.
 *
 * ── The device: a staircase ─────────────────────────────────────────────────
 *
 * The three remaining routes are not peers of that action and not peers of each other. They are
 * a sequence of increasing commitment — look at the range, ask for a sample, ask for a price —
 * and the section is built to say so: each route steps further in than the one above it, with
 * the risers and treads drawn by two borders per row. Nothing is repeated, nothing is boxed, and
 * the shape carries the meaning that three identical rows could not.
 *
 * That is also what makes this section belong to the flagship rather than to any B2B site: it is
 * the third distinct structural device on this page — after the hero's stem and the register's
 * ledger — and it shares their vocabulary without repeating either.
 *
 * **Request Sample deliberately points at Contact Us, not at a sample form.** `SampleRequest` was
 * merged into `Inquiry` (`inquiryType: 'Sample Request'` + `relatedProductId`) and there is no
 * separate sample-request form anywhere on the platform — a "Request Sample" CTA opens the
 * Inquiry form pre-filled (AI_CONTEXT.md, FRONTEND_ARCHITECTURE §`forms/`). Pointing this
 * anywhere else would rebuild the entity that was removed.
 *
 * **"Pre-filled" is now literally true.** Both inquiry routes exist, and on a Product Detail page
 * these two CTAs carry the product into them — which is the mechanism `Inquiry.relatedProductId`
 * was added for: DATA_MODEL.md §2 has it record "which product page the CTA was clicked from".
 * Everywhere else the block is unchanged, and deliberately so: neither the Products landing nor a
 * Family page is about one product, so neither has one to carry.
 *
 * Per SITE_STRUCTURE §3 this block is shared with all six category pages. It lives in this
 * feature for now because this is the only page that renders it; when the category pages arrive
 * it moves up a level rather than being copied down.
 */
export function ClosingCta({ locale, productSlug }: ClosingCtaProps): ReactNode {
  return (
    <section className="fs-sec pr-close" data-surface="light">
      <div className="fs-wrap pr-close-grid">
        <div className="pr-close-copy reveal-fade-rise">
          <p className="fs-eyebrow">Next step</p>
          <h2 className="fs-d2">Can&rsquo;t find exactly what you need?</h2>
          <p className="fs-lead">
            The range above is what we publish. Formulation to a customer brief is a route of its
            own, and a sample is the first stage of it.
          </p>

          <p className="pr-close-primary">
            <a
              href={localeHref(locale, ROUTES.customizedSolutions)}
              className="fs-btn fs-btn--gold"
            >
              Request a custom solution
              <Arrow size={15} />
            </a>
          </p>
        </div>

        <div className="pr-close-steps reveal-fade-rise">
          <p className="pr-steps-head">
            <span>Or take a shorter route</span>
            <span>{String(CLOSING_ROUTES.length).padStart(2, "0")}</span>
          </p>

          <ol className="pr-steps">
            {CLOSING_ROUTES.map((route, i) => (
              <li className="pr-step" key={route.id}>
                <a href={hrefFor(route.id, locale, productSlug)}>
                  <span className="pr-step-index">{String(i + 1).padStart(2, "0")}</span>
                  <span className="pr-step-body">
                    <b>{route.label}</b>
                    <small>{route.qualifier}</small>
                  </span>
                  <Arrow size={16} />
                </a>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}
