"use client";

import { useRef, type ReactNode } from "react";

import { InquiryForm } from "@/features/forms/inquiry-form";
import { DEFAULT_INQUIRY_TYPE } from "@/features/forms/inquiry-vocabulary";
import { localeHref } from "@/features/site/site-routes";

import "../../forms/forms.css";

import { BrandedPhoto } from "../branded-photo";
import { CTA_LINKS } from "../home-data";
import { useCanvas } from "../motion/use-canvas";

/**
 * 9 · Partnership — the closing inquiry.
 *
 * The panel embeds the platform's single real `InquiryForm`; it does not duplicate fields,
 * validation or submission state. The Server Action forwards the approved payload to
 * `POST /inquiries`, so the homepage and Contact Us share one write path and one success/error
 * contract. No response-time promise is made because none is confirmed.
 *
 * `locale` addresses the three supporting links through the same canonical prefix helper used by
 * the header and footer. Form submission itself is locale-independent and remains server-side.
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
          <div className="fs-eyebrow">Start a focused product enquiry</div>
          <h2 className="fs-d2" style={{ marginTop: 22, maxWidth: "13ch" }}>
            <span className="fs-line-mask">
              <span>Share the product,</span>
            </span>
            <span className="fs-line-mask">
              <span>specification, or</span>
            </span>
            <span className="fs-line-mask">
              <span style={{ color: "var(--fs-gold-2)" }}>application you need.</span>
            </span>
          </h2>
          <p className="fs-lead" style={{ marginTop: 26, color: "rgba(238,241,246,.72)" }}>
            Add the details you already know. Grade, quantity, packaging, and destination help SAM
            Group route the enquiry to the right commercial or technical next step.
          </p>

          <BrandedPhoto
            src="/images/home/cta-technical-conversation.png"
            alt="Two professionals reviewing a lubricant sample and technical document"
            caption="Product and technical enquiry"
            className="fs-cta-photo"
            sizes="(max-width: 1180px) calc(100vw - 40px), 31vw"
          />

          <div className="fs-cta-links">
            {CTA_LINKS.map((link) => (
              <a className="fs-cta-link" href={localeHref(locale, link.href)} key={link.title}>
                <b>{link.title}</b>
                <span>{link.meta}</span>
              </a>
            ))}
          </div>
        </div>

        <div className="fs-cta-panel fs-rv">
          <div className="fs-panel" aria-labelledby="home-inquiry-heading">
            <h3 className="fs-d4" id="home-inquiry-heading">
              Send your requirement
            </h3>
            <p className="fs-small" style={{ color: "rgba(238,241,246,.72)", marginTop: 10 }}>
              Use one concise form for product questions, quotation requests, and sample enquiries.
            </p>
            <div className="fs-cta-form">
              <InquiryForm inquiryType={DEFAULT_INQUIRY_TYPE} variant="compact" />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
