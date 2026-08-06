# DevOps

## Local Development

- `docker-compose.yml` runs: `postgres`, `minio`, `api`, `web`, `cms`
- Each app reads config from its own `.env` (see `.env.example` per app in [PROJECT_STRUCTURE.md](./PROJECT_STRUCTURE.md))
- `.env` files are never committed; `.env.example` documents required variables with placeholder values

---

## Postgres Databases

One `postgres` container/server for both apps, but **two independent databases** inside it — not a shared database with separate schemas (see [ARCHITECTURE.md](./ARCHITECTURE.md#cms-integration) for why):

| Database | Owner | Used by | Connection string env var |
|---|---|---|---|
| `sam_platform` | Prisma | `apps/api` | `DATABASE_URL` (api) |
| `sam_cms` | Payload | `apps/cms` | `DATABASE_URI` (cms) |

- Both databases are created on container init (e.g. via an init SQL script or `POSTGRES_MULTIPLE_DATABASES`-style entrypoint in `docker-compose.yml`).
- Each app is given credentials/connection string for **only its own database** — the api's database user should not even have login rights to `sam_cms`, and vice versa. This makes the separation a hard boundary, not just a config convention.
- Backups (see below) are taken per database, so `sam_cms` and `sam_platform` can be restored independently.

---

## Environments

| Environment | Purpose | Deploy trigger |
|---|---|---|
| Local | Development on a machine | manual (`docker compose up`) |
| Staging | Pre-production verification | push/merge to `develop` |
| Production | Live platform | merge to `main`, manual approval |

---

## CI/CD (GitHub Actions)

On every pull request:

1. Install dependencies (pnpm, cached via Turborepo)
2. Lint (ESLint)
3. Type-check (`tsc --noEmit`)
4. Run tests (see [TESTING_STRATEGY.md](./TESTING_STRATEGY.md))
5. Build all apps

On merge to `main`:

6. Build Docker images per app
7. Push images to the registry
8. Deploy to the Linux VPS via SSH/Docker Compose pull + restart

---

## Deployment Target

- Docker containers behind Nginx (reverse proxy + TLS termination)
- Linux VPS (single host for Phase 1; revisit if load requires horizontal scaling)

---

## Monitoring & Backups (Phase 1 minimum)

- Container health checks in `docker-compose.yml`
- Automated nightly Postgres backups, encrypted at rest (see [SECURITY.md](./SECURITY.md))
- Centralized log output from all containers (`docker logs`, or shipped to a log aggregator once traffic justifies it)
