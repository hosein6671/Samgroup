# Project Structure

## Monorepo Tooling

- Package manager / workspaces: **pnpm workspaces**
- Task runner / build cache: **Turborepo**

Rationale and alternatives considered: [ADR-001](./ADR/ADR-001-monorepo.md)

---

## Layout

```
sam-group-platform/
├── apps/
│   ├── web/            # Next.js — public site + Admin Dashboard (two areas, one app)
│   ├── api/            # NestJS backend
│   └── cms/            # Payload CMS
├── packages/
│   ├── types/          # DTOs/types shared across web & api
│   ├── ui/             # shared frontend component foundation (apps/web)
│   ├── config/         # shared framework-agnostic runtime config (e.g. future Tailwind config)
│   ├── eslint-config/  # shared ESLint flat config
│   └── tsconfig/       # shared base tsconfig.json
├── prisma/
│   ├── schema.prisma
│   └── migrations/
├── docs/
├── docker/
│   ├── web.Dockerfile
│   ├── api.Dockerfile
│   ├── cms.Dockerfile
│   ├── nginx/          # Nginx templates + README, bind-mounted into the official image
│   └── postgres/init/  # First-boot script creating the two ADR-002 databases
├── scripts/            # Operational scripts (e.g. the ADR-002 isolation check)
├── docker-compose.yml
├── docker-compose.override.yml   # Local development overrides, auto-loaded
├── .env.example
├── turbo.json
├── pnpm-workspace.yaml
└── package.json
```

---

## Notes

- `prisma/` lives at the repo root (not inside `apps/api`) since it's the schema for the `sam_platform` database only. Payload's `sam_cms` database is a separate database on the same Postgres server and is never touched by this Prisma schema — see [ARCHITECTURE.md](./ARCHITECTURE.md#cms-integration).
- `packages/types` holds request/response DTO types used by both `apps/web` and `apps/api` to avoid drift between frontend and backend contracts.
- ESLint and TypeScript config were split into their own dedicated packages (`packages/eslint-config`, `packages/tsconfig`) rather than one monolithic `config` package — standard Turborepo convention, and it lets an app extend just what it needs. `packages/config` is left for framework-agnostic runtime config only (e.g. a future shared Tailwind config, once `apps/web` is scaffolded) — see [CODING_STANDARDS.md](./CODING_STANDARDS.md).
- `packages/ui` is the shared frontend component foundation for `apps/web` — empty until Next.js/React are actually configured there. Both areas of `apps/web` (public site and Admin Dashboard) consume it.
- **`apps/web` contains two application areas, not one**: the public site under `app/[locale]/*` and the Admin Dashboard under `app/(admin)/admin/*`. They share the build, the design system, the API client, and `packages/types` — but have separate layouts, separate auth boundaries, and no shared page architecture. A fourth app (`apps/admin`) was rejected because it would duplicate the whole toolchain for a surface that reuses all of it — see [ARCHITECTURE.md](./ARCHITECTURE.md#admin-dashboard).
- Each app has its own `Dockerfile`; `docker-compose.yml` at the root orchestrates `nginx`, `postgres`, and `minio` for local development, with `web`/`api`/`cms` running on the host via `pnpm dev` and available as an opt-in containerized profile (see [DEVOPS.md](./DEVOPS.md#local-development)). `nginx` has no Dockerfile — it runs the official image with the config in `docker/nginx/` bind-mounted, so a routing change never requires an image rebuild.
- **`docker-compose.yml` publishes no host ports.** Compose merges `ports` by appending, so a port declared in the base file could never be withdrawn by an environment-specific override and would follow the stack into production. Publishing therefore belongs to the overrides: `docker-compose.override.yml` (loaded automatically for local development) and the future `docker-compose.prod.yml`.
- `docker/postgres/init/` holds the first-boot script that creates `sam_platform` and `sam_cms` as independent databases and revokes cross-database `CONNECT` ([ADR-002](./ADR/ADR-002-two-databases.md)). The official Postgres image runs it only when the data volume is empty.
- `scripts/` holds operational scripts that are not part of any application — currently `verify-db-isolation.sh`, which asserts the ADR-002 boundary is enforced by PostgreSQL rather than assumed.
- `.env.example` at the root documents the compose-level variables with local-development placeholders. Per-app `.env.example` files arrive with their apps. No `.env` file is ever committed ([SECURITY.md](./SECURITY.md#secrets-management)).
