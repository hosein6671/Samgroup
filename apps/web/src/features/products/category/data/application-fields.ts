/**
 * The guard behind a `downstream` Applications entry's field list.
 *
 * ── Why it left `base-oils.ts` ──────────────────────────────────────────────
 *
 * It was written as a module-private function in the first fixture that needed it, which was
 * correct while exactly one category was an input. Base Oils is not the only one: Lubricant
 * Additives & Components is an input too, and a second copy of a validation rule is a second place
 * for it to weaken. Moved here unchanged rather than duplicated.
 *
 * ── What it enforces ────────────────────────────────────────────────────────
 *
 * An Applications entry names one of the site's own product families as a destination, and the
 * fields listed under it must be ranges that family already publishes. This checks that at module
 * load: a field that is not in the destination's frozen `ranges` throws rather than rendering.
 *
 * Same guard style as `products-data.ts`'s `href(index)` — drift fails loudly instead of shipping
 * a page that quietly disagrees with the range it links to.
 */

import { FAMILIES } from "../../products-data";

export function fields(familyId: string, picked: readonly string[]): readonly string[] {
  const family = FAMILIES.find((entry) => entry.id === familyId);
  if (!family) throw new Error(`No product family "${familyId}" in products-data.ts`);

  for (const field of picked) {
    if (!family.ranges.includes(field)) {
      throw new Error(`"${field}" is not one of ${familyId}'s published ranges`);
    }
  }
  return picked;
}
