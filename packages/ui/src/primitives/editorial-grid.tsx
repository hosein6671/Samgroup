import type { HTMLAttributes, ReactNode } from "react";

import { cn } from "../lib/cn";
import { gridPlacements } from "../tokens/layout";

/**
 * The twelve-column editorial grid.
 *
 * Deliberately not a row/column component kit. There is no `<Row>`, no `span` number, and no
 * breakpoint-suffixed class to memorise — content is placed by naming where it sits on the
 * page. That keeps asymmetric editorial spreads readable in source, which is precisely where a
 * span-counting API stops being legible.
 *
 * Below `md` the grid collapses to a single column and placements go inert, so a component
 * needs no mobile branch of its own.
 */
export type GridPlacement = keyof typeof gridPlacements;

export type EditorialGridElement = "div" | "section" | "article" | "ul" | "ol" | "dl";

export type EditorialGridProps = {
  readonly as?: EditorialGridElement;
  /**
   * Overlays the twelve tracks for alignment checking. Development aid — never ship a page
   * with this on.
   */
  readonly debug?: boolean;
  readonly children?: ReactNode;
} & Omit<HTMLAttributes<HTMLElement>, "children">;

export function EditorialGrid({
  as: Tag = "div",
  debug = false,
  className,
  children,
  ...rest
}: EditorialGridProps): ReactNode {
  return (
    <Tag className={cn("editorial-grid", debug && "editorial-grid--debug", className)} {...rest}>
      {children}
    </Tag>
  );
}

export type GridAreaElement =
  "div" | "section" | "article" | "aside" | "figure" | "li" | "header" | "footer";

export type GridAreaProps = {
  readonly at: GridPlacement;
  readonly as?: GridAreaElement;
  readonly children?: ReactNode;
} & Omit<HTMLAttributes<HTMLElement>, "children">;

const PLACEMENT_CLASS: Readonly<Record<GridPlacement, string>> = {
  full: "grid-full",
  wide: "grid-wide",
  main: "grid-main",
  "half-start": "grid-half-start",
  "half-end": "grid-half-end",
  "third-start": "grid-third-start",
  "third-mid": "grid-third-mid",
  "third-end": "grid-third-end",
  "two-thirds-start": "grid-two-thirds-start",
  "two-thirds-end": "grid-two-thirds-end",
  "margin-start": "grid-margin-start",
  "margin-end": "grid-margin-end",
};

/**
 * A placed region of the grid. `at` reads as a location — `at="margin-end"`, `at="half-start"`
 * — rather than as an arithmetic span.
 */
export function GridArea({
  at,
  as: Tag = "div",
  className,
  children,
  ...rest
}: GridAreaProps): ReactNode {
  return (
    <Tag className={cn(PLACEMENT_CLASS[at], className)} {...rest}>
      {children}
    </Tag>
  );
}
