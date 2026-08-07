# DevOps

## Local Development

- `docker-compose.yml` runs: `postgres`, `minio`, `api`, `web`, `cms`
- Each app reads config from its own `.env` (see `.env.example` per app in [PROJECT_STRUCTURE.md](./PROJECT_STRUCTURE.md))
- `.env` files are never committed; `.env.example` documents required variables with placeholder values

---

## Postgres Databases

One `postgres` container/server for both apps, but **two independent databases** inside it — not a shared database with separate schemas (see [ARCHITECTURE.md](./ARCHITECTURE.md#cms-integration) for why):

| Database       | Owner   | Used by    | Connection string env var |
| -------------- | ------- | ---------- | ------------------------- |
| `sam_platform` | Prisma  | `apps/api` | `DATABASE_URL` (api)      |
| `sam_cms`      | Payload | `apps/cms` | `DATABASE_URI` (cms)      |

- Both databases are created on container init (e.g. via an init SQL script or `POSTGRES_MULTIPLE_DATABASES`-style entrypoint in `docker-compose.yml`).
- Each app is given credentials/connection string for **only its own database** — the api's database user should not even have login rights to `sam_cms`, and vice versa. This makes the separation a hard boundary, not just a config convention.
- Backups (see below) are taken per database, so `sam_cms` and `sam_platform` can be restored independently.

---

## Environments

| Environment | Purpose                     | Deploy trigger                   |
| ----------- | --------------------------- | -------------------------------- |
| Local       | Development on a machine    | manual (`docker compose up`)     |
| Staging     | Pre-production verification | push/merge to `develop`          |
| Production  | Live platform               | merge to `main`, manual approval |

---

## CI/CD (GitHub Actions)

Three phases, in strict order. Nothing is built into an image until validation passes, and nothing reaches the VPS until an image exists in the registry.

**Only Phase 1 exists today**, as [`.github/workflows/ci.yml`](../.github/workflows/ci.yml). Phases 2 and 3 describe the intended shape — there is no workflow for either yet, and nothing in this repository builds an image or contacts a server.

**Phase 1 — Validate** (every pull request, and every push to `main`) — **implemented**

1. Install dependencies — `pnpm install --frozen-lockfile`, with the pnpm store cached between runs
2. Lint — `pnpm lint`
3. Type-check — `pnpm type-check`
4. Format check — `pnpm format:check`

Two further checks belong in this phase but are **deliberately not wired up yet**:

- **Test** — `pnpm test` (see [TESTING_STRATEGY.md](./TESTING_STRATEGY.md))
- **Build all apps** — `pnpm build`

Both resolve to `turbo run` tasks, and no package in the workspace currently defines a `test` or `build` script — `apps/web`, `apps/api`, and `apps/cms` are still empty placeholders. Adding them now would produce steps that always pass while verifying nothing, which is worse than their absence because it reads as coverage that does not exist. **Add each to Phase 1 at the point the first application package defines that script.**

**Phase 2 — Build images** (on merge to `main`, only if Phase 1 passed) — **not yet implemented**

5. Build one Docker image per deployable app: `web`, `api`, `cms`
6. Tag each by commit SHA, and push to the container registry

**Phase 3 — Deploy to VPS** (only if Phase 2 published images) — **not yet implemented**

7. Connect to the VPS over SSH using a deploy key held in GitHub Actions secrets
8. Pull the new image tags and recreate the affected services via Docker Compose
9. Run health checks; on failure, roll back by redeploying the previous SHA tag

Phases 2 and 3 depend on Dockerfiles and a `docker-compose.yml` that do not exist yet (`docker/` and the root `docker-compose.yml` are still empty placeholders), and on registry/SSH secrets that have not been created. Both remain future work under [ADR-005](./ADR/ADR-005-vps-docker-deployment.md).

Production deploys additionally require the manual approval gate noted under Environments. Staging runs the same three phases from `develop` without that gate.

---

## Deployment Target

**One Linux VPS, running every service in Docker.** There is no external hosting provider for any part of the platform.

- **Orchestration:** Docker Compose, using the same service model as local development with production values for image tags, secrets, and resource limits.
- **Ingress:** Nginx as reverse proxy and TLS termination in front of every HTTP-facing service.
- **Host:** a single VPS for Phase 1 — revisit only if load requires horizontal scaling.

### Services on the host

| Service    | Contents                                                          | Reachable from                                                           |
| ---------- | ----------------------------------------------------------------- | ------------------------------------------------------------------------ |
| `nginx`    | Reverse proxy, TLS termination                                    | public (`:80`, `:443`)                                                   |
| `web`      | Next.js (`apps/web`), including the `/admin` Admin Dashboard area | public, via `nginx`                                                      |
| `api`      | NestJS (`apps/api`) — the only API surface `web` calls (ADR-003)  | public, via `nginx`; the sole client of `cms`                            |
| `cms`      | Payload CMS (`apps/cms`)                                          | admin UI via `nginx`; content read by `api` on the internal network only |
| `postgres` | Both databases — `sam_platform` and `sam_cms` (ADR-002)           | internal network only                                                    |
| `minio`    | S3-compatible object storage                                      | internal network; public reads proxied through `nginx`                   |

Supporting services (Redis, search, queue — see [TECH_STACK.md](./TECH_STACK.md) "Future Technologies") join this same stack if and when a phase actually requires one. None are provisioned speculatively.

Because `web` and `api` are served from a single origin behind `nginx`, browser traffic between them is same-origin and needs no cross-origin CORS configuration.

**Implication for `apps/web`:** running Next.js as a container means it is served by its own Node process rather than a managed platform, so the app is built in standalone output mode and the container serves it directly. This is a build/runtime configuration detail to apply when `apps/web` is scaffolded — it does not change the application architecture.

---

## Monitoring & Backups (Phase 1 minimum)

- Container health checks in `docker-compose.yml`
- Automated nightly Postgres backups, encrypted at rest (see [SECURITY.md](./SECURITY.md))
- Centralized log output from all containers (`docker logs`, or shipped to a log aggregator once traffic justifies it)
