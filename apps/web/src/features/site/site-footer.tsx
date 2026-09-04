import Link from "next/link";
import type { ReactNode } from "react";

import { getPrivacyPolicyHref } from "@/features/legal/privacy-policy";

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
 *
 * ── The legal bar, and why it is `async` ────────────────────────────────────
 *
 * SITE_STRUCTURE §0 places the Privacy Policy in the footer and nowhere else in the navigation, so
 * this is the surface that has to carry it. It is the only link here that is not a constant: the
 * canonical route answers 404 until an editor publishes the policy in Payload, and a dead privacy
 * link in the footer of **every** page is the largest broken promise the platform could make. So
 * the address is asked for rather than assumed — `getPrivacyPolicyHref` returns one only while the
 * CMS is actually serving a published policy, and the bar renders the copyright line alone
 * otherwise. See `features/legal/privacy-policy.ts` for the five states it collapses.
 *
 * That is what makes this component `async`. It costs one API read per render, memoized per request
 * and shared with the consent labels and the Privacy Policy route itself, and every consumer of
 * this footer is a Server Component, so no call site changes.
 */
export async function SiteFooter({
  locale,
}: {
  /** The route's locale segment, resolved on the server. The footer never negotiates one. */
  readonly locale: string;
}): Promise<ReactNode> {
  const columns = footerColumnsFor(locale);
  const homeHref = localeHref(locale, ROUTES.home);
  const privacyPolicyHref = await getPrivacyPolicyHref(locale);

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

        {/*
         * The certification bar is gone. What remains is the copyright line and — only once a
         * published policy exists — the Privacy Policy link beside it. `.fs-fbot` is a
         * `space-between` flex row, so it lays out correctly with one child or with two.
         */}
        <div className="fs-fbot">
          <span>© 2026 Sam Group · All rights reserved</span>
          {privacyPolicyHref !== null && (
            <Link href={privacyPolicyHref} className="fs-flegal">
              Privacy Policy
            </Link>
          )}
        </div>
      </div>
    </footer>
  );
}
