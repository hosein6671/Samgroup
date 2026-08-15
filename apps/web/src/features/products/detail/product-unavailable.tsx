import type { ReactNode } from "react";

import "../../home/flagship.css";
import "../products.css";
import "./product-detail.css";

import { SiteFooter } from "@/features/site/site-footer";
import { SiteNav } from "@/features/site/site-nav";
import { Arrow } from "@/features/site/logo-mark";
import { ROUTES } from "@/features/site/site-routes";

/**
 * What `/{locale}/products/{slug}` renders when the catalog service could not answer.
 *
 * ── This page exists because a 404 here would be a lie ──────────────────────
 *
 * ADR-010 §7 freezes it: infrastructure failure must never become a canonical-content 404. The
 * Family branch honours that by falling open to its fixture — it has approved local content, so a
 * failed fetch costs it nothing observable. The Product branch has no fixture and never will: a
 * Product's content lives only in `sam_platform`, so when the API does not answer, the honest
 * position is that this page's existence is **unknown**, not that it is absent.
 *
 * A 404 would assert absence. It would also be acted on: a crawler that sees 404 de-indexes the
 * URL, and a support reply that says "that product does not exist" is wrong in a way nobody catches
 * until a customer insists otherwise. So a transport failure, a timeout, a 5xx and a malformed
 * payload all land here instead, and only the API's own definitive NOT_FOUND produces a 404.
 *
 * ── What it says, and what it does not ──────────────────────────────────────
 *
 * It states the situation plainly and offers the two routes that are still reachable — the catalog
 * landing and the family index — because both are served from local content and do not depend on
 * the service that just failed. It does **not** name the product: nothing is known about the slug
 * beyond its presence in the URL, and echoing caller-supplied text back into a heading would put
 * unvalidated input on the page while implying the product is real.
 *
 * No API error code, status or message is displayed. The cause is logged server-side by the route;
 * a visitor cannot act on `ECONNREFUSED`, and §8's `message` is still text this application did not
 * author.
 *
 * ── Status code, stated as a known limitation ───────────────────────────────
 *
 * This renders with a 200. A 5xx would describe the situation better, and the App Router gives a
 * page no supported way to set one — the alternative is throwing into an `error.tsx` boundary,
 * which is a Client Component and a different (heavier) architecture than this gate authorizes.
 * The practical exposure is small: the whole `[locale]` tree is `robots: noindex, nofollow`, so no
 * crawler is interpreting these responses yet. Revisiting it belongs with the SEO launch gate,
 * which is when the status code starts to mean something to anyone.
 */
export function ProductUnavailable({ locale }: { readonly locale: string }): ReactNode {
  return (
    <div data-brand="flagship">
      <SiteNav />

      <main id="main-content">
        <section className="fs-sec pd-unavailable" data-surface="midnight">
          <div className="fs-blueprint" aria-hidden="true" />

          <div className="fs-wrap pd-unavailable-inner">
            <p className="fs-eyebrow">Catalog unavailable</p>

            <h1 className="fs-d2 pd-unavailable-title">This product cannot be shown right now.</h1>

            <p className="fs-lead pd-unavailable-lead">
              The catalog service did not answer, so we cannot confirm the details of this product.
              This is a temporary service condition, not a statement that the product does not exist
              — please try again shortly.
            </p>

            <div className="pd-unavailable-routes">
              <a className="fs-btn fs-btn--gold" href={`/${locale}${ROUTES.products}`}>
                All products
                <Arrow size={13} />
              </a>
              <a className="fs-btn fs-btn--glass" href={`/${locale}${ROUTES.contactUs}`}>
                Contact us
              </a>
            </div>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
