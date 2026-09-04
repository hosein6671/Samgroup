/**
 * The About Us page's in-page anchors.
 *
 * **Structural identifiers, so they are code and not content.** An anchor is part of a URL —
 * `/en/about-us#who-we-are` — and structural URLs stay fixed English across every locale
 * (PROJECT_HANDOFF §6.12). Localising them would give the same section three addresses, and putting
 * them in the CMS would let an edit break a link somebody had already shared.
 *
 * They are written once here so no `#` string is retyped in a component.
 */
export const ANCHORS = {
  whoWeAre: "who-we-are",
  expertise: "expertise",
  advantages: "competitive-advantages",
  team: "team",
  quality: "quality-standards",
  next: "next-step",
} as const;
