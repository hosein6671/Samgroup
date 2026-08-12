/**
 * The canonical `entityType` values for the polymorphic tables in sam_platform —
 * `content_translations`, `seo_meta`, `status_history`, and `media.owner_type`
 * (DATA_MODEL.md §Notes). Those four columns are plain strings with no database
 * constraint, so a typo in one module silently produces rows no other module can find.
 *
 * PascalCase matching the Prisma model name is not a new convention: API_CONTRACT_FINAL.md
 * §6 already specifies the RAG export filtering `Media` by `ownerType == 'Product'`, and
 * DATA_MODEL.md writes the same values ("Product, BlogPost, future entities"). This file
 * records that convention rather than choosing one.
 *
 * Limited to the entities ContentTranslation actually covers (ARCHITECTURE.md
 * §Internationalization: "Prisma-owned content (Product, Category, BlogPost, Segment,
 * ProductType)"). Submission entities are reachable through StatusHistory with the same
 * convention, but they get their members when the module that writes them is built — not
 * speculatively here.
 *
 * `Segment` and `ProductType` are members because the Product Detail response serves their
 * localized `name` and `slug`, which is a real call site — not because the taxonomy exists.
 * They have no endpoints, no pages, no SEO records and no sitemap entries.
 */
export const ContentEntityType = {
  Product: "Product",
  Category: "Category",
  BlogPost: "BlogPost",
  Segment: "Segment",
  ProductType: "ProductType",
} as const;

export type ContentEntityType = (typeof ContentEntityType)[keyof typeof ContentEntityType];
