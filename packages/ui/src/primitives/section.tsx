import type { HTMLAttributes, ReactNode } from "react";

import { cn } from "../lib/cn";
import type { SurfaceContext } from "./surface";

/**
 * Section is the rhythm backbone: it owns vertical space and opens a surface context. Those
 * two responsibilities sit together because a midnight band and the breathing room around it
 * are the same design gesture — splitting them produced sections that changed colour without
 * changing pace.
 *
 * Selective dark sections (R&D and innovation, the final call to action, storytelling
 * moments) are `surface="midnight"`. Nothing else is required to make them work.
 */
export type SectionRhythm = "compact" | "default" | "editorial" | "none";

export type SectionElement = "section" | "div" | "article" | "aside" | "header" | "footer";

export type SectionProps = {
  readonly rhythm?: SectionRhythm;
  readonly surface?: SurfaceContext;
  readonly as?: SectionElement;
  readonly children?: ReactNode;
} & Omit<HTMLAttributes<HTMLElement>, "children">;

const RHYTHM_CLASS: Readonly<Record<SectionRhythm, string>> = {
  compact: "py-section-compact",
  default: "py-section-default",
  editorial: "py-section-editorial",
  none: "",
};

export function Section({
  rhythm = "default",
  surface = "inherit",
  as: Tag = "section",
  className,
  children,
  ...rest
}: SectionProps): ReactNode {
  return (
    <Tag
      data-surface={surface === "inherit" ? undefined : surface}
      className={cn("relative w-full", RHYTHM_CLASS[rhythm], className)}
      {...rest}
    >
      {children}
    </Tag>
  );
}
