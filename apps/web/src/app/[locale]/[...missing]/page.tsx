import { notFound } from "next/navigation";

/**
 * Any address under a locale that matches no route renders the locale's own 404
 * (`app/[locale]/not-found.tsx`). Without this catch-all, an unmatched `/fa/...` path never
 * reached that boundary and showed Next's built-in English page instead.
 */
export default function MissingPage(): never {
  notFound();
}
