# ADR-002: Two Independent Postgres Databases (Prisma vs. Payload)

## Status

Accepted (supersedes an earlier "shared database, separate schema" draft in this project's docs)

## Context

Payload CMS manages its own database access layer internally; the platform's business logic is managed separately via Prisma. Both need Postgres, and both need to run without stepping on each other's migrations.

The first version of `ARCHITECTURE.md` proposed a **single Postgres database with two schemas** (`public` for Prisma, `cms` for Payload), using Payload's `schemaName` adapter option to redirect Payload's tables out of `public`.

That approach was verified against Payload's own documentation and issue tracker before being finalized, which surfaced real problems:

- Payload's Postgres adapter documents `schemaName` as **experimental**.
- The custom schema must already exist in Postgres before Payload starts — Payload does not create it.
- A previously reported bug ([payloadcms/payload#5822](https://github.com/payloadcms/payload/issues/5822)) showed collection changes not applying correctly to tables in a non-default schema after the initial creation.
- The `public` schema was historically hardcoded in several places in the adapter's internals ([payloadcms/payload#4818](https://github.com/payloadcms/payload/discussions/4818)); this was fixed, but it shows the non-default-schema path is less exercised than the default.

Running Prisma and Payload against schemas in the *same* database also means both tools share the same migration lock/connection pool namespace, increasing the blast radius of a mistake (e.g. a `migrateFresh` accidentally targeting the wrong schema).

## Decision

Run **two independent Postgres databases** on the **same Postgres server/container**:

- `sam_platform` — owned and migrated by Prisma, used only by `apps/api`
- `sam_cms` — owned and migrated by Payload, used only by `apps/cms`

Each database gets its own connection string and its own database user; the `sam_platform` user has no login rights to `sam_cms` and vice versa, so the separation is enforced by Postgres credentials, not just application config. See [DEVOPS.md](../DEVOPS.md#postgres-databases) for the container/credential setup, and [ARCHITECTURE.md](../ARCHITECTURE.md#cms-integration) for how this fits the broader CMS integration decision (ADR-003).

## Consequences

**Positive**

- Both Prisma and Payload run against their respective default (`public`) schema in their own database — zero experimental features involved.
- A migration mistake in one tool cannot touch the other tool's tables, even accidentally.
- Each database can be backed up, restored, or scaled independently.

**Negative**

- Cross-database joins are impossible at the SQL level — any view that needs both platform data and CMS content (e.g. a product page merging Prisma product data with Payload page content) must be composed in application code (NestJS), not in a query. This is already required by the "NestJS fronts Payload" decision (ADR-003), so it isn't new cost.
- One extra database to provision/monitor/back up versus a single-database approach.

## Alternatives Considered

- **Single database, separate schemas via `schemaName`** — rejected per the Context section above; revisit only if Payload marks `schemaName` stable and the migration bugs are confirmed resolved in the version being used.
- **Single database, single schema, shared tables** — rejected outright: couples Payload's internal migrations to Prisma's, violates the "CMS only manages content" rule in `ARCHITECTURE.md`.
