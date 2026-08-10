import type { ReactNode } from "react";

import { Arrow } from "@/features/site/logo-mark";
import { ROUTES } from "@/features/site/site-routes";

import { CLOSING_ROUTES, type ClosingRoute } from "../products-data";

/** Route ids resolved against the canonical table, so no path is retyped in this file. */
const HREF: Record<ClosingRoute["id"], string> = {
  finder: ROUTES.productFinder,
  sample: ROUTES.contactUs,
  quote: ROUTES.requestQuote,
};

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
 * Per SITE_STRUCTURE §3 this block is shared with all six category pages. It lives in this
 * feature for now because this is the only page that renders it; when the category pages arrive
 * it moves up a level rather than being copied down.
 */
export function ClosingCta(): ReactNode {
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
            <a href={ROUTES.customizedSolutions} className="fs-btn fs-btn--gold">
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
                <a href={HREF[route.id]}>
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
