"use client";

import Image from "next/image";
import { useState, type ReactNode } from "react";

import { EditorialLink } from "@/features/site/editorial-link";
import { RichText } from "@/features/site/rich-text";
import { Arrow, LogoMark } from "@/features/site/logo-mark";

export type IndustryPanel = {
  readonly key: string;
  readonly name: string;
  readonly body: string;
  readonly src: string;
  readonly alt: string;
  /** The editor's link for this industry; absent means the card is not a link. */
  readonly href?: string;
};

/**
 * The accordion itself: one panel open at a time. Hover opens a panel on a desktop pointer, and
 * focus or a tap opens it everywhere, so keyboard and touch readers reach every line of copy. All
 * five lines stay in the markup; the closed ones are only visually collapsed.
 *
 * A card with a link carries it on its title. While the card is closed, a tap only opens it (the
 * first tap on a touch screen reveals, it does not navigate); once open, the link covers the whole
 * card, so a click anywhere on it follows the link. Keyboard readers reach the link itself.
 */
export function IndustriesAccordion({
  items,
}: {
  readonly items: readonly IndustryPanel[];
}): ReactNode {
  const [open, setOpen] = useState(0);
  const hoverOpens = (): boolean =>
    window.matchMedia("(hover: hover) and (min-width: 961px)").matches;

  return (
    <div className="fs-acc">
      {items.map((item, i) => (
        <article
          key={item.key}
          className="fs-acc-item"
          data-open={i === open ? "true" : undefined}
          data-linked={item.href ? "true" : undefined}
          tabIndex={0}
          onMouseEnter={() => {
            if (hoverOpens()) setOpen(i);
          }}
          onFocus={() => setOpen(i)}
          onClick={() => setOpen(i)}
        >
          <Image src={item.src} alt={item.alt} fill sizes="(max-width: 960px) 100vw, 40vw" />
          <span className="fs-photo-brand" aria-hidden="true">
            <LogoMark height={18} />
            <span>SAM GROUP</span>
          </span>
          <div className="fs-acc-copy">
            <h3>
              {item.href ? (
                <EditorialLink href={item.href} className="fs-acc-link">
                  {item.name}
                  <Arrow />
                </EditorialLink>
              ) : (
                item.name
              )}
            </h3>
            <p>
              <span>
                {/* A linked card is itself the link, so a link in its line would sit inside it. */}
                <RichText text={item.body} links={!item.href} />
              </span>
            </p>
          </div>
        </article>
      ))}
    </div>
  );
}
