"use client";

import type { ReactNode } from "react";

import "../home/flagship.css";
import "../legal/legal.css";

import { useLocale, useT } from "@/i18n/i18n-provider";

import { SiteNav, type SiteNavProps } from "./site-nav";
import { ROUTES } from "./site-routes";

/**
 * The public 404, in the page's own language.
 *
 * Before this existed a missing `/fa/...` page fell through to Next's built-in English text ("This
 * page could not be found.") on a right-to-left page. `not-found.tsx` receives no route params, so
 * the locale is read from the `[locale]` layout's `I18nProvider`, which wraps it. The footer is a
 * server component that needs the locale as a prop, so this page carries the header only; the
 * header and the two links are the ways forward.
 */
export function NotFoundPage({
  locales,
}: {
  readonly locales: SiteNavProps["locales"];
}): ReactNode {
  const locale = useLocale();
  const t = useT();
  return (
    <div data-brand="flagship">
      <SiteNav locale={locale} locales={locales} />
      <main id="main-content">
        <section className="fs-sec lg-unavailable" data-surface="midnight">
          <div className="fs-blueprint" aria-hidden="true" />
          <div className="fs-wrap lg-unavailable-inner">
            <p className="fs-eyebrow">404</p>
            <h1 className="fs-d2 lg-unavailable-title">{t("This page could not be found.")}</h1>
            <p className="fs-lead">
              {t("The address may have changed, or the page has not been published yet.")}
            </p>
            <p style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
              <a className="fs-btn fs-btn--gold" href={`/${locale}${ROUTES.home}`}>
                {t("Home")}
              </a>
              <a className="fs-btn fs-btn--glass" href={`/${locale}${ROUTES.products}`}>
                {t("Products")}
              </a>
            </p>
          </div>
        </section>
      </main>
    </div>
  );
}
