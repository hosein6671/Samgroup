/**
 * The Quality & Certifications page's in-page anchors.
 *
 * ── Why these stayed in code when the copy moved to the CMS ─────────────────
 *
 * An anchor id is part of the page's structure, not its content: it is declared by the component
 * that owns the section, shared in links, and changed only by changing the markup. Storing one in
 * the CMS would let an edit silently break a fragment somebody had already sent — the same rule
 * `fields/cta.ts` records for the Customized Solutions request anchor, where the CMS holds the
 * button's wording and never its target.
 *
 * They live in their own module rather than inside a section because more than one section reads
 * them and because `quality-data.ts`, which used to hold them, was deleted with the CMS cutover.
 */
export const ANCHORS = {
  approach: "quality-approach",
  laboratory: "laboratory-capability",
  certifications: "certifications",
  documentation: "documentation",
  sampling: "sampling-policy",
  next: "next-step",
} as const;
