/**
 * Environment reading for `apps/cms`, validated at config-build time.
 *
 * Payload builds its config once, at module load, and the whole application — admin UI, REST
 * API, migrations and the Local API alike — is derived from it. That makes config-build time the
 * only place a bad environment can be caught before it becomes a runtime fault, so every reader
 * below throws rather than defaulting. `apps/api` takes the same position for the same reason
 * (`src/config/env.validation.ts`): a misconfigured process that boots is harder to diagnose than
 * one that does not.
 *
 * No value here is ever echoed into a thrown message. `DATABASE_URI` carries the CMS database
 * password and `PAYLOAD_SECRET` is a signing key; a config-build failure prints straight to stdout
 * and into container logs (SECURITY.md "Secrets Management").
 *
 * **Only secrets and connection details live here.** The locale set is deliberately NOT among them —
 * it is frozen in `localization.ts`, because a frozen architectural decision that an environment
 * variable can override is not frozen.
 */

/** The only database Payload may ever open a connection to (ADR-002). */
const CMS_DATABASE = "sam_cms";

const POSTGRES_PROTOCOLS: ReadonlySet<string> = new Set(["postgresql:", "postgres:"]);

function required(name: string): string {
  const value = process.env[name]?.trim();

  if (value === undefined || value === "") {
    throw new Error(`${name} is required and was empty.`);
  }

  return value;
}

/**
 * The `sam_cms` connection string, refused if it points anywhere else.
 *
 * Defense-in-depth for ADR-002, and the mirror image of `apps/api`'s `IsPlatformDatabaseUrl`: a
 * copy-pasted `sam_platform` URL fails while the config is being built rather than at the first
 * query, or — far worse — succeeding and letting Payload create its own tables inside the
 * application database. The PostgreSQL grants remain the real boundary (asserted by
 * `scripts/verify-db-isolation.sh`); this only removes the misconfiguration that would make
 * Payload try.
 */
export function cmsDatabaseUri(): string {
  const value = required("DATABASE_URI");

  let url: URL;

  try {
    url = new URL(value);
  } catch {
    throw new Error("DATABASE_URI is not a valid URL.");
  }

  if (!POSTGRES_PROTOCOLS.has(url.protocol)) {
    throw new Error("DATABASE_URI must be a postgresql:// connection string.");
  }

  // `pathname` is "/sam_cms"; query parameters such as ?schema=public are not part of it.
  if (url.pathname.replace(/^\//, "") !== CMS_DATABASE) {
    throw new Error(
      `DATABASE_URI must target the ${CMS_DATABASE} database — Payload may never open sam_platform (ADR-002).`,
    );
  }

  return value;
}

export function payloadSecret(): string {
  return required("PAYLOAD_SECRET");
}

/**
 * The S3-compatible object storage Payload writes editorial media to.
 *
 * ── Why object storage and not a disk ───────────────────────────────────────
 *
 * DEVOPS.md "Object storage (MinIO)" is categorical: media "never lives in a database or on a
 * container volume belonging to an app". Payload's default upload behaviour — a `staticDir` on the
 * container filesystem — is exactly the thing that rule forbids, so the adapter is not optional
 * here even for a foundation gate. The development implementation is MinIO; the production
 * replacement is undecided and deliberately not named anywhere in this codebase, which is why every
 * value below is configuration rather than a constant.
 *
 * ── Which bucket, and why not a third one ──────────────────────────────────
 *
 * `sam-public`. DEVOPS.md defines exactly two buckets, split by SENSITIVITY rather than by owner:
 * `sam-public` (anonymous read, proxied by nginx at `/media/*`) and `sam-private` (no anonymous
 * access, presigned URLs only, never proxied). Editorial images on public pages are public content,
 * so they belong in the first. A third "CMS" bucket would be a new access policy to reason about
 * and would contradict a documented two-bucket model; CMS objects are namespaced by key prefix
 * instead, which achieves isolation without inventing infrastructure.
 *
 * **Nothing here may ever point at `sam-private`.** That bucket holds CVs and confidential
 * formulation documents (SECURITY.md "Data Protection"), it is never proxied, and an upload
 * collection writing into it would produce objects that look public to an editor and are
 * unreachable in fact. The guard below refuses it outright.
 */
const PRIVATE_BUCKET_MARKER = "private";

export type CmsMediaStorage = {
  readonly bucket: string;
  readonly prefix: string;
  readonly endpoint: string;
  readonly region: string;
  readonly accessKeyId: string;
  readonly secretAccessKey: string;
};

/**
 * The key prefix every CMS-owned object is written under, within `sam-public`.
 *
 * Fixed in code rather than configured. It is half of the public URL contract — `/media/cms/<file>`
 * resolves through nginx to `sam-public/cms/<file>` — and a per-environment prefix would mean the
 * same document served a different URL depending on where it was deployed.
 */
export const CMS_MEDIA_PREFIX = "cms";

export function cmsMediaStorage(): CmsMediaStorage {
  const bucket = required("CMS_MEDIA_BUCKET");

  if (bucket.toLowerCase().includes(PRIVATE_BUCKET_MARKER)) {
    throw new Error(
      "CMS_MEDIA_BUCKET must be the public media bucket. The private bucket holds CVs and confidential documents, is never proxied, and must never receive editorial uploads (DEVOPS.md, SECURITY.md).",
    );
  }

  const endpoint = required("CMS_MEDIA_ENDPOINT");

  try {
    new URL(endpoint);
  } catch {
    throw new Error("CMS_MEDIA_ENDPOINT is not a valid URL.");
  }

  return {
    bucket,
    prefix: CMS_MEDIA_PREFIX,
    endpoint,
    /*
     * MinIO ignores the region but the AWS SDK requires one, and it is read rather than hardcoded
     * so the production store — whichever it turns out to be — can set its own without a code
     * change. `us-east-1` is the conventional placeholder for S3-compatible stores that have no
     * concept of regions; it is a default rather than a requirement precisely because the eventual
     * production store may care.
     */
    region: process.env.CMS_MEDIA_REGION?.trim() || "us-east-1",
    accessKeyId: required("CMS_MEDIA_ACCESS_KEY_ID"),
    secretAccessKey: required("CMS_MEDIA_SECRET_ACCESS_KEY"),
  };
}
