import Link from "next/link";
import type { ReactNode } from "react";

import { LogoMark } from "./logo-mark";
import { ROUTES, footerColumnsFor, localeHref } from "./site-routes";

/**
 * The footer. A Server Component — there is nothing here that needs the client.
 *
 * ── What this footer deliberately does not say ──────────────────────────────
 *
 * It renders on **every** page, which makes it the highest-leverage place on the platform to
 * publish something untrue. It previously carried five unverified facts — a Dubai head office, a
 * Persian Gulf plant, `partnership@samgroup.example`, an "ISO 9001 · ISO 14001 · API licensed"
 * bar, and a claim that products are "engineered, tested and shipped from our own complexes" —
 * and all five are removed rather than replaced.
 *
 * The certification bar was the worst of them: SITE_STRUCTURE §7's Outstanding Confirmations says
 * of the certificate list, in as many words, **"do not publish placeholders here"**, and the
 * Quality & Certifications page honours that scrupulously — it publishes no certificate at all and
 * states on the page that the list is withheld. This footer was contradicting that page from
 * directly beneath it.
 *
 * **Nothing invented replaces them.** The contact column is now a link to Contact Us, which is a
 * real route with a working form; an address, a phone number or an email would each be a fact the
 * project has not confirmed. They return when SITE_STRUCTURE's Outstanding Confirmations are
 * answered, sourced from the Payload `Settings` global that PAYLOAD_CONTENT_ARCHITECTURE marks
 * "human review required (source-of-truth contact facts)".
 *
 * What remains is brand-level and claim-free: the mark, the name, the navigation columns, and the
 * copyright line.
 *
 * ── What NAV-1 changed ─────────────────────────────────────────────────────
 *
 * **Every link is locale-prefixed**, through the one resolver in `site-routes.ts`, so the footer
 * keeps a reader in the language they are reading. It rendered locale-less paths before, which
 * `middleware.ts` then re-negotiated from `Accept-Language` — the same defect the header had.
 *
 * **Two dead anchors are gone.** The brand mark pointed at `#top`, an id that exists only inside
 * the homepage hero, so on the other thirteen routes it went nowhere; it is the locale's home page
 * now. The Products column pointed five links at `#products`, an id that exists on two unrelated
 * sections and on no other route — that column is the six canonical families, resolved from
 * `PRODUCT_CATEGORIES` by `footerColumnsFor`.
 */
export function SiteFooter({
  locale,
}: {
  /** The route's locale segment, resolved on the server. The footer never negotiates one. */
  readonly locale: string;
}): ReactNode {
  const columns = footerColumnsFor(locale);
  const homeHref = localeHref(locale, ROUTES.home);

  return (
    <footer className="fs-footer" data-surface="midnight">
      <div className="fs-wrap">
        <div className="fs-fgrid">
          <div className="fs-fcol">
            {/*
             * `#top` stood here and resolved only on the homepage. A brand mark in a footer means
             * "the front page", so it says that: the locale's home route, which exists in every
             * locale. No id was invented on thirteen pages to keep a fragment working.
             */}
            <Link
              href={homeHref}
              className="fs-logo"
              aria-label="Sam Group — home"
              style={{ marginBottom: 18 }}
            >
              <LogoMark height={28} />
              <span>
                <span className="fs-logo-txt">SAM GROUP</span>
                <span className="fs-logo-sub">Petroleum Engineering</span>
              </span>
            </Link>
            {/*
             * Names the range and stops. The previous sentence closed with "engineered, tested and
             * shipped from our own complexes" — a production, testing and logistics claim, and the
             * in-house vs. partner-refinery split is one of SITE_STRUCTURE's open confirmations.
             * "Produces its own range in Iran" is the approved positioning (About Us), and it is
             * deliberately not restated here: this is a footer, not the place to carry the one
             * approved fact.
             */}
            <p style={{ maxWidth: "34ch" }}>
              Petroleum products, lubricants, base oils and industrial solutions.
            </p>
          </div>

          {columns.map((col) => (
            <div className="fs-fcol" key={col.heading}>
              <h2>{col.heading}</h2>
              {col.links.map((link) => (
                <Link href={link.href} key={link.label}>
                  {link.label}
                </Link>
              ))}
            </div>
          ))}

          {/*
           * One route, no facts. The address, plant and email that stood here were unconfirmed,
           * and the email was worse than unconfirmed — `samgroup.example` is a reserved TLD that
           * can never receive mail, pointing at `#partnership`, an anchor that exists on the
           * homepage only.
           */}
          <div className="fs-fcol">
            <h2>Contact</h2>
            <Link href={localeHref(locale, ROUTES.contactUs)}>Contact Us</Link>
          </div>
        </div>

        {/* The certification bar is gone; the copyright line is the whole of the legal bar today. */}
        <div className="fs-fbot">
          <span>© 2026 Sam Group · All rights reserved</span>
        </div>
      </div>
    </footer>
  );
}
