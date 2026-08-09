import type { HTMLAttributes, ReactNode } from "react";

import { cn } from "../lib/cn";

/**
 * A frosted, metal-edged surface treatment — the material language shared by bespoke
 * storytelling sections, and one of the things carrying visual weight while launch
 * photography remains an open content dependency (docs/ROADMAP.md M5).
 *
 * It is a treatment, not a surface context: it reads its glass tokens from whichever context
 * it sits inside, so one component is correct on warm white and on midnight. Named
 * `IndustrialGlassPanel` per docs/frontend/FRONTEND_ARCHITECTURE.md section 4 — not
 * `GlassPanel`, which is not the project's term (CLAUDE.md section 3).
 */
export type GlassPanelElement = "div" | "article" | "aside" | "figure" | "section";

export type IndustrialGlassPanelProps = {
  readonly as?: GlassPanelElement;
  /** The metallic top edge. Off by default — it is an accent, and every panel wearing it is
   * no longer an accent. */
  readonly sheen?: boolean;
  readonly padding?: "none" | "sm" | "md" | "lg";
  readonly children?: ReactNode;
} & Omit<HTMLAttributes<HTMLElement>, "children">;

const PADDING_CLASS: Readonly<Record<NonNullable<IndustrialGlassPanelProps["padding"]>, string>> = {
  none: "",
  sm: "p-6",
  md: "p-8",
  lg: "p-12",
};

export function IndustrialGlassPanel({
  as: Tag = "div",
  sheen = false,
  padding = "md",
  className,
  children,
  ...rest
}: IndustrialGlassPanelProps): ReactNode {
  return (
    <Tag
      className={cn(
        "industrial-glass-panel",
        sheen && "industrial-glass-panel--sheen",
        PADDING_CLASS[padding],
        className,
      )}
      {...rest}
    >
      {children}
    </Tag>
  );
}
