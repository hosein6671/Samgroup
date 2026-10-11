/**
 * Which link clicks play the page transition, as a pure function so it can be tested without a
 * browser (the test runner is `environment: "node"`).
 *
 * The rule is conservative: the curtain plays only for a plain left click on a same-origin link to
 * a different page of the public site in the same locale. Everything the browser or the framework
 * should handle on its own is left alone — a new tab or window, a download, another origin, an
 * in-page anchor or a query change on the same page, a file, the API, the Admin Dashboard, and a
 * change of language (the language menu remembers the choice itself before navigating).
 */

/** The parts of a click and of its link that the decision reads. */
export type TransitionClick = {
  readonly button: number;
  readonly metaKey: boolean;
  readonly ctrlKey: boolean;
  readonly shiftKey: boolean;
  readonly altKey: boolean;
  /** The link's raw `href` attribute, as written. */
  readonly href: string | null;
  /** The link's `target` attribute. */
  readonly target: string | null;
  /** Whether the link carries a `download` attribute. */
  readonly download: boolean;
};

/** Paths that are never a public page, whatever the locale prefix. */
const NOT_A_PAGE = /^\/(?:admin|api|media|_next)(?:\/|$)/;
/** A last path segment with an extension is a file (a PDF datasheet, an image), not a page. */
const FILE = /\/[^/]+\.[a-z0-9]{2,5}$/i;

/**
 * The URL to navigate to with the transition, as path + query + hash, or `null` when the click
 * must be left to the browser and the framework.
 */
export function transitionTarget(click: TransitionClick, current: URL): string | null {
  if (click.button !== 0) return null;
  if (click.metaKey || click.ctrlKey || click.shiftKey || click.altKey) return null;
  if (click.download) return null;
  if (click.target && click.target !== "_self") return null;

  const raw = click.href?.trim();
  if (!raw || raw.startsWith("#")) return null;

  let next: URL;
  try {
    next = new URL(raw, current);
  } catch {
    return null;
  }

  if (next.protocol !== "http:" && next.protocol !== "https:") return null;
  if (next.origin !== current.origin) return null;
  if (NOT_A_PAGE.test(next.pathname) || FILE.test(next.pathname)) return null;
  if (normalise(next.pathname) === normalise(current.pathname)) return null;
  if (firstSegment(next.pathname) !== firstSegment(current.pathname)) return null;

  return `${next.pathname}${next.search}${next.hash}`;
}

function normalise(pathname: string): string {
  return pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
}

function firstSegment(pathname: string): string {
  return pathname.split("/")[1] ?? "";
}
