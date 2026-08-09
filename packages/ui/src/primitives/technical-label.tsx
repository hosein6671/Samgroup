import type { HTMLAttributes, ReactNode } from "react";

import { cn } from "../lib/cn";

/**
 * The engineering signal — section eyebrows, spec keys, certification marks, figure numbers.
 * This is the register that separates the system from a luxury fashion one.
 *
 * It is a primitive of its own rather than a Text role because its RTL form diverges in kind,
 * not degree: Arabic and Persian have no letter case, and the positive tracking that makes the
 * Latin form read as technical breaks cursive joining outright. The `.technical-label` class
 * carries that divergence (see styles/base.css); expressing it as utilities would mean a
 * conditional on every call site.
 */
export type TechnicalLabelTone = "secondary" | "tertiary" | "accent" | "primary" | "rare";

export type TechnicalLabelElement = "span" | "p" | "div" | "dt" | "figcaption" | "legend";

export type TechnicalLabelProps = {
  readonly tone?: TechnicalLabelTone;
  readonly as?: TechnicalLabelElement;
  readonly children?: ReactNode;
} & Omit<HTMLAttributes<HTMLElement>, "children">;

const TONE_CLASS: Readonly<Record<TechnicalLabelTone, string>> = {
  primary: "text-text-primary",
  secondary: "text-text-secondary",
  tertiary: "text-text-tertiary",
  accent: "text-text-accent",
  rare: "text-highlight-rare",
};

export function TechnicalLabel({
  tone = "secondary",
  as: Tag = "span",
  className,
  children,
  ...rest
}: TechnicalLabelProps): ReactNode {
  return (
    <Tag className={cn("technical-label", TONE_CLASS[tone], className)} {...rest}>
      {children}
    </Tag>
  );
}
