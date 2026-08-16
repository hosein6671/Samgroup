"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";

import { Arrow, LogoMark } from "./logo-mark";
import { LOCALES, PRIMARY_NAV, PRODUCT_CATEGORIES, ROUTES } from "./site-routes";

/**
 * The flagship header.
 *
 * Information architecture only — the visual language (ink bar, blurred solid state, gold
 * underline, retract-on-scroll, the official mark) is unchanged from the previous header. What
 * changed is *what is in it*: the placeholder six-link nav is replaced by the seven primary
 * destinations from SITE_STRUCTURE, with a mega menu under Products.
 *
 * The mega menu follows the Global Components sheet exactly: three columns, three categories in
 * each of the first two, and Product Finder plus the catalogue-download promo in the third.
 *
 * ── Interaction ────────────────────────────────────────────────────────────
 *
 * Products is a `<button aria-expanded>` rather than a link with a hover panel, because a
 * hover-only mega menu is unreachable by keyboard and unusable on touch. It opens on hover for
 * pointer users *and* on click/Enter/Space for everyone else, closes on Escape, on outside
 * click, and when focus leaves the group. The trigger still points at `/products` for anyone
 * who wants the landing page: the label is a link inside the panel's first row.
 *
 * Mobile is a hamburger drawer with Products as a disclosure accordion. Two actions are pinned to
 * the bottom of the drawer, per the same sheet — though the first of them is **Contact Us and not
 * WhatsApp**, because no WhatsApp number is confirmed; see the note at the drawer foot.
 */
export function SiteNav(): ReactNode {
  const ref = useRef<HTMLElement>(null);
  const megaRef = useRef<HTMLDivElement>(null);
  const langRef = useRef<HTMLDivElement>(null);

  const [mega, setMega] = useState(false);
  const [lang, setLang] = useState(false);
  const [drawer, setDrawer] = useState(false);
  const [drawerProducts, setDrawerProducts] = useState(false);
  const [locale, setLocale] = useState("en");

  const megaId = useId();
  const langId = useId();
  const drawerId = useId();
  const drawerProductsId = useId();

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

  /* One handler for every dismissal route: Escape, and a click outside the open group. */
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key !== "Escape") return;
      setMega(false);
      setLang(false);
      setDrawer(false);
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
  }, []);

  /* The drawer owns the viewport while open. */
  useEffect(() => {
    document.documentElement.style.overflow = drawer ? "hidden" : "";
    return () => {
      document.documentElement.style.overflow = "";
    };
  }, [drawer]);

  const columns = [PRODUCT_CATEGORIES.slice(0, 3), PRODUCT_CATEGORIES.slice(3, 6)];

  return (
    <header ref={ref} className="fs-nav" data-surface="midnight">
      <div className="fs-wrap fs-nav-in">
        <a href={ROUTES.home} className="fs-logo" aria-label="Sam Group — home">
          <LogoMark height={28} priority />
          <span>
            <span className="fs-logo-txt">SAM GROUP</span>
            <span className="fs-logo-sub">Petroleum Engineering</span>
          </span>
        </a>

        <nav className="fs-nav-links" aria-label="Primary">
          {PRIMARY_NAV.map((item) =>
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
                  aria-expanded={mega}
                  aria-controls={megaId}
                  onClick={() => setMega((v) => !v)}
                >
                  {item.label}
                  <svg
                    width="10"
                    height="10"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.2"
                    aria-hidden="true"
                    className="fs-nav-caret"
                  >
                    <path d="M5 9l7 7 7-7" />
                  </svg>
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
                          {col.map((cat) => (
                            <li key={cat.href}>
                              <a href={cat.href}>{cat.label}</a>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}

                    <div className="fs-mega-col fs-mega-col--promo">
                      <p className="fs-mega-head">Find &amp; download</p>
                      <ul>
                        <li>
                          <a href={ROUTES.productFinder}>Product Finder</a>
                        </li>
                        <li>
                          <a href={ROUTES.documentation}>Download Catalogue</a>
                        </li>
                      </ul>
                      <a href={ROUTES.products} className="fs-mega-all">
                        All products
                        <Arrow size={13} />
                      </a>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <a key={item.href} href={item.href}>
                {item.label}
              </a>
            ),
          )}
        </nav>

        <div className="fs-nav-right">
          {/* Language selector. Presentational until locale routing lands — see the note in
              site-routes.ts and the report; it marks the current locale and nothing more. */}
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

            <div className="fs-lang-menu" id={langId} data-open={lang || undefined} role="menu">
              {LOCALES.map((l) => (
                <button
                  key={l.code}
                  type="button"
                  role="menuitem"
                  aria-current={l.code === locale}
                  onClick={() => {
                    setLocale(l.code);
                    setLang(false);
                  }}
                >
                  {l.native}
                  <span>
                    {l.code.toUpperCase()} · {l.direction.toUpperCase()}
                  </span>
                </button>
              ))}
            </div>
          </div>

          <a href={ROUTES.requestQuote} className="fs-btn fs-btn--gold fs-nav-cta">
            Request a Quote
          </a>

          <button
            type="button"
            className="fs-burger"
            aria-expanded={drawer}
            aria-controls={drawerId}
            aria-label={drawer ? "Close menu" : "Open menu"}
            onClick={() => setDrawer((v) => !v)}
          >
            <span data-open={drawer || undefined} />
          </button>
        </div>
      </div>

      {/* Mobile drawer */}
      <div className="fs-drawer" id={drawerId} data-open={drawer || undefined}>
        <nav className="fs-drawer-nav" aria-label="Mobile">
          {PRIMARY_NAV.map((item) =>
            item.mega ? (
              <div className="fs-drawer-group" key={item.href}>
                <button
                  type="button"
                  className="fs-drawer-toggle"
                  aria-expanded={drawerProducts}
                  aria-controls={drawerProductsId}
                  onClick={() => setDrawerProducts((v) => !v)}
                >
                  {item.label}
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    aria-hidden="true"
                    className="fs-nav-caret"
                  >
                    <path d="M5 9l7 7 7-7" />
                  </svg>
                </button>
                <div
                  className="fs-drawer-panel"
                  id={drawerProductsId}
                  data-open={drawerProducts || undefined}
                >
                  <div>
                    <ul>
                      {PRODUCT_CATEGORIES.map((cat) => (
                        <li key={cat.href}>
                          <a href={cat.href}>{cat.label}</a>
                        </li>
                      ))}
                      <li>
                        <a href={ROUTES.productFinder}>Product Finder</a>
                      </li>
                      <li>
                        <a href={ROUTES.documentation}>Download Catalogue</a>
                      </li>
                      <li>
                        <a href={ROUTES.products}>All products</a>
                      </li>
                    </ul>
                  </div>
                </div>
              </div>
            ) : (
              <a key={item.href} href={item.href} className="fs-drawer-link">
                {item.label}
              </a>
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
          <a href={ROUTES.contactUs} className="fs-btn fs-btn--glass">
            Contact Us
          </a>
          <a href={ROUTES.requestQuote} className="fs-btn fs-btn--gold">
            Request a Quote
          </a>
        </div>
      </div>
    </header>
  );
}
