"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useId, useRef, useState, type ReactNode } from "react";

import {
  AdditivesIcon,
  AutomotiveIcon,
  BaseOilsIcon,
  CatalogueDownloadIcon,
  CoolantsIcon,
  DisclosureCaretIcon,
  FinderIcon,
  IndustrialIcon,
  MarineIcon,
} from "./icons";
import { Arrow, LogoMark } from "./logo-mark";
import {
  DRAWER_FOCUSABLE,
  firstFocusable,
  lockBackground,
  lockScroll,
  rememberLocale,
} from "./nav-behaviour";
import {
  ROUTES,
  localeChoices,
  localeHref,
  primaryNavLinks,
  productFamilyLinks,
  structuralPathOf,
} from "./site-routes";

import type { LocaleResponse, ProductFamilyKey } from "@sam-group/types";

/**
 * A glyph for each of the six families, keyed by the family key rather than by its label.
 *
 * `Record<ProductFamilyKey, …>` is the point: a seventh family added to `PRODUCT_CATEGORIES`
 * without a glyph here is a **compile error**, not a menu row with a hole in it. Keying on the
 * label instead would have made a copy edit silently drop an icon.
 *
 * Every one is decorative. The family name is right beside it and says the same thing, which is
 * why they are `aria-hidden` — a screen reader announcing "droplet, Base Oils" is worse than
 * "Base Oils".
 */
const FAMILY_GLYPHS: Record<ProductFamilyKey, (props: { readonly size: "md" }) => ReactNode> = {
  "base-oils": BaseOilsIcon,
  "lubricant-additives": AdditivesIcon,
  "engine-oils-automotive-lubricants": AutomotiveIcon,
  "industrial-oils-lubricants": IndustrialIcon,
  "marine-oils-lubricants": MarineIcon,
  "antifreeze-coolants": CoolantsIcon,
};

/**
 * The flagship header.
 *
 * Information architecture and visual language are unchanged from the previous header: ink bar,
 * blurred solid state, gold underline, retract-on-scroll, the official mark, the seven primary
 * destinations from SITE_STRUCTURE and a mega menu under Products.
 *
 * ── What NAV-1 changed, and why it had to ──────────────────────────────────
 *
 * **Every internal address is now locale-prefixed at the source.** Until this gate the header
 * rendered `ROUTES.*` raw — `/about-us`, `/products`, `/contact-us` — and relied on
 * `middleware.ts` to negotiate a locale onto them. That is not navigation, it is a coin flip: the
 * negotiation reads `Accept-Language` and a cookie, neither of which knows what the reader is
 * looking at, so a Persian reader on `/fa/quality-certifications` clicking "About Us" was
 * 307-redirected to `/en/about-us`. The route's locale is authoritative; `localeHref` in
 * `site-routes.ts` is how this file says so, and it is the **only** prefix rule — nothing here
 * concatenates a locale onto a path.
 *
 * **`next/link`, not `<a>`.** With a correct prefix there is no redirect left to perform, so an
 * internal destination is a client transition rather than a document load plus a middleware
 * round-trip.
 *
 * **The language switcher navigates.** It was a `useState("en")` that set React state and moved
 * nobody. It is now ordinary links, built from the **active locale set supplied by the server** —
 * `GET /locales`, threaded in as `locales` — which replace only the leading locale segment and
 * keep the structural path and query. The `LOCALES` fixture it used to read is deleted.
 *
 * ── Interaction ────────────────────────────────────────────────────────────
 *
 * Products is a `<button aria-expanded>` rather than a link with a hover panel, because a
 * hover-only mega menu is unreachable by keyboard and unusable on touch. It opens on hover for
 * pointer users *and* on click/Enter/Space for everyone else, closes on Escape, on outside
 * click, and when focus leaves the group. The trigger still points at `/products` for anyone
 * who wants the landing page: the label is a link inside the panel's first row.
 *
 * The language menu is a **disclosure, not an ARIA menu.** It previously declared `role="menu"`
 * with `role="menuitem"` children and implemented none of the keyboard model that contract
 * promises — no arrow keys, no roving tabindex — which tells assistive technology to expect
 * behaviour that is not there. Its contents are links to other URLs, which is what `<a>` already
 * means, so the roles are gone and Tab walks them.
 *
 * Mobile is a hamburger drawer with Products as a disclosure accordion. Two actions are pinned to
 * the bottom of the drawer, per the same sheet — though the first of them is **Contact Us and not
 * WhatsApp**, because no WhatsApp number is confirmed; see the note at the drawer foot.
 */
