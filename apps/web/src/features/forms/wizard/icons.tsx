import {
  ArrowLeft,
  ArrowRight,
  Check,
  CircleAlert,
  CircleCheck,
  Send,
  ShieldAlert,
  SquarePen,
  TriangleAlert,
} from "lucide-react";

import type { ReactNode } from "react";

/**
 * The inquiry forms' icon set — one family, one stroke, one size scale.
 *
 * ── Why the icons are wrapped rather than imported directly ─────────────────
 *
 * Three properties have to hold at every call site, and each is the kind that decays silently when
 * it is left to the caller:
 *
 *   1. **One stroke width.** Mixing 1.5 and 2 across a form is the most common way an icon set
 *      stops reading as a set. `STROKE` is the only place it is written.
 *   2. **Sizes from the shared tokens**, not from Lucide's numeric `size` prop. The icons take
 *      their dimensions from `--fs-icon-sm|md|lg` through a class, so they scale with the same
 *      tokens the rest of the Flagship system uses instead of carrying a second, private scale.
 *   3. **`aria-hidden` by default.** Every icon here sits beside text that already says what it
 *      means, so every one of them is decorative to assistive technology. Making that the default
 *      — rather than something each call site remembers — is what keeps a screen reader from
 *      reading "alert circle" before an error message that begins with the word the icon depicts.
 *
 * ── None of these icons carries meaning on its own ──────────────────────────
 *
 * The step indicator says "completed" in visually-hidden text; the error message is the message;
 * the buttons keep their labels. If every icon below were removed, nothing would become
 * unavailable to anyone. That is the test they are held to (WCAG 1.4.1, 1.1.1), and it is why
 * `aria-hidden` is correct rather than lazy.
 *
 * ── Direction ───────────────────────────────────────────────────────────────
 *
 * `Back` and `Continue` are the only directional pair. They are mirrored under `dir="rtl"` by the
 * `.fw-icon--dir` class, following the rule `flagship.css` already uses for `.fs-ar`, so an arrow
 * points the way the interface reads rather than the way English reads.
 */

/** One stroke width for the whole set. Lucide's default is 2, which reads heavy at 14px. */
const STROKE = 1.75;

type IconSize = "sm" | "md" | "lg";

type IconProps = {
  /** Maps to `--fs-icon-sm|md|lg`. Defaults to `md`, the 14px status/action size. */
  readonly size?: IconSize;
  /** Adds the RTL mirror. Only the two navigation arrows need it. */
  readonly directional?: boolean;
};

function iconClass({ size = "md", directional = false }: IconProps): string {
  return ["fw-icon", `fw-icon--${size}`, directional ? "fw-icon--dir" : ""]
    .filter((token) => token !== "")
    .join(" ");
}

/*
 * `focusable="false"` alongside `aria-hidden`: IE-era SVG behaviour still surfaces in some
 * assistive technology, and an `aria-hidden` element that is still focusable is a tab stop that
 * announces nothing.
 */
const HIDDEN = { "aria-hidden": true, focusable: "false" } as const;

/** The completed-step mark, shown in place of the numeral once a step is behind the visitor. */
export function StepCompleteIcon(props: IconProps = {}): ReactNode {
  return <Check className={iconClass(props)} strokeWidth={STROKE} {...HIDDEN} />;
}

/** "Back". Mirrored under RTL. */
export function BackIcon(props: IconProps = {}): ReactNode {
  return (
    <ArrowLeft
      className={iconClass({ ...props, directional: true })}
      strokeWidth={STROKE}
      {...HIDDEN}
    />
  );
}

/** "Continue". Mirrored under RTL. */
export function ContinueIcon(props: IconProps = {}): ReactNode {
  return (
    <ArrowRight
      className={iconClass({ ...props, directional: true })}
      strokeWidth={STROKE}
      {...HIDDEN}
    />
  );
}

/** The review summary's per-step Edit action. */
export function EditIcon(props: IconProps = {}): ReactNode {
  return <SquarePen className={iconClass(props)} strokeWidth={STROKE} {...HIDDEN} />;
}

/** A field-level validation message. */
export function FieldErrorIcon(props: IconProps = {}): ReactNode {
  return <CircleAlert className={iconClass(props)} strokeWidth={STROKE} {...HIDDEN} />;
}

/** A submission-level failure banner — throttled, unavailable, rejected. */
export function FormErrorIcon(props: IconProps = {}): ReactNode {
  return <TriangleAlert className={iconClass(props)} strokeWidth={STROKE} {...HIDDEN} />;
}

/** The successful-submission banner. */
export function FormSuccessIcon(props: IconProps = {}): ReactNode {
  return <CircleCheck className={iconClass(props)} strokeWidth={STROKE} {...HIDDEN} />;
}

/** The Turnstile dead end — the script did not load, or Cloudflare reported an error. */
export function ChallengeErrorIcon(props: IconProps = {}): ReactNode {
  return <ShieldAlert className={iconClass(props)} strokeWidth={STROKE} {...HIDDEN} />;
}

/** The final submit action, on the review step only. */
export function SubmitIcon(props: IconProps = {}): ReactNode {
  return <Send className={iconClass(props)} strokeWidth={STROKE} {...HIDDEN} />;
}
