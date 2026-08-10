import Image from "next/image";
import type { ReactNode } from "react";

/**
 * The official Sam Group mark.
 *
 * One component, one asset (`public/brand/sam-group-mark.png`), used by the navbar, the footer
 * and the boot curtain. The artwork is shipped exactly as supplied — not redrawn, not recoloured,
 * not re-encoded.
 *
 * ── Why there is a crop wrapper ─────────────────────────────────────────────
 *
 * The supplied file is an 8000×8000 *square* canvas, but the mark inside it is a wide letterform
 * that occupies only the middle band. Measured off the real file: content fills 85.8% of the
 * width and 54.3% of the height, centred, with the rest fully transparent.
 *
 * Rendering the square directly would mean a 34px-tall box containing an 18px-tall mark, with
 * 8px of dead space above and below silently inflating every lockup it sits in. So the wrapper
 * is sized to the *content* aspect ratio and the image is scaled up inside it until the content
 * exactly fills that box, then centred and clipped.
 *
 * This crops nothing but transparency — every pixel of the artwork is present and at its true
 * proportions. The alternative, re-exporting a trimmed PNG, would mean re-encoding artwork we
 * were told to use as-is.
 */

/** Width ÷ height of the visible artwork. Measured, not assumed: 686 × 434 device px. */
const MARK_ASPECT = 1.5806;

/**
 * How much larger the square canvas is than the content it holds, vertically.
 * Content is 54.3% of the canvas height, so the canvas renders at 1/0.543 of the target height.
 */
const CANVAS_SCALE = 1.8416;

export type LogoMarkProps = {
  /** Height of the visible mark in px. Width follows from the artwork's own ratio. */
  readonly height?: number;
  /**
   * Set on the navbar instance only. The mark is above the fold and inside the LCP viewport,
   * so it should not wait behind the lazy-loading queue.
   */
  readonly priority?: boolean;
};

export function LogoMark({ height = 30, priority = false }: LogoMarkProps): ReactNode {
  const canvas = Math.round(height * CANVAS_SCALE);

  return (
    <span
      className="fs-mark"
      // Height goes through a custom property rather than a fixed width/height pair so a media
      // query can retune it — the real mark is 1.58:1 where the placeholder was square, and at
      // 390px that extra ~10px left the nav lockup touching the CTA. Width is derived in CSS
      // from the artwork's own ratio, so the aspect can never be set wrong at a call site.
      style={{ "--mark-h-base": `${height}px` } as React.CSSProperties}
    >
      <Image
        src="/brand/sam-group-mark.png"
        // Empty alt by design: every placement sits beside the "SAM GROUP" wordmark in text,
        // and the link itself carries the accessible name. Alt text here would make a screen
        // reader announce the company twice on one control.
        alt=""
        width={canvas}
        height={canvas}
        priority={priority}
        className="fs-mark__img"
      />
    </span>
  );
}

/** The trailing arrow on every call to action. Slides on hover; mirrors under RTL via CSS. */
export function Arrow({ size = 15 }: { readonly size?: number }): ReactNode {
  return (
    <svg
      className="fs-ar"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      aria-hidden="true"
    >
      <path d="M5 12h13M13 6l6 6-6 6" />
    </svg>
  );
}
