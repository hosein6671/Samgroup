"use client";

import { useRef, type ReactNode } from "react";

import { Arrow } from "@/features/site/logo-mark";
import { localeHref, ROUTES } from "@/features/site/site-routes";

import { CTA_LINKS } from "../home-data";
import { useCanvas } from "../motion/use-canvas";

/**
 * 9 · Partnership — the closing moment.
 *
 * Rising particles over a deep radial bloom, with a glass panel at the trailing five columns.
 * The particles wrap when they leave the top, so the field never empties.
 *
 * ── The form is gone, and why ───────────────────────────────────────────────
 *
 * This section used to hold a second inquiry form. It validated in the browser, called
 * `form.reset()`, raised a success toast reading "Request logged. An engineer will reply within one
 * business day" — and **discarded the lead**. That was defensible while no submission endpoint
 * existed anywhere and the note under the button said so plainly.
 *
 * It stopped being defensible the moment `POST /inquiries` shipped. A visitor who filled this in
 * was told their request had been logged when nothing had been stored and nobody would ever see it,
 * while an identical request three clicks away on Contact Us would have been persisted. A form that
 * fakes success is the one thing worse than no form.
 *
 * **The panel is now a route into the real flow**, not a second submission path. There is exactly
 * one Inquiry write path on this platform (`features/forms`), and this section deliberately does
 * not duplicate a field of it — the fields a buyer needs are the ones Contact Us already collects,
 * validated server-side against the DTO, stored with consent.
 *
 * ── Two claims removed with it ──────────────────────────────────────────────
 *
 * The lead said "An engineer — not a mailbox — replies within one business day", and the toast
 * repeated the same promise. **Response time is unconfirmed** — SITE_STRUCTURE's Outstanding
 * Confirmations lists it, and it is why the real forms' success copy is "Your inquiry has been
 * received" and nothing more. Promising one business day here while the form that actually stores
 * the lead promises nothing would have been the site contradicting itself.
 */
/**
 * `locale` is the route's own locale segment, threaded down from `HomeExperience`.
 *
 * The three `CTA_LINKS` destinations and the two panel actions are structural paths owned by
 * `site-routes.ts`, and until now they were rendered raw. On `/fa` that emitted `/contact-us`,
 * which `middleware.ts` re-negotiates from the cookie and `Accept-Language` — so a Persian reader
 * could be answered in English. `localeHref` is the one prefix rule the header and footer already
 * go through; the paths in `CTA_LINKS` stay locale-less, and the locale is applied here.
 */
export function Partnership({ locale }: { readonly locale: string }): ReactNode {
  const particles = useRef<
    { x: number; y: number; r: number; s: number; o: number; gold: boolean }[]
  >([]);

  const canvasRef = useCanvas(
    ({ ctx, w, h, reduced }) => {
      ctx.clearRect(0, 0, w, h);
      const bloom = ctx.createRadialGradient(w * 0.5, h * 1.1, 0, w * 0.5, h * 1.1, h * 1.3);
      bloom.addColorStop(0, "rgba(18,41,110,.5)");
      bloom.addColorStop(1, "rgba(3,11,31,0)");
      ctx.fillStyle = bloom;
      ctx.fillRect(0, 0, w, h);

      for (const p of particles.current) {
        if (!reduced) {
          p.y -= p.s;
          if (p.y < -6) {
            p.y = h + 6;
            p.x = Math.random() * w;
          }
        }
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, 6.2832);
        ctx.fillStyle = p.gold
          ? `rgba(227,198,137,${p.o.toFixed(2)})`
          : `rgba(199,205,214,${(p.o * 0.7).toFixed(2)})`;
        ctx.fill();
      }
    },
    {
      onResize: (w, h) => {
        const n = Math.round(Math.min(130, Math.max(40, w / 12)));
        particles.current = Array.from({ length: n }, () => ({
          x: Math.random() * w,
          y: Math.random() * h,
          r: 0.6 + Math.random() * 1.8,
          s: 0.12 + Math.random() * 0.5,
          o: 0.15 + Math.random() * 0.5,
          gold: Math.random() > 0.7,
        }));
      },
    },
  );

  return (
    <section className="fs-sec fs-cta" id="partnership" data-surface="midnight">
      <canvas ref={canvasRef} aria-hidden="true" />
      <div className="fs-wrap fs-grid12" style={{ alignItems: "center" }}>
        <div className="fs-cta-copy fs-rv">
          <div className="fs-eyebrow">Partnership</div>
          <h2 className="fs-d2" style={{ marginTop: 22, maxWidth: "13ch" }}>
            <span className="fs-line-mask">
              <span>Building the future</span>
            </span>
            <span className="fs-line-mask">
              <span>of industrial</span>
            </span>
            <span className="fs-line-mask">
              <span style={{ color: "var(--fs-gold-2)" }}>performance.</span>
            </span>
          </h2>
          <p className="fs-lead" style={{ marginTop: 26, color: "rgba(238,241,246,.72)" }}>
            Tell us the specification and the destination port. The more of a requirement an inquiry
            carries, the fewer rounds it takes to answer.
          </p>

          <div className="fs-cta-links">
            {CTA_LINKS.map((link) => (
              <a className="fs-cta-link" href={localeHref(locale, link.href)} key={link.title}>
                <b>{link.title}</b>
                <span>{link.meta}</span>
              </a>
            ))}
          </div>
        </div>

        {/*
         * The panel keeps its position in the composition and sends people to the one form that
         * stores what they write. No fields, no local state, no second endpoint.
         */}
        <div className="fs-cta-panel fs-rv">
          <div className="fs-panel">
            <h3 className="fs-d4">Send an inquiry</h3>
            <p className="fs-small" style={{ color: "rgba(238,241,246,.72)", marginTop: 10 }}>
              Product questions, quotations and sample requests all go through one form. Give the
              grade, the volume, the packaging and the destination port, and the exchange starts a
              round further on.
            </p>

            <div className="fs-cta-actions" style={{ marginTop: 26 }}>
              <a href={localeHref(locale, ROUTES.contactUs)} className="fs-btn fs-btn--gold">
                Contact Us
                <Arrow size={15} />
              </a>
              <a href={localeHref(locale, ROUTES.requestQuote)} className="fs-btn fs-btn--glass">
                Request a quote
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
