import type { ReactNode } from "react";

import { Arrow } from "@/features/site/logo-mark";

import { actionHref } from "../category-contract";
import type { SectionProps } from "../category-section";

/**
 * 11 · FAQ — SITE_STRUCTURE §4 item 11.
 *
 * ── Every answer is traceable ───────────────────────────────────────────────
 *
 * An FAQ is where a product page invents commercial claims most easily, because a question
 * invites an answer and an answer sounds like a fact. Every entry in the fixture cites the
 * document it comes from, inline, beside the answer — sampling policy from §7, the gating split
 * from the data model, the taxonomy from §4. Nothing here is written for the first time on this
 * page.
 *
 * ── Native disclosure, no JavaScript ────────────────────────────────────────
 *
 * `<details>`/`<summary>` — an accordion the platform already implements, keyboard-operable and
 * screen-reader-announced without a line of script, and searchable in-page in browsers that
 * expand hidden content for find-in-page. A hand-built accordion would need `"use client"`,
 * state, and ARIA to arrive at the same place.
 *
 * ── `FAQPage` structured data is not emitted ────────────────────────────────
 *
 * §4 item 11 notes this section "also feeds `FAQPage` schema". It does not yet. JSON-LD renders
 * through the one shared `<JsonLd>` component specified in FRONTEND_ARCHITECTURE §4 —
 * "never hand-written inline per page" — and that component does not exist. Writing a bare
 * script tag here would be the exact pattern that document forbids, and building the shared
 * component would be adding site architecture inside a page task. Reported, not done.
 */
export function CategoryFaq({ content, locale }: SectionProps): ReactNode {
  const { faq } = content;
  if (faq.length === 0) return null;

  return (
    <section className="fs-sec pc-faq" id="faq" data-surface="light">
      <div className="fs-wrap pc-faq-grid">
        <header className="pc-faq-head reveal-fade-rise">
          <p className="fs-eyebrow">Questions</p>
          <h2 className="fs-d2">Asked before an enquiry.</h2>
          <p className="fs-small pc-faq-note">
            Answers here restate what is already documented elsewhere on the platform, and link to
            wherever that is.
          </p>
        </header>

        <div className="pc-faq-list reveal-stagger">
          {faq.map((entry) => (
            <details className="pc-faq-item" key={entry.id} name="category-faq">
              <summary>
                <span>{entry.question}</span>
                <span className="pc-faq-mark" aria-hidden="true" />
              </summary>

              <div className="pc-faq-answer">
                <p>{entry.answer}</p>

                {entry.link && (
                  <p className="pc-faq-link">
                    <a href={actionHref(locale, entry.link.route)}>
                      {entry.link.label}
                      <Arrow size={13} />
                    </a>
                  </p>
                )}
              </div>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
