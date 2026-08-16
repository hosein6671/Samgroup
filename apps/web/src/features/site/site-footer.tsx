import type { ReactNode } from "react";

import { LogoMark } from "./logo-mark";
import { FOOTER_COLUMNS, ROUTES } from "./site-routes";

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
 */
export function SiteFooter(): ReactNode {
  return (
    <footer className="fs-footer" data-surface="midnight">
      <div className="fs-wrap">
        <div className="fs-fgrid">
          <div className="fs-fcol">
            <a
              href="#top"
              className="fs-logo"
              aria-label="Sam Group — home"
              style={{ marginBottom: 18 }}
            >
              <LogoMark height={28} />
              <span>
                <span className="fs-logo-txt">SAM GROUP</span>
                <span className="fs-logo-sub">Petroleum Engineering</span>
              </span>
            </a>
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

          {FOOTER_COLUMNS.map((col) => (
            <div className="fs-fcol" key={col.heading}>
              <h2>{col.heading}</h2>
              {col.links.map((link) => (
                <a href={link.href} key={link.label}>
                  {link.label}
                </a>
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
            <a href={ROUTES.contactUs}>Contact Us</a>
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
