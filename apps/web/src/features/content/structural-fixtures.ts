import "server-only";

import type { StructuralScope } from "@sam-group/types";

import {
  BRIEF_FIELDS,
  DELIVERY_STEPS,
  INCOTERMS,
  PACKAGING,
} from "@/features/export-logistics/export-logistics-experience";
import {
  ADVANTAGES,
  CUSTOM_STEPS,
  FAMILIES as HOME_FAMILIES,
  HERO_SHOTS,
  HERO_SPEC,
  HUBS,
  INDUSTRIES,
  NETWORK_STATS,
  TRUST_INDICATORS,
  WHO_WE_ARE,
} from "@/features/home/home-data";
import { CLOSING_ROUTES, DOCUMENT_TIERS, FINDER_FACETS } from "@/features/products/products-data";

/**
 * The built-in list each `structuralList(editorial, key, FIXTURE)` call falls back to, by scope
 * and list key — the same pairs the call sites name, gathered so the built-in copy can be
 * translated as whole rows.
 *
 * The CMS list rows (`STRUCTURAL_LISTS`) carry only the fields an editor may change; a fixture
 * row carries everything the section renders. Translating only the editorial fields would leave
 * a card's other text in English, so a non-default locale's built-in copy is built from these.
 */
export const STRUCTURAL_FIXTURES: Partial<
  Record<StructuralScope, Readonly<Record<string, readonly unknown[]>>>
> = {
  home: {
    hero_facts: HERO_SPEC,
    hero_shots: HERO_SHOTS,
    who_we_are: WHO_WE_ARE,
    trust_indicators: TRUST_INDICATORS,
    families: HOME_FAMILIES,
    advantages: ADVANTAGES,
    industries: INDUSTRIES,
    custom_steps: CUSTOM_STEPS,
    network_hubs: HUBS,
    network_stats: NETWORK_STATS,
  },
  "products-landing": {
    finder_facets: FINDER_FACETS,
    document_tiers: DOCUMENT_TIERS,
    closing_routes: CLOSING_ROUTES,
  },
  "export-logistics": {
    brief_fields: BRIEF_FIELDS,
    delivery_steps: DELIVERY_STEPS,
    packaging: PACKAGING,
    incoterms: INCOTERMS,
  },
};

/**
 * One fixture row as a list row `structuralList` can merge: every string field, string arrays
 * joined by newline (which is how `structuralList` splits them back), and `[title, description]`
 * tuples as those two names. Never a link, path or identifier: those stay the layout's own, so a
 * built-in row cannot point a localized page at an unlocalized URL.
 */
const NOT_TEXT = new Set([
  "href",
  "src",
  "icon",
  "route",
  "key",
  "id",
  "slot",
  "photo",
  "focus",
  "drift",
  "code",
  "kind",
  "image",
]);

export function fixtureRow(item: unknown, index: number): Record<string, string> {
  const row: Record<string, string> = { source: String(index) };
  if (Array.isArray(item)) {
    if (typeof item[0] === "string") row.title = item[0];
    if (typeof item[1] === "string") row.description = item[1];
    return row;
  }
  if (item && typeof item === "object") {
    for (const [key, value] of Object.entries(item)) {
      if (NOT_TEXT.has(key)) continue;
      if (typeof value === "string") row[key] = value;
      else if (Array.isArray(value) && value.every((entry) => typeof entry === "string"))
        row[key] = value.join("\n");
    }
  }
  return row;
}
