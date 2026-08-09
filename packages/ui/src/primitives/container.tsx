import type { HTMLAttributes, ReactNode } from "react";

import { cn } from "../lib/cn";
import type { ContainerWidth } from "../tokens/layout";

/**
 * Container owns the horizontal axis only — width and gutters. It never sets vertical padding;
 * that belongs to Section. One owner per axis is what keeps rhythm from drifting page to page.
 *
 * The width union comes from the layout tokens rather than being restated here, so adding a
 * container width is a token change and this file stops compiling until it handles the new one.
 */

/** Deliberately a closed set rather than a generic polymorphic component: these are the tags a
 * layout wrapper legitimately needs, and the closed union keeps prop typing exact. */
export type ContainerElement =
  "div" | "section" | "article" | "aside" | "header" | "footer" | "main" | "nav";

export type ContainerProps = {
  readonly width?: ContainerWidth;
  readonly as?: ContainerElement;
  /** Drops the page gutter, for a container nested inside one that already applies it. */
  readonly flush?: boolean;
  readonly children?: ReactNode;
} & Omit<HTMLAttributes<HTMLElement>, "children">;

const WIDTH_CLASS: Readonly<Record<ContainerWidth, string>> = {
  narrow: "max-w-narrow",
  default: "max-w-default",
  wide: "max-w-wide",
  /** The reading measure, for editorial prose that should not run the full column. */
  measure: "max-w-measure",
  bleed: "max-w-none",
};

export function Container({
  width = "default",
  as: Tag = "div",
  flush = false,
  className,
  children,
  ...rest
}: ContainerProps): ReactNode {
  return (
    <Tag
      className={cn("mx-auto w-full", WIDTH_CLASS[width], !flush && "px-gutter", className)}
      {...rest}
    >
      {children}
    </Tag>
  );
}
