"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";

import type { Catalog } from "./catalogs";
import { translatorFrom, type Translate } from "./translate";

const CatalogContext = createContext<Catalog>({});
const LocaleContext = createContext<string>("en");

/**
 * Hands the active locale's UI catalog to client components. The `[locale]` root layout renders
 * it once with `uiCatalog(locale)`, so only that one locale's chrome reaches the browser.
 */
export function I18nProvider({
  catalog,
  locale = "en",
  children,
}: {
  readonly catalog: Catalog;
  /** The page's locale code, for client components that format numbers or dates. */
  readonly locale?: string;
  readonly children: ReactNode;
}): ReactNode {
  return (
    <LocaleContext.Provider value={locale}>
      <CatalogContext.Provider value={catalog}>{children}</CatalogContext.Provider>
    </LocaleContext.Provider>
  );
}

/** The page's locale code inside a client component. */
export function useLocale(): string {
  return useContext(LocaleContext);
}

/** The client-side translator. Outside a provider it returns the English source, as `en` does. */
export function useT(): Translate {
  const catalog = useContext(CatalogContext);
  return useMemo(() => translatorFrom(catalog), [catalog]);
}
