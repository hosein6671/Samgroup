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
