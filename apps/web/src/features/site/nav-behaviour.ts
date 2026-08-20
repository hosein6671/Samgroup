import { LOCALE_COOKIE } from "@/lib/locale-contract";

/**
 * The header's three pieces of browser behaviour, extracted from the component that uses them.
 *
 * ── Why these are not inline in `site-nav.tsx` ─────────────────────────────
 *
 * `apps/web`'s test runner is `environment: "node"` with no jsdom and no React Testing Library, and
 * this gate may not add a dependency. Left inline, none of this could be asserted on: a spec would
 * have to read the component's source and hope, which is the weakest kind of test and the easiest
 * to satisfy while shipping the bug.
 *
 * Written as narrow functions over the smallest structural type each one needs, they are ordinary
 * unit subjects — `nav-behaviour.spec.ts` drives them with hand-built fakes and asserts on what they
 * did. The component keeps the wiring; the rules live here.
 *
 * **This is not a DOM abstraction and must not grow into one.** Each function takes exactly the
 * shape it touches, so a real `Element` satisfies it structurally and nothing has to be adapted at
 * the call site.
 */

/* ------------------------------------------------------- background inerting */

/**
 * The part of an element this module changes, and the two links it walks.
 *
 * `children` is `ArrayLike<unknown>` rather than `ArrayLike<BackgroundNode>` so that a real
 * `HTMLCollection` — whose members are typed `Element`, and `inert` lives on `HTMLElement` —
 * satisfies it without a cast at the call site. Each member is narrowed below.
 */
export type BackgroundNode = {
  inert: boolean;
  readonly parentElement: BackgroundNode | null;
  readonly children: ArrayLike<unknown>;
};

function isBackgroundNode(value: unknown): value is BackgroundNode {
  return typeof value === "object" && value !== null && "inert" in value;
}

/**
 * Make everything outside `node` non-interactive, and return the undo.
 *
 * ── Why `inert` and not a focus trap ───────────────────────────────────────
 *
 * A hand-written focus trap is a `keydown` listener that guesses which element is last, re-enters
 * the cycle on `Tab`, and is wrong the moment a link is hidden, disabled or added. `inert` is the
 * platform's own answer: the browser removes the subtree from the tab order **and** from the
 * accessibility tree, so a screen-reader user cannot read past the drawer either — which a `Tab`
 * trap never achieves. Baseline in every browser this platform targets, and no package.
 *
 * ── Why it walks up rather than inerting one container ─────────────────────
 *
 * The drawer lives inside `<header>`, and the header's bar stays operable while it is open — the
 * burger is the close control and the language switcher is beside it. So the background is not one
 * element: it is every sibling of the header, then every sibling of the header's parent, up to
 * `root`. Walking gets `<main>`, the footer, the homepage's overlay furniture **and** the root
 * layout's skip link, which sits outside the branded wrapper entirely.
 *
 * **Only nodes this call changed are restored.** An element that was already `inert` for its own
 * reasons is left alone on the way up and on the way back, so closing the drawer cannot make
 * something interactive that was not.
 */
export function lockBackground(node: BackgroundNode, root: BackgroundNode | null): () => void {
  const changed: BackgroundNode[] = [];

  let current: BackgroundNode | null = node;

  while (current !== null && current !== root) {
    const parent: BackgroundNode | null = current.parentElement;

    if (parent === null) break;

    for (let i = 0; i < parent.children.length; i += 1) {
      const sibling = parent.children[i];

      if (!isBackgroundNode(sibling) || sibling === current || sibling.inert) continue;

      sibling.inert = true;
      changed.push(sibling);
    }

    current = parent;
  }

  return () => {
    for (const element of changed) element.inert = false;
  };
}

/* ------------------------------------------------------------- scroll lock */

/** The one property the scroll lock writes. */
export type ScrollLockTarget = { readonly style: { overflow: string } };

/**
 * Stop the page behind the drawer from scrolling, and return the undo.
 *
 * The previous implementation wrote `""` on close, which is the same value it wrote on mount —
 * so a page that had set its own inline `overflow` would have lost it. This records what was there
 * and puts that back, which makes the restore correct on every path: close, Escape, navigation and
 * unmount.
 */
