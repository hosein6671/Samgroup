# SAM Group Platform — AI Project Context

Read this first, in any new session. It's a map, not a manual — every section links to the document that actually holds the detail, so nothing here duplicates what's already written elsewhere.

> **New to this project, or picking it up cold?** Read [`docs/PROJECT_HANDOFF.md`](./docs/PROJECT_HANDOFF.md) — full status, what exists vs. what doesn't, implementation order, frozen decisions, and current blockers.

## What this project is

SAM Group Platform is a custom B2B web platform for the petroleum, lubricants, and petrochemical industry — not a simple company website, a platform meant to grow into a full business system over several years. Full detail: [`docs/PROJECT_VISION.md`](./docs/PROJECT_VISION.md).

## Current phase

**Architecture Frozen. No application code exists yet.** `apps/web`, `apps/api`, `apps/cms`, `docker/`, `scripts/`, `.github/` are empty placeholder directories; there is no git history yet. A Bootstrap Plan exists and was approved, but has not been executed. Live status and milestone tracking: [`docs/ROADMAP.md`](./docs/ROADMAP.md) (see "Current Status" at the top).

## Reading order for `docs/`

1. [`PROJECT_VISION.md`](./docs/PROJECT_VISION.md) — why this project exists, Phase 1 scope, future phases
2. [`ARCHITECTURE.md`](./docs/ARCHITECTURE.md) — architecture style, module boundaries, CMS integration, auth
3. [`TECH_STACK.md`](./docs/TECH_STACK.md) — concrete tools/frameworks (see also [`technology/FRONTEND_STACK.md`](./docs/technology/FRONTEND_STACK.md) for frontend-specific rationale)
4. [`PROJECT_STRUCTURE.md`](./docs/PROJECT_STRUCTURE.md) — monorepo layout
5. [`DATABASE.md`](./docs/DATABASE.md) + [`DATA_MODEL.md`](./docs/DATA_MODEL.md) — entity index and field-level ER model
6. [`API_DESIGN.md`](./docs/API_DESIGN.md) — REST conventions and the single-gateway pattern
7. [`SECURITY.md`](./docs/SECURITY.md) — auth, RBAC matrix, secrets, data protection
8. [`CODING_STANDARDS.md`](./docs/CODING_STANDARDS.md) — naming, folder conventions, git/commit rules
9. [`DEVOPS.md`](./docs/DEVOPS.md) — environments, CI/CD, Postgres database split
10. [`SITE_STRUCTURE.md`](./docs/SITE_STRUCTURE.md) — Phase 1 page/content blueprint (sourced from `docs/content/`)
11. [`ROADMAP.md`](./docs/ROADMAP.md) — milestones and current status
12. [`ADR/`](./docs/ADR/README.md) — why the contested decisions were made, in order

## Frozen architecture — do not change without a new ADR and explicit sign-off

- **Payload CMS** is the only CMS. Never introduce or reference any other CMS (e.g. Sanity).
- **NestJS** is the only backend framework, and the only API surface the frontend calls (ADR-003).
- **Prisma + PostgreSQL**, split into two independent databases (`sam_platform`, `sam_cms`) — see ADR-002. Never merge them or use Payload's experimental `schemaName` option instead.
- **pnpm workspaces + Turborepo** is the monorepo strategy — see ADR-001.

These four are the ones explicitly called out as non-negotiable across this project's history. The full frozen set (folder structure, API strategy, CMS strategy, auth strategy) is confirmed in the Architecture Freeze — see [`ADR/README.md`](./docs/ADR/README.md) for the decision log.

## Behavioral rules for AI assistants working on this repo

See [`AI_CONTEXT.md`](./AI_CONTEXT.md) for workflow conventions, absolute constraints, and known open threads — read it before making any non-trivial change. See [`docs/AI_RULES.md`](./docs/AI_RULES.md) for general coding hygiene rules (these apply once code actually exists).
