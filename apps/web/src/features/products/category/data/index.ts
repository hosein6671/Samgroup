/**
 * The category content registry.
 *
 * One entry per frozen product category, keyed by the slug in its canonical route. All six are
 * now here, and every one after the first cost a fixture file and a key — no component work.
 *
 * When the catalogue endpoints exist this module is what disappears: `getCategoryContent`
 * becomes a call to `GET /api/v1/categories/:slug` and every caller keeps its signature. That is
 * the point of routing every page through this function rather than importing `BASE_OILS`
 * directly — the swap has one site, not one per page.
 */

import type { ProductCategoryContent } from "../category-contract";

import { ANTIFREEZE_COOLANTS } from "./antifreeze-coolants";
import { BASE_OILS } from "./base-oils";
import { ENGINE_OILS_AUTOMOTIVE_LUBRICANTS } from "./engine-oils-automotive-lubricants";
import { INDUSTRIAL_OILS_LUBRICANTS } from "./industrial-oils-lubricants";
import { LUBRICANT_ADDITIVES } from "./lubricant-additives";
import { MARINE_OILS_LUBRICANTS } from "./marine-oils-lubricants";

/* Keys are the slugs in `PRODUCT_CATEGORIES`, and the order is that table's order. */
const REGISTRY: Readonly<Record<string, ProductCategoryContent>> = {
  "base-oils": BASE_OILS,
  "lubricant-additives": LUBRICANT_ADDITIVES,
  "engine-oils-automotive-lubricants": ENGINE_OILS_AUTOMOTIVE_LUBRICANTS,
  "industrial-oils-lubricants": INDUSTRIAL_OILS_LUBRICANTS,
  "marine-oils-lubricants": MARINE_OILS_LUBRICANTS,
  "antifreeze-coolants": ANTIFREEZE_COOLANTS,
};

/** Returns the category's content, or `undefined` for a slug with no page yet. */
export function getCategoryContent(slug: string): ProductCategoryContent | undefined {
  return REGISTRY[slug];
}

/** The slugs that currently resolve. `generateStaticParams` reads this once the real route exists. */
export function publishedCategorySlugs(): readonly string[] {
  return Object.keys(REGISTRY);
}
