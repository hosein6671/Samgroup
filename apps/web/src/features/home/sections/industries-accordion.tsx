"use client";

import Image from "next/image";
import { useState, type ReactNode } from "react";

import { LogoMark } from "@/features/site/logo-mark";

export type IndustryPanel = {
  readonly key: string;
  readonly name: string;
  readonly body: string;
  readonly src: string;
  readonly alt: string;
};

/**
 * The accordion itself: one panel open at a time. Hover opens a panel on a desktop pointer, and
 * focus or a tap opens it everywhere, so keyboard and touch readers reach every line of copy. All
 * five lines stay in the markup; the closed ones are only visually collapsed.
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
            <h3>{item.name}</h3>
            <p>
              <span>{item.body}</span>
            </p>
          </div>
        </article>
      ))}
    </div>
  );
}