export type SiteNavProps = {
  /**
   * The **route's** locale segment, resolved on the server. Never negotiated here, never read from
   * a cookie, and never defaulted — a header that guesses its own locale is the defect this gate
   * exists to remove.
   */
  readonly locale: string;
  /**
   * The active set from `GET /locales`. The switcher's only source of what languages exist.
   *
   * Exported as part of this type so the seventeen page templates that mount the chrome declare
   * `readonly locales: SiteNavProps["locales"]` and forward it, rather than each repeating a shape
   * that would then have to be changed in seventeen places.
   */
  readonly locales: readonly LocaleResponse[];
};

export function SiteNav({ locale, locales }: SiteNavProps): ReactNode {
  const ref = useRef<HTMLElement>(null);
  const megaRef = useRef<HTMLDivElement>(null);
  const megaTriggerRef = useRef<HTMLButtonElement>(null);
  const langRef = useRef<HTMLDivElement>(null);
  const drawerRef = useRef<HTMLDivElement>(null);
  const burgerRef = useRef<HTMLButtonElement>(null);

  const [mega, setMega] = useState(false);
  const [lang, setLang] = useState(false);
  const [drawer, setDrawer] = useState(false);
  const [drawerProducts, setDrawerProducts] = useState(false);

  const megaId = useId();
  const langId = useId();
  const drawerId = useId();
  const drawerProductsId = useId();

  const pathname = usePathname();

  /*
   * The address, as navigation compares it: the route's path with its locale segment removed. The
   * active set does the removing, so `/design-proof/*` — which is not locale-routed — reduces to
   * itself and matches nothing, rather than having its first segment mistaken for a language.
   */
  const structuralPath = structuralPathOf(
    pathname,
    locales.map((entry) => entry.code),
  );

  const primary = primaryNavLinks(locale, structuralPath);
  const families = productFamilyLinks(locale);
  const columns = [families.slice(0, 3), families.slice(3, 6)];

  const finderHref = localeHref(locale, ROUTES.productFinder);
  const documentationHref = localeHref(locale, ROUTES.documentation);
  const productsHref = localeHref(locale, ROUTES.products);
  const quoteHref = localeHref(locale, ROUTES.requestQuote);

  /** Close the drawer *and* hand focus back, for the paths a person deliberately closed it on. */
  const closeDrawer = useCallback(() => {
    setDrawer(false);
    burgerRef.current?.focus();
  }, []);

  /* Scroll state. Written as data attributes so the listener never triggers a re-render. */
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    let last = window.scrollY;
    const onScroll = (): void => {
      const y = window.scrollY;
      node.dataset.solid = String(y > 40);
      // Never retract while a menu is open — the panel would travel off-screen with it.
      node.dataset.hidden = String(y > last && y > 420 && !mega && !lang && !drawer);
      last = y;
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [mega, lang, drawer]);

  /*
   * One handler for every dismissal route: Escape, and a click outside the open group.
   *
   * Escape returns focus to whatever opened the thing it closed — the burger for the drawer, the
   * Products trigger for the mega panel. Dismissing a disclosure and leaving focus on a node that
   * is now hidden is how a keyboard reader ends up back at the top of the document (WCAG 2.4.3).
   */
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key !== "Escape") return;
      if (drawer) closeDrawer();
      if (mega) megaTriggerRef.current?.focus();
      setMega(false);
      setLang(false);
    };
    const onPointer = (e: PointerEvent): void => {
      const t = e.target;
      if (!(t instanceof Node)) return;
      if (megaRef.current && !megaRef.current.contains(t)) setMega(false);
      if (langRef.current && !langRef.current.contains(t)) setLang(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointer);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointer);
    };
  }, [drawer, mega, closeDrawer]);

  /*
   * Navigating closes every open surface.
   *
   * `next/link` transitions are client-side, so without this the drawer would still be covering the
   * page a reader has just arrived on. Focus is deliberately **not** moved here: the destination
   * document owns focus after a navigation, and grabbing it back for the burger would be worse than
   * leaving it. The two paths a person closes the drawer on themselves — Escape and the close
   * button — restore focus; this one does not, because nothing was dismissed.
   */
  useEffect(() => {
    setDrawer(false);
    setMega(false);
    setLang(false);
    setDrawerProducts(false);
  }, [pathname]);

  /*
   * The drawer owns the viewport while it is open.
   *
   * Three effects, all reversed by the same cleanup, so close, Escape, navigation and unmount are
   * one path rather than four: the page behind stops scrolling, everything outside the header
   * becomes `inert` — removed from the tab order *and* the accessibility tree, which is what
   * contains focus without a hand-written Tab trap — and focus moves to the first thing inside.
   *
   * The header itself is never inerted: the burger is the close control and the language switcher
   * sits beside it, both of which stay reachable, which is why the lock walks the header's
   * ancestors rather than covering one container.
   */
  useEffect(() => {
    if (!drawer) return;

    const header = ref.current;
    const panel = drawerRef.current;

    if (!header || !panel) return;

    const releaseScroll = lockScroll(document.documentElement);
    const releaseBackground = lockBackground(header, document.body);

    firstFocusable(panel.querySelectorAll<HTMLElement>(DRAWER_FOCUSABLE))?.focus();

    return () => {
      releaseBackground();
      releaseScroll();
    };
  }, [drawer]);

  return (
    <header ref={ref} className="fs-nav" data-surface="midnight">
      <div className="fs-wrap fs-nav-in">
        <Link
          href={localeHref(locale, ROUTES.home)}
          className="fs-logo"
          aria-label="Sam Group — home"
        >
          <LogoMark height={28} priority />
          <span>
            <span className="fs-logo-txt">SAM GROUP</span>
            <span className="fs-logo-sub">Petroleum Engineering</span>
          </span>
        </Link>

        <nav className="fs-nav-links" aria-label="Primary">
          {primary.map((item) =>
            item.mega ? (
              <div
                key={item.href}
                className="fs-mega"
                ref={megaRef}
                onPointerEnter={() => setMega(true)}
                onPointerLeave={() => setMega(false)}
                onBlur={(e) => {
                  if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setMega(false);
                }}
              >
                <button
                  type="button"
                  className="fs-nav-trigger"
                  ref={megaTriggerRef}
                  aria-expanded={mega}
                  aria-controls={megaId}
                  aria-current={item.current ? "page" : undefined}
                  onClick={() => setMega((v) => !v)}
                >
                  {item.label}
                  <span className="fs-nav-caret">
                    <DisclosureCaretIcon size="sm" />
                  </span>
                </button>

                <div className="fs-mega-panel" id={megaId} data-open={mega || undefined}>
                  <div className="fs-mega-inner">
                    {columns.map((col, i) => (
                      <div className="fs-mega-col" key={i}>
                        {i === 0 && <p className="fs-mega-head">Product families</p>}
                        {i === 1 && (
                          <p className="fs-mega-head" aria-hidden="true">
                            &nbsp;
                          </p>
                        )}
                        <ul>
                          {col.map((cat) => {
                            const Glyph = FAMILY_GLYPHS[cat.key];

                            return (
                              <li key={cat.key}>
                                <Link href={cat.href}>
                                  <Glyph size="md" />
                                  {cat.label}
                                </Link>
                              </li>
                            );
                          })}
                        </ul>
                      </div>
                    ))}

                    <div className="fs-mega-col fs-mega-col--promo">
                      <p className="fs-mega-head">Find &amp; download</p>
                      <ul>
                        <li>
                          <Link href={finderHref}>
                            <FinderIcon size="md" />
                            Product Finder
                          </Link>
                        </li>
                        <li>
                          {/*
                           * The documentation block lives on the Products landing page and has a
                           * real `id="documentation"` there, so this stays a page plus a fragment
                           * — now a locale-prefixed page. It is not a route of its own and no
                           * fragment id was invented to keep it alive.
                           */}
                          <Link href={documentationHref}>
                            <CatalogueDownloadIcon size="md" />
                            Download Catalogue
                          </Link>
                        </li>
                      </ul>
                      <Link href={productsHref} className="fs-mega-all">
                        All products
                        <Arrow size={13} />
                      </Link>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <Link
                key={item.href}
                href={item.href}
                aria-current={item.current ? "page" : undefined}
              >
                {item.label}
              </Link>
            ),
          )}
        </nav>

        <div className="fs-nav-right">
          <div className="fs-lang" ref={langRef}>
            <button
              type="button"
              className="fs-lang-btn"
              aria-expanded={lang}
              aria-controls={langId}
              aria-label={`Language: ${locale.toUpperCase()}`}
              onClick={() => setLang((v) => !v)}
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.4"
                aria-hidden="true"
              >
                <circle cx="12" cy="12" r="9" />
                <path d="M3 12h18M12 3a15 15 0 010 18a15 15 0 010-18" />
              </svg>
              <span>{locale.toUpperCase()}</span>
            </button>

            {/*
             * `useSearchParams` is what preserves `?segment=marine` across a language switch, and
             * it forces the component that calls it out of static prerendering. Scoping it to the
             * panel keeps that boundary off the header, and the fallback is `null` without a
             * visible consequence: the panel is `visibility: hidden` until it is opened anyway.
             */}
            <Suspense fallback={null}>
              <LanguageMenu
                id={langId}
                open={lang}
                locale={locale}
                locales={locales}
                pathname={pathname}
                onChoose={() => setLang(false)}
              />
            </Suspense>
          </div>

          <Link href={quoteHref} className="fs-btn fs-btn--gold fs-nav-cta">
            Request a Quote
          </Link>

          <button
            type="button"
            className="fs-burger"
            ref={burgerRef}
            aria-expanded={drawer}
            aria-controls={drawerId}
            aria-label={drawer ? "Close menu" : "Open menu"}
            onClick={() => (drawer ? closeDrawer() : setDrawer(true))}
          >
            <span data-open={drawer || undefined} />
          </button>
        </div>
      </div>

      {/* Mobile drawer */}
      <div className="fs-drawer" id={drawerId} ref={drawerRef} data-open={drawer || undefined}>
        <nav className="fs-drawer-nav" aria-label="Mobile">
          {primary.map((item) =>
            item.mega ? (
              <div className="fs-drawer-group" key={item.href}>
                <button
                  type="button"
                  className="fs-drawer-toggle"
                  aria-expanded={drawerProducts}
                  aria-controls={drawerProductsId}
                  aria-current={item.current ? "page" : undefined}
                  onClick={() => setDrawerProducts((v) => !v)}
                >
                  {item.label}
                  <span className="fs-nav-caret">
                    <DisclosureCaretIcon />
                  </span>
                </button>
                <div
                  className="fs-drawer-panel"
                  id={drawerProductsId}
                  data-open={drawerProducts || undefined}
                >
                  <div>
                    <ul>
                      {families.map((cat) => {
                        const Glyph = FAMILY_GLYPHS[cat.key];

                        return (
                          <li key={cat.key}>
                            <Link href={cat.href}>
                              <Glyph size="md" />
                              {cat.label}
                            </Link>
                          </li>
                        );
                      })}
                      <li>
                        <Link href={finderHref}>
                          <FinderIcon size="md" />
                          Product Finder
                        </Link>
                      </li>
                      <li>
                        <Link href={documentationHref}>
                          <CatalogueDownloadIcon size="md" />
                          Download Catalogue
                        </Link>
                      </li>
                      <li>
                        <Link href={productsHref}>
                          <Arrow size={13} />
                          All products
                        </Link>
                      </li>
                    </ul>
                  </div>
                </div>
              </div>
            ) : (
              <Link
                key={item.href}
                href={item.href}
                className="fs-drawer-link"
                aria-current={item.current ? "page" : undefined}
              >
                {item.label}
              </Link>
            ),
          )}
        </nav>

        {/*
         * Pinned actions, per SITE_STRUCTURE's Global Components sheet.
         *
         * **The WhatsApp action is not rendered.** That sheet pins WhatsApp here and gives it
         * explicit visual priority — "communication with foreign customers is mainly via WhatsApp"
         * — but the number is one of the Outstanding Confirmations, and what stood here was
         * `https://wa.me/` with no number: a button that opened WhatsApp's own error page in a new
         * tab. A dead primary action is worse than an absent one, and inventing a number is not an
         * option. Contact Us takes its place until the real number is confirmed.
         */}
        <div className="fs-drawer-foot">
          <Link href={localeHref(locale, ROUTES.contactUs)} className="fs-btn fs-btn--glass">
            Contact Us
          </Link>
          <Link href={quoteHref} className="fs-btn fs-btn--gold">
            Request a Quote
          </Link>
        </div>
      </div>
    </header>
  );
}

