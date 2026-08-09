import type { HTMLAttributes, ReactNode } from "react";

import { cn } from "../lib/cn";

/**
 * A hairline. Small piece, disproportionate effect: precise rules are most of what makes a
 * layout read as engineered rather than merely spacious.
 *
 * The gradient variants fade at both ends, which is what stops a full-bleed rule looking like
 * a border.
 */
export type DividerVariant = "hairline" | "platinum" | "accent" | "brass";
export type DividerOrientation = "horizontal" | "vertical";

export type DividerProps = {
  readonly variant?: DividerVariant;
  readonly orientation?: DividerOrientation;
  /**
   * Whether the rule separates content semantically. Decorative is the default and the common
   * case — announcing every visual flourish as a separator is noise in a screen reader.
   */
  readonly decorative?: boolean;
  readonly children?: never;
} & Omit<HTMLAttributes<HTMLElement>, "children" | "role">;

const VARIANT_CLASS: Readonly<Record<DividerVariant, string>> = {
  hairline: "bg-border-hairline",
  platinum: "divider-platinum",
  accent: "divider-accent",
  brass: "divider-brass",
};

export function Divider({
  variant = "hairline",
  orientation = "horizontal",
  decorative = true,
  className,
  ...rest
}: DividerProps): ReactNode {
  const isHorizontal = orientation === "horizontal";
  return (
    <div
      role={decorative ? "presentation" : "separator"}
      aria-orientation={decorative ? undefined : orientation}
      aria-hidden={decorative ? true : undefined}
      className={cn(
        "shrink-0 border-0",
        isHorizontal ? "h-px w-full" : "h-full w-px self-stretch",
        VARIANT_CLASS[variant],
        className,
      )}
      {...rest}
    />
  );
}
