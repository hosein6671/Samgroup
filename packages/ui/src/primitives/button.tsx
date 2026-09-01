import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from "react";

import { cn } from "../lib/cn";

/**
 * `link` and `link-cta` are not a styling choice — they are an accessibility distinction.
 *
 * WCAG 2.5.8 exempts a target that sits "in a sentence or block of text", because enlarging an
 * inline link would break the line box around it. `link` is that exempt case and carries no
 * minimum size. `link-cta` is a standalone action that merely looks like a link, has no such
 * exemption, and therefore takes the full 44x44 target regardless of the `size` prop.
 *
 * Before this split, one variant served both and neither got it right: standalone link actions
 * rendered at text height, well under the floor.
 */
export type ButtonVariant = "primary" | "secondary" | "ghost" | "link" | "link-cta";
export type ButtonSize = "sm" | "md" | "lg";

type ButtonBase = {
  readonly variant?: ButtonVariant;
  readonly size?: ButtonSize;
  readonly fullWidth?: boolean;
  readonly children?: ReactNode;
  readonly className?: string;
};

type AsButton = ButtonBase &
  Omit<ButtonHTMLAttributes<HTMLButtonElement>, "className" | "children"> & {
    readonly href?: undefined;
  };

type AsAnchor = ButtonBase &
  Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "className" | "children"> & {
    readonly href: string;
  };

export type ButtonProps = AsButton | AsAnchor;

const DISABLED =
  "disabled:pointer-events-none disabled:opacity-45 " +
  "aria-disabled:pointer-events-none aria-disabled:opacity-45";

const BASE =
  // Logical padding and inline-flex so the label centres in both directions without an RTL branch.
  "inline-flex items-center justify-center gap-2 rounded-md font-text font-medium " +
  `transition-colors duration-200 select-none ${DISABLED}`;

/** Text-only base for the inline variant: no box, no centring, no fixed height. */
const BASE_INLINE = `font-text font-medium transition-colors duration-200 ${DISABLED}`;

const VARIANT_CLASS: Readonly<Record<ButtonVariant, string>> = {
  // The accent's only structural job on the page.
  primary: "bg-accent-default text-text-on-accent hover:bg-accent-hover",
  // border-strong rather than border-hairline: this outline is the only thing identifying the
  // control, which puts it under WCAG 1.4.11's 3:1 floor. Audited in both surface contexts.
  secondary: "border border-border-strong bg-transparent text-text-primary hover:bg-surface-sunken",
  ghost: "bg-transparent text-text-accent hover:bg-accent-muted",
  // Inline, inside running text. Renders as `inline` rather than `inline-flex` so it wraps with
  // the sentence it belongs to instead of forming an unbreakable box mid-paragraph.
  link: "inline bg-transparent text-text-accent underline underline-offset-4 hover:decoration-2",
  "link-cta": "bg-transparent text-text-accent underline underline-offset-4 hover:decoration-2",
};

const SIZE_CLASS: Readonly<Record<ButtonSize, string>> = {
  sm: "min-h-9 px-4 text-caption",
  // 44px minimum on the default and large sizes. That is WCAG 2.2 SC **2.5.5** Target Size
  // (Enhanced), Level **AAA** — not the AA floor, which is SC 2.5.8 Target Size (Minimum) at
  // **24×24** CSS px. The sizes are unchanged and deliberate: a comfortable target is worth
  // keeping, and a visually restrained button loses one very easily. Only the citation was
  // wrong, and citing AAA as AA is how a real AA failure elsewhere gets waved through.
  md: "min-h-11 px-6 text-body",
  lg: "min-h-13 px-8 text-body",
};

/**
 * A standalone link-styled action takes the full target on both axes and ignores `size`.
 * min-w matters as much as min-h here: a short label like "More" is narrower than 44px on its
 * own, and inline-flex centring is what keeps it looking like a link rather than a padded box.
 */
const LINK_CTA_TARGET = "min-h-11 min-w-11";

/** Variants that opt out of the size scale entirely. */
const SIZELESS_VARIANTS: ReadonlySet<ButtonVariant> = new Set(["link", "link-cta"]);

/**
 * The button's classes, exported separately so a Next.js `Link` can be styled as a button
 * without nesting an anchor inside an anchor. Keeping `packages/ui` free of a framework
 * import is what makes this necessary — and keeps the package reusable beyond `apps/web`.
 */
export function buttonClasses(
  variant: ButtonVariant = "primary",
  size: ButtonSize = "md",
  fullWidth = false,
  className?: string,
): string {
  return cn(
    // The inline variant must not inherit inline-flex from BASE, or it stops wrapping with its
    // sentence — so it takes only the parts of BASE that apply to text.
    variant === "link" ? BASE_INLINE : BASE,
    VARIANT_CLASS[variant],
    SIZELESS_VARIANTS.has(variant) ? "" : SIZE_CLASS[size],
    variant === "link-cta" && LINK_CTA_TARGET,
    fullWidth && "w-full",
    className,
  );
}

export function Button(props: ButtonProps): ReactNode {
  const {
    variant = "primary",
    size = "md",
    fullWidth = false,
    className,
    children,
    ...rest
  } = props;
  const classes = buttonClasses(variant, size, fullWidth, className);

  if (rest.href !== undefined) {
    return (
      <a className={classes} {...rest}>
        {children}
      </a>
    );
  }

  // type defaults to "button": an unqualified <button> inside a form submits it, which is a
  // real defect class once the M4 submission forms land.
  return (
    <button {...rest} type={rest.type ?? "button"} className={classes}>
      {children}
    </button>
  );
}
