import type { HTMLAttributes, ReactNode } from "react";

import { cn } from "../lib/cn";

/**
 * Opens a surface context. Everything inside resolves its semantic colour tokens against this
 * context, so a Button, a Divider or a TechnicalLabel is correct on midnight without knowing
 * it is on midnight.
 *
 * `inherit` opts out entirely — the element keeps whatever context it is already inside. That
 * is the correct choice for a wrapper that should not repaint.
 */
export type SurfaceContext = "light" | "midnight" | "inherit";

export type SurfaceElement = "div" | "section" | "article" | "aside" | "header" | "footer";

export type SurfaceProps = {
  readonly context?: SurfaceContext;
  readonly as?: SurfaceElement;
  readonly children?: ReactNode;
} & Omit<HTMLAttributes<HTMLElement>, "children">;

export function Surface({
  context = "light",
  as: Tag = "div",
  className,
  children,
  ...rest
}: SurfaceProps): ReactNode {
  return (
    <Tag
      data-surface={context === "inherit" ? undefined : context}
      className={cn(className)}
      {...rest}
    >
      {children}
    </Tag>
  );
}
