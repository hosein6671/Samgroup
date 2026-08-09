import type { HTMLAttributes, ReactNode } from "react";

import { cn } from "../lib/cn";

/**
 * Typographic role, chosen independently of the HTML element.
 *
 * That separation is the point: it lets an h2 render at display-2 and an h1 render at
 * headline-1 where the page's editorial hierarchy calls for it, so oversized display type
 * never forces the heading outline out of order. Size and semantics are different questions.
 */
export type TextRole =
  | "display-1"
  | "display-2"
  | "headline-1"
  | "headline-2"
  | "title"
  | "body-lead"
  | "body"
  | "caption";

export type TextTone = "primary" | "secondary" | "tertiary" | "accent" | "inverse" | "rare";

export type TextElement =
  | "h1"
  | "h2"
  | "h3"
  | "h4"
  | "h5"
  | "h6"
  | "p"
  | "span"
  | "div"
  | "strong"
  | "em"
  | "figcaption"
  | "blockquote";

export type TextProps = {
  readonly role?: TextRole;
  readonly tone?: TextTone;
  readonly as?: TextElement;
  /** Constrain to the reading measure. Correct for prose, wrong for a headline. */
  readonly measured?: boolean;
  readonly balance?: boolean;
  readonly children?: ReactNode;
} & Omit<HTMLAttributes<HTMLElement>, "children">;

const ROLE_CLASS: Readonly<Record<TextRole, string>> = {
  "display-1": "text-display-1 font-display",
  "display-2": "text-display-2 font-display",
  "headline-1": "text-headline-1 font-display",
  "headline-2": "text-headline-2 font-display",
  title: "text-title font-display",
  "body-lead": "text-body-lead font-text",
  body: "text-body font-text",
  caption: "text-caption font-text",
};

const TONE_CLASS: Readonly<Record<TextTone, string>> = {
  primary: "text-text-primary",
  secondary: "text-text-secondary",
  tertiary: "text-text-tertiary",
  accent: "text-text-accent",
  inverse: "text-text-inverse",
  // Gold. Rare by rule: never a call to action, never body copy, never the sole carrier of
  // meaning, and at most once per viewport.
  rare: "text-highlight-rare",
};

export function Text({
  role = "body",
  tone = "primary",
  as: Tag = "p",
  measured = false,
  balance = false,
  className,
  children,
  ...rest
}: TextProps): ReactNode {
  return (
    <Tag
      className={cn(
        ROLE_CLASS[role],
        TONE_CLASS[tone],
        measured && "measure",
        balance && "text-balance",
        className,
      )}
      {...rest}
    >
      {children}
    </Tag>
  );
}
