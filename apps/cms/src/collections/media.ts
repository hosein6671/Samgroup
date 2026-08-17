import { editorOnly, mediaRead } from "../access";
import { CMS_MEDIA_PREFIX } from "../env";

import type { CollectionConfig } from "payload";

/**
 * `Media` — Payload's upload collection, for **Payload-owned editorial media only**.
 *
 * ── The ownership boundary, which is frozen ────────────────────────────────
 *
 * PAYLOAD_CONTENT_ARCHITECTURE.md approved decision 4, following directly from ADR-002: "Payload's
 * Media/upload collection handles Payload-owned editorial media; Prisma's `Media` table stays
 * exclusively for Prisma-owned entities (Products, BlogPosts)." The split is not stylistic — the two
 * live in different databases and neither can hold a foreign key to the other.
 *
 * So this collection may hold hero images for company Globals, editorial imagery inside legal or
 * corporate pages, social/OG images, and company-wide assets such as a catalogue PDF attached to the
 * Global that offers it. It **must not** become the home for:
 *
 * - product photography or product technical documents (TDS/SDS/COA) — Prisma `Media`,
 *   `ownerType: 'Product'`, per §Documents/Downloads;
 * - blog featured images — Prisma `Media`, `ownerType: 'BlogPost'`, because `BlogPost` is
 *   Prisma-owned (§3);
 * - CVs or any application upload — those are `sam-private` objects reached through presigned URLs
 *   issued by NestJS, and nothing in this collection can write there (see `cmsMediaStorage`);
 * - anything belonging to a Prisma-owned entity, for any reason.
 *
 * ── Fields: `alt`, and deliberately nothing else ───────────────────────────
 *
 * The documents describe this as Payload's "built-in Media/upload (native)" collection and freeze
 * exactly one field on it: descriptive alt text, required for Image SEO and accessibility
 * (SEO_ARCHITECTURE.md §Image SEO, DATABASE.md). **No caption, credit, attribution, tag or category
 * field is specified anywhere**, so none is added — Payload's own examples ship several, and adding
 * them because they are conventional is how a media library turns into an unspecified DAM. Width,
 * height, filesize, MIME type and the URL are produced by Payload's upload handling itself and are
 * not redeclared here.
 */
export const Media: CollectionConfig = {
  slug: "media",
  access: {
    create: editorOnly,
    delete: editorOnly,
    read: mediaRead,
    update: editorOnly,
  },
  admin: {
    defaultColumns: ["filename", "alt", "mimeType", "filesize"],
    description:
      "Editorial media for Payload-owned content only. Product and blog imagery belong to the platform database, not here.",
    useAsTitle: "alt",
  },
  fields: [
    {
      name: "alt",
      type: "text",
      required: true,
      /*
       * Localized, because alt text is copy rather than a fact: it is read aloud by a screen reader
       * and indexed as text, so an Arabic page whose image announces itself in English is both an
       * accessibility failure and a mixed-language SEO signal. This is the same test the field
       * summary applies everywhere — dates and certificate numbers are not localized; anything a
       * reader reads is.
       */
      localized: true,
      admin: {
        description:
          "Describes the image for screen readers and search engines. Say what it shows, not that it is an image.",
      },
    },
  ],
  upload: {
    /*
     * `staticDir` is deliberately unset. Payload writes uploads to a directory on the application's
     * own filesystem by default, and DEVOPS.md forbids exactly that — media "never lives in a
     * database or on a container volume belonging to an app". The `s3Storage` plugin in
     * `payload.config.ts` replaces the local handler entirely, so bytes go to the object store and
     * only the record lands in `sam_cms`.
     *
     * MIME types are restricted to still images. This is not a general asset store: everything the
     * frozen content model attaches to this collection today is imagery, and an upload collection
     * that accepts anything is one paste away from holding a document that should have been a
     * `sam-private` object. Widening it is a content-model decision, made when a Global actually
     * needs a PDF, not a default set now.
     */
    mimeTypes: ["image/jpeg", "image/png", "image/webp", "image/avif", "image/svg+xml"],
    /*
     * No `imageSizes`. Generating derivative sizes is a real decision — which breakpoints, which
     * formats, whether `next/image` optimises at the origin instead — and SEO_ARCHITECTURE.md §6
     * already commits to `next/image` with "modern formats (AVIF/WebP with fallback)" doing that
     * work. Pre-generating a second, unrelated set here would mean two systems resizing the same
     * image to different sizes, and the one the frontend does not use would still cost storage on
     * every upload.
     */
    disableLocalStorage: true,
  },
};

/**
 * The public URL of a stored object — the platform's media URL contract, in one function.
 *
 * It lives here beside the collection but is applied by the **storage plugin** in
 * `payload.config.ts`, because `generateFileURL` is a plugin-level option: the plugin owns the URL
 * of a file it stored, and a `generateFileURL` on the collection's own `upload` block is ignored
 * once an adapter is attached.
 *
 * ── Why the URL is origin-relative ─────────────────────────────────────────
 *
 * nginx already owns this contract: `docker/nginx/templates/default.conf.template` proxies
 * `/media/<key>` to `<public bucket>/<key>`, serves it from the site's own origin with cache
 * headers, and strips the S3 response headers. So the correct public address of an object written
 * to `cms/photo.png` is exactly `/media/cms/photo.png` — no host, no scheme, no bucket name.
 *
 * Relative rather than absolute is what keeps the undecided production object store out of the
 * database. An absolute URL would bake today's endpoint into every media row — the MinIO container
 * in development, and whatever replaces MinIO in production, a choice DEVOPS.md records as still
 * owed — so changing stores would mean rewriting stored data. It also keeps the object store's real
 * address off the public wire entirely, and it means `apps/web` needs no `next/image`
 * `remotePatterns` entry, because these images are same-origin.
 *
 * Absolutising it — which Open Graph tags require — is the frontend's job, deliberately:
 * `packages/types/src/seo.ts` already records that composing public URLs belongs to `apps/web`,
 * which knows the origin it is being served from, and Next's Metadata API resolves a relative image
 * against `metadataBase` for exactly this case.
 *
 * @param prefix the plugin's per-collection key prefix, when it supplies one.
 * @returns an origin-relative path, always beginning `/media/`.
 */
export function mediaFileURL({ filename, prefix }: { filename: string; prefix?: string }): string {
  return `/media/${prefix ?? CMS_MEDIA_PREFIX}/${filename}`;
}