/**
 * The language panel — the same page, addressed in each active language.
 *
 * Every entry is an ordinary `<a>` to a real URL, so it works with a keyboard, with a middle click
 * and with JavaScript still loading. `hrefLang` and `lang` describe the destination, which is what
 * lets a screen reader pronounce each language's own name in that language rather than spelling it
 * out in the page's, and `aria-current="true"` marks the one that is already being read.
 *
 * Every name here comes from the `nativeName` the locale endpoint served. **No language name is
 * written in this file**, which is both the point and something `site-routes.spec.ts` asserts.
 *
 * A plain `<a>` rather than `next/link`: switching language changes `<html lang>` and `<html dir>`,
 * which the root layout sets from the route segment — and it re-reads content in the new locale.
 * A full document load is the honest transition for that, and it is what makes the direction flip
 * apply to the document rather than to a re-rendered subtree.
 */
function LanguageMenu({
  id,
  open,
  locale,
  locales,
  pathname,
  onChoose,
}: {
  readonly id: string;
  readonly open: boolean;
  readonly locale: string;
  readonly locales: readonly LocaleResponse[];
  readonly pathname: string;
  readonly onChoose: () => void;
}): ReactNode {
  const search = useSearchParams().toString();

  /*
   * The fragment, which is the one part of the address the framework cannot hand over.
   *
   * A hash is never sent to the server, so `usePathname()` and `useSearchParams()` both omit it and
   * there is nothing to thread down from the page. It has to be read from `window`, and **reading
   * it during render would be a hydration mismatch**: the server renders `/ar/products` and a client
   * that read `location.hash` inline would render `/ar/products#documentation` on the very first
   * pass, which is precisely the divergence React refuses.
   *
   * So it starts as `""` — matching what the server rendered — and an effect fills it in after
   * hydration. The href is correct from the first paint after mount, which is long before anyone can
   * open the panel. Nothing is written to the browser; this is React state.
   *
   * `hashchange` keeps it current when an in-page anchor moves the reader (the Products page's
   * `#documentation` block is exactly that case), and `pathname` in the dependencies re-reads after
   * a client navigation, which is what clears a stale fragment when the route changes.
   */
  const [hash, setHash] = useState("");

  useEffect(() => {
    const read = (): void => setHash(window.location.hash);

    read();
    window.addEventListener("hashchange", read);

    return () => window.removeEventListener("hashchange", read);
  }, [pathname]);

  const choices = localeChoices(locales, locale, pathname, search, hash);

  return (
    <div className="fs-lang-menu" id={id} data-open={open || undefined}>
      {choices.map((choice) => (
        <a
          key={choice.code}
          href={choice.href}
          hrefLang={choice.code}
          lang={choice.code}
          aria-current={choice.current ? "true" : undefined}
          onClick={() => {
            /*
             * The one place `NEXT_LOCALE` is ever written, and only on an explicit choice. It is a
             * tiebreaker for a locale-less address — `middleware.ts` reads it only there — and
             * never overrides the locale in a URL, so it cannot move a reader who followed a link.
             * Ordinary navigation goes through `next/link` and never reaches this handler.
             */
            rememberLocale(
              choice.code,
              locales.map((entry) => entry.code),
              typeof document === "undefined" ? null : document,
              typeof window !== "undefined" && window.location.protocol === "https:",
            );
            onChoose();
          }}
        >
          {choice.nativeName}
          <span>
            {choice.code.toUpperCase()} · {choice.direction.toUpperCase()}
          </span>
        </a>
      ))}
    </div>
  );
}
