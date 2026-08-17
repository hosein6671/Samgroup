import path from "node:path";
import { fileURLToPath } from "node:url";

import { postgresAdapter } from "@payloadcms/db-postgres";
import { lexicalEditor } from "@payloadcms/richtext-lexical";
import { buildConfig } from "payload";

import { Pages } from "./collections/pages";
import { Users } from "./collections/users";
import { cmsDatabaseUri, payloadSecret } from "./env";
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

export default buildConfig({
  admin: {
    user: Users.slug,
  },
  collections: [Users, Pages],
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
