import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

import { typeRoles } from "../tokens/typography";

/**
 * tailwind-merge has to be taught this system's type scale, or it silently deletes it.
 *
 * Its default configuration knows Tailwind's stock font sizes (`text-lg`, `text-2xl`). It has
 * never heard of `text-display-1`, so it classifies that class as a *text colour* — and then,
 * seeing `text-text-primary` in the same conflict group, keeps only the last one. Every
 * `<Text role tone>` therefore rendered with its role stripped and fell back to inherited body
 * type, and `<Button variant="primary">` lost `text-on-accent`, taking its label to 2.02:1
 * against the accent fill. Both were invisible to the A-2 audit, which measured token pairs
 * rather than rendered elements.
 *
 * The role names come from the token source rather than a copied list, so adding a typographic
 * role cannot leave this file behind — which is exactly how the original defect would recur.
 */
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      "font-size": [{ text: Object.keys(typeRoles) }],
    },
  },
});

/**
 * Compose class names, letting a caller's class win over a primitive's default rather than
 * both landing in the output and the cascade deciding arbitrarily.
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