export function lockScroll(target: ScrollLockTarget): () => void {
  const previous = target.style.overflow;

  target.style.overflow = "hidden";

  return () => {
    target.style.overflow = previous;
  };
}

/* ------------------------------------------------------------ focus moving */

/**
 * What can hold focus inside the drawer.
 *
 * Deliberately short: the drawer contains links, disclosure buttons and nothing else. It is not a
 * general focusable-element selector and does not need to be.
 */
export const DRAWER_FOCUSABLE = [
  "a[href]",
  "button:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(", ");

/**
 * The first candidate a keyboard can reach, or `null`.
 *
 * `null` is a real answer, not a failure: an empty drawer has nothing to focus, and the caller
 * leaves focus where it was rather than moving it somewhere arbitrary. The caller supplies the
 * list — `querySelectorAll(DRAWER_FOCUSABLE)` — so this stays free of any DOM type.
 */
export function firstFocusable<T>(candidates: ArrayLike<T>): T | null {
  return candidates.length > 0 ? (candidates[0] ?? null) : null;
}

/* ------------------------------------------------- explicit locale preference */

/** The cookie jar this module writes through — `document`, structurally. */
export type CookieJar = { cookie: string };

/**
 * The exact cookie an explicit language choice is remembered in.
 *
 * Every attribute is the ratified one, and each absence is as deliberate as each presence:
 *
 * - **`Path=/`** — the preference is the site's, not a section's.
 * - **`SameSite=Lax`** — it is read by `middleware.ts` on a top-level navigation, which Lax
 *   allows; `Strict` would drop it on exactly the arrival this exists to serve.
 * - **`Secure` on HTTPS only.** Determined from the page's own protocol rather than from a build
 *   flag, because a client bundle has no environment: `NODE_ENV` inlined into browser JavaScript
 *   would be a second, weaker statement of the same fact. On the production origin this is always
 *   `true`; on `http://localhost` it is `false`, which is what makes the cookie work in
 *   development. Setting `Secure` unconditionally would silently drop the write over plain HTTP.
 * - **No `Max-Age` and no `Expires`** — a session cookie by decision. The preference lasts as long
 *   as the tab session and leaves nothing behind.
 * - **No `HttpOnly`**, necessarily: this is written by the switcher in the browser.
 * - **No PII, and nothing but a locale code** — one of `en`, `fa`, `ar`, encoded.
 */
export function localeCookie(code: string, secure: boolean): string {
  const attributes = [`${LOCALE_COOKIE}=${encodeURIComponent(code)}`, "Path=/", "SameSite=Lax"];

  if (secure) attributes.push("Secure");

  return attributes.join("; ");
}

/**
 * Remember an **explicitly chosen** locale. Returns whether anything was written.
 *
 * ── Two rules, and both are enforced here rather than trusted ──────────────
 *
 * 1. **Only a code from the active set.** `activeCodes` comes from `GET /locales` by way of the
 *    switcher's props. A code outside it is refused and nothing is written — a cookie naming a
 *    locale the `Locale` table does not have would make `middleware.ts` negotiate a route that
 *    404s, on every later visit, from one bad click.
 * 2. **Only on an explicit choice.** This function has exactly one caller: the switcher's click
 *    handler. Ordinary navigation goes through `next/link` and never reaches it, so browsing the
 *    site writes no cookie and the route's own locale stays the only thing that decided anything.
 *
 * The preference is a *tiebreaker for an address that has no locale in it* — `middleware.ts` reads
 * it only on a locale-less structural path. It never overrides a `/{locale}/…` URL, which is what
 * keeps "the route locale is authoritative" true even for a visitor who has one.
 */
export function rememberLocale(
  code: string,
  activeCodes: readonly string[],
  jar: CookieJar | null,
  secure: boolean,
): boolean {
  if (jar === null || !activeCodes.includes(code)) return false;

  jar.cookie = localeCookie(code, secure);

  return true;
}
