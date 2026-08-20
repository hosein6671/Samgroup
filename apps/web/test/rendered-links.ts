import { renderToStaticMarkup } from "react-dom/server";

import type { ReactElement } from "react";

/**
 * Link assertions read off **rendered HTML**, not off an element tree.
 *
 * ── Why this exists beside `element-tree.ts` ────────────────────────────────
 *
 * `expand` walks a returned React tree by calling each function component directly. That is exactly
 * right for the sync Server Components it was written for, and it cannot render a `"use client"`
 * section: `Partnership`, `Ecosystem`, `Hero` and `Lab` all call `useCanvas`, and a hook invoked
 * outside a renderer throws — which `expand` catches and turns into `null`. A locale assertion
 * against a subtree that silently became `null` is an assertion that passes because it found
 * nothing, which is the one failure mode a locale spec must not have.
 *
 * `renderToStaticMarkup` runs the same server render Next performs, hooks included, and returns the
 * markup a reader would actually receive. So these helpers assert on emitted `href` values rather
 * than on props — rendered behaviour, per the NAV-2 gate.
 *
 * **No dependency is added.** `react-dom` is already `apps/web`'s own dependency; only the
 * `react-dom/server` entry point is new to the specs.
 *
 * ── What it deliberately does not do ────────────────────────────────────────
 *
 * It does not mount, does not hydrate and does not run effects. Anything that only exists after
 * hydration is invisible here — and nothing NAV-2 changed is in that category, because every link
 * it touches is server-rendered markup.
 */

/** One page surface, rendered as the HTML a first response would carry. */
export function renderHtml(element: ReactElement): string {
  return renderToStaticMarkup(element);
}

/**
 * The five entities React escapes into attribute values, turned back into the characters an
 * assertion is written with.
 *
 * `&` is the one that matters: `?type=sample_request&product=x` is emitted as `&amp;`, and a spec
 * comparing against the raw query string would fail on a URL that is completely correct.
 */
function unescapeHtml(value: string): string {
  return value
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

/** Every `href` on an `<a>` in the rendered markup, in document order, duplicates included. */
export function hrefsIn(html: string): string[] {
  return [...html.matchAll(/<a\b[^>]*?\shref="([^"]*)"/g)].map((match) =>
    unescapeHtml(match[1] ?? ""),
  );
}

/** Every `id` in the rendered markup — what a fragment link has to land on. */
export function idsIn(html: string): string[] {
  return [...html.matchAll(/\sid="([^"]*)"/g)].map((match) => match[1] ?? "");
}

/**
 * Whether an href is this application's own address rather than a position on the current page.
 *
 * A single leading `/` and nothing else — the same rule `isInternalPath` applies inside
 * `localeHref`, restated here so a spec can partition a page's links without importing a private
 * function. `#fragment` is excluded because it is deliberately locale-less, and `//cdn…` is
 * excluded because it is another origin wearing a path's clothes.
 */
export function isInternalPath(href: string): boolean {
  return href.startsWith("/") && !href.startsWith("//");
}

/**
 * Every internal link on a surface that does **not** begin with the locale it was rendered in.
 *
 * The assertion NAV-2 exists for, expressed once: an empty array is a surface where no page-body
 * link can be re-negotiated by `middleware.ts`. Fragments and external addresses are partitioned
 * out rather than tolerated by a loose pattern, so a `#products` that was supposed to be a route
 * still shows up as a fragment in the caller's own list and can be asserted separately.
 */
export function localeEscapees(html: string, locale: string): string[] {
  return hrefsIn(html)
    .filter(isInternalPath)
    .filter((href) => href !== `/${locale}` && !href.startsWith(`/${locale}/`));
}

/**
 * Every link as an address **and** the text a reader would hear — what SC 2.5.8 work has to leave
 * alone while it changes a box.
 *
 * `text` is the anchor's markup with tags stripped and whitespace collapsed, which is the accessible
 * name for every link in these sections: none carries an `aria-label`, and the only nested element
 * is a decorative `<svg>` that contributes nothing. It is not a general accessible-name computation
 * and does not pretend to be one — `accessibleName` in `element-tree.ts` carries the same caveat.
 */
export function linksIn(html: string): { href: string; text: string }[] {
  return [...html.matchAll(/<a\b[^>]*?\shref="([^"]*)"[^>]*>([\s\S]*?)<\/a>/g)].map((match) => ({
    href: unescapeHtml(match[1] ?? ""),
    text: unescapeHtml((match[2] ?? "").replace(/<[^>]*>/g, ""))
      .replace(/\s+/g, " ")
      .trim(),
  }));
}

/**
 * One CSS rule's declaration block, looked up by its exact selector.
 *
 * It lets a spec assert that a target-size rule is still *declared* without asserting on the file
 * around it — the alternative to a snapshot, which would fail on every unrelated edit and teach the
 * next person to regenerate it without reading.
 *
 * The selector matches only where it is followed by `{`, so `.pc-doc-link` cannot accidentally read
 * `.pc-doc-link:hover`'s block. A deleted rule returns `null` rather than `""`, so a `toContain`
 * assertion fails loudly instead of passing against nothing.
 *
 * It is not a CSS parser: it stops at the first `}`, which is correct for flat declaration blocks
 * and would not survive a nested rule. Every selector it is used with is flat.
 */
export function ruleBlock(css: string, selector: string): string | null {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = new RegExp(`(?:^|[\\n,])\\s*${escaped}\\s*\\{([^}]*)\\}`).exec(css);

  return match === null ? null : (match[1] ?? "");
}
