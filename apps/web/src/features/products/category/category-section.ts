/**
 * The one prop shape every category section takes.
 *
 * `content` is the category's own data; `family` is its record in the canonical six — name, code,
 * href and descriptor — resolved once by the template rather than re-looked-up per section.
 *
 * Uniform on purpose. Every section takes both even where it uses one, so the template composes
 * them without a per-section prop list, and a section that later needs the family record is a
 * one-line change inside that file rather than a change to the template's call site.
 */

import type { ProductFamily } from "../products-data";

import type { ProductCategoryContent } from "./category-contract";

export type SectionProps = {
  readonly content: ProductCategoryContent;
  readonly family: ProductFamily;
};
