"use client";

import Image from "next/image";
import { useRef, type ReactNode } from "react";

import { Arrow } from "@/features/site/logo-mark";

import { LAB_CARDS, LAB_TAGS } from "../home-data";
import { Counter } from "../motion/counter";
import { useCanvas } from "../motion/use-canvas";

/**
 * 6 · Research & innovation.
 *
 * A molecular field behind the copy: drifting nodes with bonds drawn between any pair closer
 * than 148px, so the lattice forms and dissolves as the points move. One node in seven is gold,
 * which is what keeps it from reading as a generic particle background.
 *
 * The pair loop is O(n²), so the count is derived from area and capped at 90 — at that ceiling
 * it is ~4,000 distance checks a frame, which is negligible, and it stops a 4K monitor
 * quietly turning this into the most expensive thing on the page.
 */
type Point = { x: number; y: number; vx: number; vy: number; r: number };

export function Lab(): ReactNode {
  const pts = useRef<Point[]>([]);

  const canvasRef = useCanvas(
    ({ ctx, w, h, reduced }) => {
      ctx.clearRect(0, 0, w, h);

      if (!reduced) {
        for (const p of pts.current) {
          p.x += p.vx;
          p.y += p.vy;
          if (p.x < 0 || p.x > w) p.vx *= -1;
          if (p.y < 0 || p.y > h) p.vy *= -1;
        }
      }

      const list = pts.current;
      for (let i = 0; i < list.length; i++) {
        for (let j = i + 1; j < list.length; j++) {
          const a = list[i];
          const b = list[j];
          if (!a || !b) continue;
          const d = Math.hypot(a.x - b.x, a.y - b.y);
          if (d >= 148) continue;
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.strokeStyle = `rgba(199,205,214,${((1 - d / 148) * 0.17).toFixed(3)})`;
          ctx.lineWidth = 0.7;
          ctx.stroke();
        }
      }

      list.forEach((p, i) => {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, 6.2832);
        ctx.fillStyle = i % 7 === 0 ? "rgba(227,198,137,.75)" : "rgba(199,205,214,.4)";
        ctx.fill();
      });
    },
    {
      onResize: (w, h) => {
        const n = Math.round(Math.min(90, Math.max(26, (w * h) / 26000)));
        pts.current = Array.from({ length: n }, () => ({
          x: Math.random() * w,
          y: Math.random() * h,
          vx: (Math.random() - 0.5) * 0.22,
          vy: (Math.random() - 0.5) * 0.22,
          r: 1 + Math.random() * 2.4,
        }));
      },
    },
  );

  return (
    <section className="fs-sec fs-lab" id="lab" data-surface="midnight">
      <canvas ref={canvasRef} aria-hidden="true" />
      <div className="fs-wrap fs-grid12" style={{ alignItems: "center" }}>
        <div className="fs-lab-copy fs-rv">
          <div className="fs-eyebrow">Product information and technical review</div>
          <h2 className="fs-d2" style={{ marginTop: 22, maxWidth: "14ch" }}>
            <span className="fs-line-mask">
              <span>Technical context</span>
            </span>
            <span className="fs-line-mask">
              <span>belongs beside</span>
            </span>
            <span className="fs-line-mask">
              <span style={{ color: "var(--fs-gold-2)" }}>the product.</span>
            </span>
          </h2>
          <p className="fs-lead" style={{ marginTop: 26, color: "rgba(238,241,246,.72)" }}>
            Evaluate a product through its recorded grade, typical properties, claims, and available
            documents. Confirm suitability against the actual application and specification.
          </p>
          <div className="fs-tags" style={{ marginTop: 26 }}>
            {LAB_TAGS.map((tag) => (
              <span className="fs-tag fs-tag--dark" key={tag}>
                {tag}
              </span>
            ))}
          </div>
          <a href="#partnership" className="fs-btn fs-btn--glass" style={{ marginTop: 32 }}>
            Discuss a product requirement
            <Arrow />
          </a>
        </div>

        <figure className="fs-lab-photo fs-rv">
          <Image
            src="/images/home/lab-refrigerator-compressor-oil.png"
            alt="Laboratory sample of Refrigerator Compressor Oil KD with a glass pipette"
            fill
            sizes="(max-width: 900px) calc(100vw - 40px), 42vw"
          />
          <figcaption>
            <span>SAM Group product sample</span>
            Refrigerator Compressor Oil KD
          </figcaption>
        </figure>

        <div className="fs-lab-cards fs-rv">
          {LAB_CARDS.map((card) => (
            <div className="fs-lcard" key={card.label}>
              <Counter value={card.value} suffix={card.suffix} className="fs-tnum" />
              <span>{card.label}</span>
              <p>{card.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
