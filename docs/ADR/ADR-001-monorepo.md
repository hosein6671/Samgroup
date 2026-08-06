# ADR-001: Monorepo with pnpm Workspaces + Turborepo

## Status

Accepted

## Context

The platform is made of three deployable applications — `web` (Next.js), `api` (NestJS), and `cms` (Payload) — plus shared code (DTO types, lint/TS config) that all three need to stay in sync. `TECH_STACK.md` originally named the frontend/backend/CMS stack but specified no package manager or repository layout at all, and no tool for running/building the three apps together.

Options considered:

- **Multiple repositories** (one per app) — clean deploy isolation, but shared types drift immediately since there's no single place to define a DTO once and have both `web` and `api` import it. Cross-app changes (e.g. a new API field) require coordinated PRs across repos.
- **Single repo, no workspace tooling (plain folders)** — simplest to start, but no dependency hoisting, no shared package linking, no build caching; CI rebuilds everything on every change.
- **Monorepo with pnpm workspaces + Turborepo** — one repo, apps and shared packages linked via workspace protocol, Turborepo caches and parallelizes builds/tests per package.
- **Monorepo with Nx** — same benefits as Turborepo plus code-gen and a dependency graph UI, but a heavier tool with a steeper learning curve for a project this size.

## Decision

Use a single monorepo, with **pnpm workspaces** for dependency management and **Turborepo** for build/task orchestration and caching.

Layout, package boundaries, and rationale for what lives where are detailed in [PROJECT_STRUCTURE.md](../PROJECT_STRUCTURE.md).

## Consequences

**Positive**

- Shared types (`packages/types`) and shared config (`packages/config`, `packages/eslint-config`, `packages/tsconfig`) are defined once and consumed by all three apps — no drift between frontend and backend contracts.
- Turborepo caches unaffected packages/apps, so CI only rebuilds/retests what actually changed.
- One PR can span a backend change and its corresponding frontend change atomically.

**Negative**

- All three apps' history lives in one repo — a bad commit or lockfile issue can block work across apps at once.
- Slightly higher initial setup cost (workspace config, `turbo.json` pipeline) versus three independent repos.

## Alternatives Considered

Nx was the closest runner-up; deferred because its task graph and generators solve problems (large multi-team monorepos, heavy code-gen needs) this project doesn't have yet. Revisit if the number of apps/packages grows significantly or a dedicated platform team forms.
