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
│   └── nginx/          # Nginx site config, bind-mounted into the official image
├── docker-compose.yml
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
