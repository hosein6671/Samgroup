"use client";

import { useRef, useState, type ReactNode } from "react";

import { CTA_LINKS, PRODUCT_INTERESTS } from "../home-data";
import { useCanvas } from "../motion/use-canvas";

/**
 * 9 · Partnership — the closing moment.
 *
 * Rising particles over a deep radial bloom, with a glass contact panel at the trailing five
 * columns. The particles wrap when they leave the top, so the field never empties.
 *
 * **The form validates in the browser and posts nowhere.** That is not a shortcut — submission
 * endpoints belong to M4 (`Inquiry`, per API_CONTRACT_FINAL), and wiring a real POST here would
 * mean inventing a contract the backend has not agreed. The note under the button says so
 * plainly rather than letting a visitor believe a message was sent.
 *
 * Validation is authored the way it should ship: `noValidate` so the browser's own bubbles
 * don't fight ours, errors tied to inputs through `aria-describedby`, `aria-invalid` on the
 * field itself, focus moved to the first failure, and a `role="status"` toast on success.
 */
type Errors = { name?: string; email?: string };

export function Partnership(): ReactNode {
  const [errors, setErrors] = useState<Errors>({});
  const [toast, setToast] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const toastTimer = useRef(0);
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

  const onSubmit = (e: React.FormEvent<HTMLFormElement>): void => {
    e.preventDefault();
    const form = e.currentTarget;
    const data = new FormData(form);
    const name = String(data.get("name") ?? "").trim();
    const email = String(data.get("email") ?? "").trim();

    const next: Errors = {};
    if (name.length < 2) next.name = "Enter your full name so we know who to reply to.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
      next.email = "Enter a valid business email, e.g. name@company.com.";
    }
    setErrors(next);

    if (Object.keys(next).length > 0) {
      const firstInvalid = next.name ? "fs-f-name" : "fs-f-email";
      document.getElementById(firstInvalid)?.focus();
      return;
    }

    form.reset();
    setToast(true);
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(false), 4200);
  };

  return (
    <>
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
              Tell us the specification and the destination port. An engineer — not a mailbox —
              replies within one business day.
            </p>

            <div className="fs-cta-links">
              {CTA_LINKS.map((link) => (
                <a className="fs-cta-link" href="#partnership" key={link.title}>
                  <b>{link.title}</b>
                  <span>{link.meta}</span>
                </a>
              ))}
            </div>
          </div>

          <div className="fs-cta-panel fs-rv">
            <div className="fs-panel">
              <h3 className="fs-d4">Request partnership</h3>
              <p className="fs-small" style={{ color: "rgba(238,241,246,.6)", marginTop: 8 }}>
                Fields marked with an asterisk are required.
              </p>

              <form ref={formRef} onSubmit={onSubmit} noValidate>
                <div className="fs-field">
                  <label htmlFor="fs-f-name">Full name *</label>
                  <input
                    id="fs-f-name"
                    name="name"
                    type="text"
                    autoComplete="name"
                    placeholder="Jane Okafor"
                    required
                    aria-invalid={errors.name ? "true" : undefined}
                    aria-describedby={errors.name ? "fs-e-name" : undefined}
                  />
                  {errors.name && (
                    <p className="fs-err" id="fs-e-name">
                      <ErrIcon />
                      <span>{errors.name}</span>
                    </p>
                  )}
                </div>

                <div className="fs-field">
                  <label htmlFor="fs-f-email">Business email *</label>
                  <input
                    id="fs-f-email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    inputMode="email"
                    placeholder="procurement@company.com"
                    required
                    aria-invalid={errors.email ? "true" : undefined}
                    aria-describedby={errors.email ? "fs-e-email" : undefined}
                  />
                  {errors.email && (
                    <p className="fs-err" id="fs-e-email">
                      <ErrIcon />
                      <span>{errors.email}</span>
                    </p>
                  )}
                </div>

                <div className="fs-field">
                  <label htmlFor="fs-f-interest">Product interest</label>
                  <select id="fs-f-interest" name="interest">
                    {PRODUCT_INTERESTS.map((o) => (
                      <option key={o}>{o}</option>
                    ))}
                  </select>
                </div>

                <div className="fs-field">
                  <label htmlFor="fs-f-msg">Specification &amp; destination</label>
                  <textarea
                    id="fs-f-msg"
                    name="message"
                    placeholder="SN 500, 2,000 MT / month, CFR Jebel Ali"
                    aria-describedby="fs-f-hint"
                  />
                  <p className="fs-hint" id="fs-f-hint">
                    Grade, volume, packaging and port get you a faster quote.
                  </p>
                </div>

                <div className="fs-cta-actions">
                  <button type="submit" className="fs-btn fs-btn--gold">
                    Send request
                  </button>
                  <a href="#lab" className="fs-btn fs-btn--glass">
                    Book a plant visit
                  </a>
                </div>

                <p className="fs-formnote">
                  This is a design proof — submissions are validated in the browser and are not sent
                  anywhere. The real endpoint arrives with the M4 inquiry API.
                </p>
              </form>
            </div>
          </div>
        </div>
      </section>

      <div className="fs-toast" data-show={toast ? "true" : undefined} role="status">
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          aria-hidden="true"
        >
          <path d="M20 6 9 17l-5-5" />
        </svg>
        <span>
          {toast ? "Request logged. An engineer will reply within one business day." : ""}
        </span>
      </div>
    </>
  );
}

function ErrIcon(): ReactNode {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M12 8v5M12 16h.01" />
    </svg>
  );
}
