import type { HTMLAttributes, ReactNode } from "react";

import { cn } from "../lib/cn";

/**
 * Content available to assistive technology but not painted.
 *
 * Shipped in A-2 rather than "when it is needed", because the moments that need it — an icon
 * button's name, a table caption, a skip-link target, the text alternative every 3D or map
 * visual is required to carry (docs/technology/FRONTEND_STACK.md) — all arrive with the first
 * real page, and retrofitting accessible names is far more expensive than having the primitive
 * on hand.
 *
 * `focusable` restores the element when it receives focus, which is what a skip link needs.
 */
export type VisuallyHiddenElement = "span" | "div" | "p" | "legend" | "caption" | "h1" | "h2";

export type VisuallyHiddenProps = {
  readonly as?: VisuallyHiddenElement;
  readonly focusable?: boolean;
  readonly children?: ReactNode;
} & Omit<HTMLAttributes<HTMLElement>, "children">;

export function VisuallyHidden({
  as: Tag = "span",
  focusable = false,
  className,
  children,
  ...rest
}: VisuallyHiddenProps): ReactNode {
  return (
    <Tag className={cn("sr-only", focusable && "focus-visible:not-sr-only", className)} {...rest}>
      {children}
    </Tag>
  );
}
