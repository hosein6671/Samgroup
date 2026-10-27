import faUi from "./messages/fa.json";

/**
 * The UI chrome catalogs, one per locale that has one.
 *
 * Each catalog maps the **English source text** to its translation — the gettext shape rather
 * than invented keys. Two reasons, both about the people who maintain it: a reviewer reads the
 * file as a two-column glossary (what the page says in English, what it says in Persian) without
 * opening a component, and a component reads `t("Close menu")`, so the English a developer sees
 * in the source is exactly what an English reader sees on the page.
 *
 * UI chrome only — navigation, buttons, form labels and messages, pagination, empty and
 * unavailable states, accessible names. This module is imported by client components, so it must
 * stay small; the layouts' built-in copy lives in `content-catalogs.ts`, which is server-only.
 *
 * English has no catalog: it is the source text. A locale in the `Locale` table with no entry
 * here renders the English source unchanged, so adding a language still needs no code change to
 * render; translating its chrome adds one catalog file and one line below.
 */
export type Catalog = Readonly<Record<string, string>>;

export const UI_CATALOGS: Readonly<Record<string, Catalog>> = {
  fa: faUi,
};

const EMPTY: Catalog = {};

export function uiCatalog(locale: string): Catalog {
  return UI_CATALOGS[locale] ?? EMPTY;
}
