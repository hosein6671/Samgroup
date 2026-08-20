/**
 * The one prop shape every category section takes.
 *
 * `content` is the category's own data; `family` is its record in the canonical six — name, code,
 * href and descriptor — resolved once by the template rather than re-looked-up per section.
 *
 * `locale` is the route's own locale segment, validated by `app/[locale]/layout.tsx` and read off
 * the URL by the page. **It is required, and it is threaded rather than derived.** Half the links
 * on a Family page are structural routes or sibling family addresses, and until this shape carried
 * a locale every one of them rendered locale-less for `middleware.ts` to re-negotiate. A section
 * that re-derived it — from a hook, a header or a cookie — would be a second answer to a question
 * the route already answered, which is the shape the frozen locale rules exist to prevent.
 *
 * Uniform on purpose. Every section takes all three even where it uses one, so the template
 * composes them without a per-section prop list, and a section that later needs the family record
 * is a one-line change inside that file rather than a change to the template's call site.
 */

import type { ProductFamily } from "../products-data";

import type { ProductCategoryContent } from "./category-contract";

export type SectionProps = {
  readonly content: ProductCategoryContent;
  readonly family: ProductFamily;
  readonly locale: string;
};
