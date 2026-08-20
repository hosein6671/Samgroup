import path from "node:path";
import { fileURLToPath } from "node:url";

import { postgresAdapter } from "@payloadcms/db-postgres";
import { lexicalEditor } from "@payloadcms/richtext-lexical";
import { s3Storage } from "@payloadcms/storage-s3";
import { buildConfig } from "payload";

import { Media, mediaFileURL } from "./collections/media";
import { Pages } from "./collections/pages";
import { Users } from "./collections/users";
import { cmsDatabaseUri, cmsMediaStorage, payloadSecret } from "./env";
import { AboutUs } from "./globals/about-us";
import { CustomizedSolutions } from "./globals/customized-solutions";
import { QualityCertifications } from "./globals/quality-certifications";
import { CMS_LOCALIZATION, assertFrozenLocalization } from "./localization";

/**
 * The Payload application — `apps/cms`, the platform's only CMS, ever (AI_CONTEXT.md).
 *
 * ── What it owns, and what it must never own ────────────────────────────────
 *
 * Payload owns editorial and corporate content in `sam_cms`. Products, Categories, Segments,
 * Product Types, Blog posts, Inquiries, Custom Formulation Requests, platform Users and everything
 * else in `sam_platform` are Prisma's, and no collection here may mirror one
 * (PAYLOAD_CONTENT_ARCHITECTURE.md §§2–3, ADR-002).
 *
 * ── Who may call it ─────────────────────────────────────────────────────────
 *
 * `apps/web` never calls this application — not the public site, not the Admin Dashboard (ADR-003).
 * NestJS's Content module is the only programmatic client, server-to-server, and the frontend has
 * no awareness Payload exists.
 */

const dirname = path.dirname(fileURLToPath(import.meta.url));

// Runs before the config is built, so a locale set that has drifted from the frozen Phase 1
// decision stops the process here rather than reaching a database migration or a served page.
assertFrozenLocalization();

const mediaStorage = cmsMediaStorage();

export default buildConfig({
  admin: {
    user: Users.slug,
  },
  collections: [Users, Pages, Media],
  /*
   * `sam_cms`, and nothing else. `cmsDatabaseUri()` refuses a connection string naming any other
   * database, so a pasted `sam_platform` URL fails while this config is being built rather than
   * letting Payload create its own tables inside the application database (ADR-002).
   */
  db: postgresAdapter({
    pool: { connectionString: cmsDatabaseUri() },
  }),
  editor: lexicalEditor(),
  /*
   * Company pages are Globals with tailored schemas, never entries in a generic collection
   * (PAYLOAD_CONTENT_ARCHITECTURE.md decision 1). `AboutUs` was the first, `CustomizedSolutions` the
   * second, `QualityCertifications` the third.
   *
   * The other eight Globals that document specifies — Home, Products Landing, Export & Logistics,
   * Contact Us, FAQ Page, Header, Footer, Settings — are **not** here, and each is its own gate.
   * Header/Footer/Settings in particular remain code-owned for now, deliberately: reading them here
   * would put a CMS call in the root layout of every page on the site.
   *
   * **No `Certifications` collection accompanies `QualityCertifications`, by decision.** That
   * collection, its Admin-only publish gate and its relation into the Quality Global are owed to a
   * later gate. Nothing in this Global models a certificate, so there is nothing to migrate when it
   * arrives — see `globals/quality-certifications.ts`.
   */
  globals: [AboutUs, CustomizedSolutions, QualityCertifications],
  /*
   * GraphQL is disabled. Payload exposes REST and GraphQL over the same data; the Content module
   * uses REST, so the GraphQL endpoint and its playground would be a second public surface on a
   * host nginx already routes from the internet, serving no client. `graphql` remains an installed
   * peer dependency of `payload` itself either way.
   */
  graphQL: {
    disable: true,
  },
  /*
   * Frozen in code — `en`/`fa`/`ar`, default `en`, `fallback: true` — and deliberately not readable
   * from the environment. See `localization.ts` for why, and for the compile-time assertions that
   * make a silent change to it a failed type-check rather than a surprise in a deployment.
   */
  localization: { ...CMS_LOCALIZATION, locales: [...CMS_LOCALIZATION.locales] },
  /*
   * Editorial media goes to S3-compatible object storage, never to a disk belonging to this
   * container — DEVOPS.md "Object storage (MinIO)" states that as a rule, and Payload's default
   * upload handling is precisely what it forbids. The plugin replaces that handling for the `media`
   * collection only.
   *
   * Every value is configuration. The development store is MinIO; the production one is an open
   * decision DEVOPS.md records as owed, and naming either here would be the hard-coding this
   * architecture has avoided everywhere else. Note what is NOT configured: no public base URL. The
   * object's public address is `/media/<prefix>/<file>`, produced by the collection's
   * `generateFileURL` and served from the site's own origin by nginx, so the store's real endpoint
   * never reaches a database row, a response body or a browser.
   *
   * `forcePathStyle` is required by MinIO and by most S3-compatible stores: virtual-hosted-style
   * addressing would put the bucket in the hostname (`sam-public.minio:9000`), which resolves
   * nowhere outside AWS.
   */
  plugins: [
    s3Storage({
      bucket: mediaStorage.bucket,
      collections: {
        [Media.slug]: {
          /*
           * By default the plugin serves files through Payload's own access control, at
           * `/api/media/file/<name>` on the CMS origin. Disabled deliberately, for two reasons that
           * both matter:
           *
           * - **It would put Payload in the browser's request path.** ADR-003 and this gate's
           *   boundary require the browser to make zero requests to the CMS; an `<img>` pointing at
           *   `cms.<domain>/api/media/file/...` breaks that on every page with an image.
           * - **It would gate nothing.** These objects live in `sam-public`, which is anonymously
           *   readable by design and already proxied by nginx at `/media/*`. Access control in front
           *   of a public object is a detour, not a protection.
           *
           * Media whose bytes genuinely need protecting is not this collection: `sam-private` holds
           * those, is never proxied, and is reached through presigned URLs from NestJS.
           */
          disablePayloadAccessControl: true,
          generateFileURL: mediaFileURL,
          // Namespaces CMS objects inside the shared public bucket. Half of the URL contract: this
          // prefix is the `cms` in `/media/cms/<file>`.
          prefix: mediaStorage.prefix,
        },
      },
      config: {
        credentials: {
          accessKeyId: mediaStorage.accessKeyId,
          secretAccessKey: mediaStorage.secretAccessKey,
        },
        endpoint: mediaStorage.endpoint,
        forcePathStyle: true,
        region: mediaStorage.region,
      },
    }),
  ],
  secret: payloadSecret(),
  /*
   * Left at Payload's default `[]` — no CORS headers, no allowed origin, wildcard or otherwise.
   * Verified against `payload/dist/config/defaults.js`. Nothing browser-originated is meant to
   * reach this application, so there is no origin to allow.
   */
  typescript: {
    outputFile: path.resolve(dirname, "payload-types.ts"),
  },
});
