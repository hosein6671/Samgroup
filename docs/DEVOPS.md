# DevOps

## Local Development

**Infrastructure runs in Docker; the applications run on the host** via `pnpm dev` (Turborepo). Rebuilding an image on every code change is not a workable inner loop, so containers cover only what is awkward to run locally.

- **In Docker:** `postgres`, `minio`, `nginx`
- **On the host:** `web`, `api`, `cms` — through `pnpm dev`
- **Full-stack profile:** an opt-in Compose profile runs every service containerized, for verifying production parity before a release rather than for daily work

`nginx` runs locally as well as in production so that both environments serve everything from **one origin**. This matters more than it appears: the refresh token is an httpOnly cookie, so a dev setup reaching `web` and `api` on different ports would exercise different cookie and CORS behaviour than production, and would hide that entire class of bug until deployment.

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

## Object storage (MinIO)

Media never lives in a database or on a container volume belonging to an app — it lives in S3-compatible object storage, split across **two buckets with different access policies**. One bucket would not be sufficient, because the platform stores objects at two very different sensitivity levels.

| Bucket        | Contents                                                                 | Anonymous access                    | Served how                                                     |
| ------------- | ------------------------------------------------------------------------ | ----------------------------------- | -------------------------------------------------------------- |
| `sam-public`  | Product imagery, published documents, other freely readable media        | `download` — public read            | Proxied and cached by Nginx at `/media/*`                      |
| `sam-private` | **CVs** (`JobApplication.cvMediaId`), confidential formulation documents | `none` — no anonymous access at all | Short-lived presigned URLs issued by NestJS; **never proxied** |

The split implements [SECURITY.md](./SECURITY.md#data-protection) directly: CV files are the most sensitive assets in object storage and must be "always access-controlled, never served from a public/guessable URL, and readable only by Admin". A single bucket with per-object policies would make that a per-upload decision, and the failure mode of forgetting is silent public exposure. Two buckets make the default safe: anything written to `sam-private` is unreachable without a signed URL, regardless of how it got there.

Nginx only ever proxies `sam-public`. The private bucket has no route — reaching it requires a presigned URL from the API, which is where RBAC is enforced. Both buckets and both policies are created by the `minio-init` one-shot service in `docker-compose.yml`.

**Payload editorial media writes to `sam-public` under a `cms/` key prefix**, via `@payloadcms/storage-s3`. A third bucket was deliberately not created: the split above is by _sensitivity_, not by owner, and editorial images on public pages are public content. The prefix gives CMS objects their own namespace without adding an access policy to reason about. `apps/cms` **refuses at config-build time** to accept a bucket whose name contains `private`, so the collection cannot be pointed at CV storage by a mistyped variable. Public URLs are `/media/cms/<file>` — the `/media/*` route above, which is why no absolute URL or object-store endpoint is ever stored in `sam_cms` and why replacing MinIO needs no data migration.

**`apps/web` also proxies `/media/*` itself, for exactly one internal consumer.** A real browser never uses this: nginx's `location /media/` block above still intercepts and proxies straight to MinIO first, and that is unchanged. The consumer is `next/image`'s built-in optimizer, which — given a relative `src` — performs its own fetch from inside the `web` server process against `web`'s own origin, never through nginx. `web` had no route for `/media/*` at all, so that self-fetch always failed; confirmed directly against production on 18 September 2026, the same object 200'd on `/media/...` and 400'd ("requested resource isn't a valid image") through `/_next/image`. `apps/web/src/app/media/[...path]/route.ts` closes that gap by proxying to MinIO the same way nginx does, reachable from `web`'s own process, reading `MEDIA_PROXY_ENDPOINT`/`MEDIA_PROXY_BUCKET` from `process.env` at request time. Both env vars are set on the `web` service in `docker-compose.prod.yml`; no network change was needed, since `web` and `minio` already share the `edge` network.

**Development note.** MinIO's S3 API port is published to `127.0.0.1:9000` in `docker-compose.override.yml`, because `apps/cms` runs on the host under `pnpm dev` ([ADR-005](./ADR/ADR-005-vps-docker-deployment.md), approved implementation decision 4) and a host process cannot reach an unpublished container port. Unlike postgres this needed no companion network — minio already joins `edge`, a normal bridge with a route to the host. The binding is development-only: production does not load that file, and nginx reaches MinIO over the internal network as before.

> **Upstream status — decision owed before production.** MinIO's repository was archived on 25 April 2026, and the community edition is now distributed as source only, with no further pre-compiled binaries or official container images. The stack is pinned to the last published tags (`minio/minio:RELEASE.2025-09-07T16-13-09Z`, `minio/mc:RELEASE.2025-08-13T08-35-41Z`), which is correct for local development but means **no security updates**. Before production, choose one: build MinIO from source and self-maintain the image, move to the commercial successor, or adopt a different S3-compatible store. The last option would change a `TECH_STACK.md` entry and needs its own ADR — though the blast radius is contained, because [ARCHITECTURE.md](./ARCHITECTURE.md#storage) commits to "an S3-compatible object store", not to MinIO's API specifically.

---

## Environments

| Environment | Purpose                  | Deploy trigger                   |
| ----------- | ------------------------ | -------------------------------- |
| Local       | Development on a machine | manual (`docker compose up`)     |
| Production  | Live platform            | merge to `main`, manual approval |

**There is no staging environment and no second host.** One VPS will run the whole platform: `samgp.com` and `cms.samgp.com` will both resolve to it and be served by the same Docker Compose stack (`nginx`, `web`, `api`, `cms`, `postgres`, `minio`). That VPS does not exist yet — see the status note under [Deployment Target](#deployment-target). Introducing a staging environment later requires a new architecture decision — see [ADR-005](./ADR/ADR-005-vps-docker-deployment.md), approved implementation decision 6.

---

## CI/CD (GitHub Actions)

Three phases, in strict order. Nothing is built into an image until validation passes, and nothing reaches the VPS until an image exists in the registry.

**Phases 1 and 2 exist and run automatically; Phase 3 as originally envisioned below does not.** This paragraph previously said only Phase 1 existed — stale as of at least 18 September 2026, verified directly against this repository and against a live deploy this session: [`.github/workflows/ci.yml`](../.github/workflows/ci.yml) (Phase 1) and [`.github/workflows/release-images.yml`](../.github/workflows/release-images.yml) (Phase 2) both exist, and three Dockerfiles — `docker/apps/api.Dockerfile`, `docker/apps/web.Dockerfile`, `docker/apps/cms.Dockerfile` — build the images Phase 2 pushes. What genuinely does not exist is an automated Phase 3: no workflow connects to the VPS over SSH. **Deployment is a manual step**, described in its own subsection below.

**Phase 1 — Validate** (every pull request, and every push to `main`) — **implemented, and complete as of 30 August 2026**

**Two jobs, run in parallel.** They need different things, and separating them keeps the cheap checks fast: a lint error and a failing test are independent facts, and a contributor should see both from one push rather than one per push.

**Job `validate`** — static checks. No services, no database, and the job that fails first on the ordinary mistake.

1. Install dependencies — `pnpm install --frozen-lockfile`, with the pnpm store cached between runs
2. Lint — `pnpm lint`
3. Type-check — `pnpm type-check`
4. Format check — `pnpm format:check`

**Job `verify`** — the two checks this section previously listed as "deliberately not wired up yet". That note gave a **condition** rather than a preference — _"add each to Phase 1 at the point the first application package defines that script"_ — and `apps/web`, `apps/api` and `apps/cms` now all define both `test` and `build`, so the condition is met. Until this job existed, roughly **3,100 tests protected nothing on a pull request**.

5. Create the CMS database — the platform has two databases and keeps them apart by credential rather than by convention ([ADR-002](./ADR/ADR-002-two-databases.md)). The service container creates `sam_platform`; `sam_cms` is created here so the CMS build has the database its URI names. Payload migrates `sam_cms` itself — nothing in `prisma/` may ever touch it
6. Apply migrations — `prisma migrate deploy`. **Never `migrate dev` and never `db push`**: both can invent a migration, and the committed history is the thing under test
7. Seed the locale set — `prisma/seed.ts`. Locale rows are a hard prerequisite rather than a convenience, and step 9 reads them back through the API
8. Test — `pnpm test` (see [TESTING_STRATEGY.md](./TESTING_STRATEGY.md))
9. Start the API from its build output, then build all apps — `pnpm build`

**Why `verify` needs PostgreSQL and a running API.** `pnpm build` cannot run without a live API, and that is **by design rather than an accident to work around**: `generateStaticParams` for `apps/web`'s `[locale]` segment reads `GET /locales`, the sole routing locale source, and has **no fallback** — a build that cannot establish which locales exist must fail rather than silently emit a different site ([PROJECT_HANDOFF.md](./PROJECT_HANDOFF.md) §6.9, and the note in `apps/web/.env.example`). Measured on 30 August 2026: with a clean `.next` and no API running, `next build` fails at "Collecting page data" with `LocaleSourceError … ECONNREFUSED`. So CI runs the real thing — a real PostgreSQL, the real migrations, the real seed and the real API — because anything less would verify a build that cannot happen. **This job is also the only place the repository's buildability is checked at all**; before it, that was known only on a developer's machine.

**The credentials in the workflow are not secrets, and no repository secret is used.** `JWT_SECRET`, `PAYLOAD_SECRET` and the media keys are literals in the YAML: the databases are created and destroyed inside one job and are reachable from nothing else, and the values exist only to satisfy boot-time validators — `JWT_SECRET` has a 32-character minimum, and `apps/cms` validates six variables at config-build time and refuses a `DATABASE_URI` that does not name `sam_cms`. Phase 1 needs no secret and none should be added to it; secrets belong to Phases 2 and 3.

**Six suites skip in CI, and the reason is more than a missing variable.** The catalog integration suites — **6 of `apps/api`'s 91 suites** — build a disposable database from a template and self-skip unless `CATALOG_APPLY_TEST_ADMIN_URL` is set. Supplying that variable is necessary and **not sufficient**; measured on 31 August 2026, each of them needs all of:

1. **`--experimental-vm-modules`.** `@prisma/adapter-pg` performs a dynamic import, which Jest's default CommonJS VM cannot service — every test in these suites fails with _"A dynamic import callback was invoked without --experimental-vm-modules"_ before it reaches the database. The `test` script now sets it (see `apps/api/jest.config.js`), so this half is closed.
2. **A PostgreSQL superuser** that may `CREATE DATABASE … TEMPLATE`, supplied as `CATALOG_APPLY_TEST_ADMIN_URL`. The application role cannot do it.
3. **The right template.** `CATALOG_APPLY_TEST_TEMPLATE` defaults to `sam_platform`, which suits the review suites — they expect the imported catalogue. The incremental-patch suite expects the opposite: a database on which the coolant normalization patch has **not** been applied. Against the live `sam_platform` it reads `ALREADY_APPLIED` and fails, correctly — that patch shipped in `bc4e282`. It needs the retained pre-patch backup as its template.
4. **`CATALOG_WORKBOOK`** for the importer suites, a spreadsheet that is not committed to this repository.

With items 1–2 satisfied and `CATALOG_APPLY_TEST_TEMPLATE=sam_platform`, **88 of 91 suites and 1,839 tests run** locally — 116 more tests than before — and only the incremental-patch suite fails, on item 3. Wiring this into CI therefore needs a migrated template, a decision about which template each suite gets, and a home for the workbook; it is deliberately out of scope for Phase 1 as it stands, and these suites skip in CI exactly as they skip on a developer machine with no database configured.

**Phase 2 — Build images** (on merge to `main`, only if Phase 1 passed) — **implemented**, as [`release-images.yml`](../.github/workflows/release-images.yml), triggered by `workflow_run` once CI succeeds on `main`

10. Build one Docker image per deployable app — `api`, `web`, `cms` — from `docker/apps/{api,web,cms}.Dockerfile`, each with its own GitHub Actions cache scope
11. Tag each by the commit SHA CI validated (`github.event.workflow_run.head_sha`, not simply the latest `main`), and push to **GitHub Container Registry (GHCR)** at `ghcr.io/<owner>/sam-group-platform/{api,web,cms}` — authenticated with the workflow's own built-in `GITHUB_TOKEN`, so no additional registry vendor or secret is involved

The Web image's build boots a real API against a real, migrated, seeded Postgres inside the same job first (mirroring Phase 1's `verify` job, for the reason given there: `generateStaticParams` needs a live locale source), then builds with `network: host` so the build process can reach it on `127.0.0.1`.

**Deploy to the VPS — implemented, but manual rather than a CI phase.** No workflow connects to the VPS over SSH, and none is planned as far as this document records; the original Phase 3 sketch (steps 12–14 below, kept as the historical record of what was once planned) describes a shape that was never built and was superseded by a different, working mechanism instead:

12. ~~Connect to the VPS over SSH using a deploy key held in GitHub Actions secrets~~ — instead, a person with SSH access to the VPS runs the deploy themselves
13. ~~Pull the new image tags and recreate the affected services via Docker Compose~~ — `cd /opt/sam-group-platform && set -a; . ./.env; set +a && ./deploy/deploy.sh <sha>` does this: `deploy/backup.sh` dumps both databases and the MinIO data directory first, then `deploy/compose.sh` (`docker compose --env-file .env -f docker-compose.yml -f docker-compose.prod.yml`) pulls `api`/`web`/`cms` at the given tag, runs the Prisma and Payload migration containers, and brings the stack up with `--wait`
14. Run health checks; on failure, roll back by redeploying the previous SHA tag — `deploy.sh` itself does the first half (`--wait --wait-timeout 180` against each service's compose healthcheck; a failure re-deploys the prior tag automatically), and `deploy/rollback.sh` exists for a manual rollback after the fact

**`/opt/sam-group-platform` on the VPS is not a git checkout**, and `deploy.sh` does not sync `docker-compose.yml` / `docker-compose.prod.yml` / `.env` from this repository — see the callout under [Deployment Target](#deployment-target) below for what that means for a compose-file change.

Production deploys additionally require the manual approval gate noted under Environments — in practice, the same manual step as running `deploy.sh` itself, since nothing currently triggers it automatically.

---

## Deployment Target

> **Status, 18 September 2026 — the VPS exists and the platform runs on it.** This section previously said "the VPS is a future production target, not an existing environment" and that its acquisition was deferred until the application was complete; that is stale, corrected here rather than left standing because the gap is a plain fact rather than an architecture question. A server is provisioned and reachable over SSH, and `deploy/deploy.sh` has been run against it successfully — `nginx`, `postgres`, `minio`, `api`, `web` and `cms` all report healthy after a deploy. Hosting provider, machine sizing and provisioning method were decided by the project owner, outside any AI session, exactly as [ADR-005](./ADR/ADR-005-vps-docker-deployment.md)'s own approved-implementation-decision framing required — nothing here was chosen or assumed by an assistant. Everything below now describes a running deployment, not a future one; **one open item remains for the record**: whether the VPS's own copy of the repository's deploy-relevant files (`docker-compose.yml`, `docker-compose.prod.yml`, `.env`, `deploy/`) is kept in sync with git by some process not documented here, or is maintained by hand — see the callout further down about `/opt/sam-group-platform` not being a git checkout, which was true when checked directly on 18 September 2026.

**One Linux VPS will run every service in Docker.** There is no external hosting provider for any part of the platform.

- **Orchestration:** Docker Compose, using the same service model as local development with production values for image tags, secrets, and resource limits.
- **Ingress:** Nginx as reverse proxy and TLS termination in front of every HTTP-facing service.
- **Host:** a single VPS for Phase 1 — revisit only if load requires horizontal scaling.

### Services on the host

| Service    | Contents                                                                                         | Reachable from                                                                             |
| ---------- | ------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------ |
| `nginx`    | Reverse proxy, TLS termination — official image, configuration bind-mounted from `docker/nginx/` | public (`:80`, `:443`)                                                                     |
| `web`      | Next.js (`apps/web`), including the `/admin` Admin Dashboard area                                | public, via `nginx`                                                                        |
| `api`      | NestJS (`apps/api`) — the only API surface `web` calls (ADR-003)                                 | public, via `nginx`; the sole client of `cms`                                              |
| `cms`      | Payload CMS (`apps/cms`) — itself a Next.js application                                          | admin UI at `cms.<domain>` via `nginx`; content read by `api` on the internal network only |
| `postgres` | Both databases — `sam_platform` and `sam_cms` (ADR-002)                                          | internal network only                                                                      |
| `minio`    | S3-compatible object storage                                                                     | internal network; public reads proxied through `nginx`                                     |

Supporting services (Redis, search, queue — see [TECH_STACK.md](./TECH_STACK.md) "Future Technologies") join this same stack if and when a phase actually requires one. None are provisioned speculatively.

Because `web` and `api` are served from a single origin behind `nginx`, browser traffic between them is same-origin and needs no cross-origin CORS configuration.

### Public routing

Nginx is the single entry point. Everything below is served over HTTPS; port 80 redirects to 443.

| Host / path        | Upstream                                              |
| ------------------ | ----------------------------------------------------- |
| `<domain>/`        | `web` — public site                                   |
| `<domain>/api/*`   | `api` — same origin as `web`, so no CORS between them |
| `<domain>/admin/*` | `web` — the Admin Dashboard area                      |
| `<domain>/media/*` | `minio`, public bucket only, cached                   |
| `cms.<domain>`     | `cms` — Payload's admin UI                            |

Payload's admin UI gets its **own subdomain** because Payload's admin route also defaults to `/admin`, which would collide with the Admin Dashboard that `apps/web` already serves there. The split also keeps the two admin surfaces in separate cookie scopes. See [ADR-005](./ADR/ADR-005-vps-docker-deployment.md).

**Implication for `apps/web`:** running Next.js as a container means it is served by its own Node process rather than a managed platform, so the app is built in standalone output mode and the container serves it directly. It does not change the application architecture. The same applies to `apps/cms`: Payload runs fully inside Next.js, so the CMS container has the same standalone runtime shape as `web`, not a separate Node server.

**Done, as of at least 18 September 2026.** This line previously recorded, dated 30 August 2026, that neither config set `output: "standalone"` yet — stale, superseded by writing the application Dockerfiles: both `apps/web/next.config.ts` and `apps/cms/next.config.ts` now set it (verified directly against both files), and both are what `docker/apps/web.Dockerfile` and `docker/apps/cms.Dockerfile` build from.

**Deploys accept brief downtime.** `docker compose up -d` recreates changed containers rather than draining connections, so an updated service has a short gap. Zero-downtime would require blue/green or rolling deployment, which a single Compose host does not provide natively — accepted for Phase 1 under [ADR-005](./ADR/ADR-005-vps-docker-deployment.md).

> **`/opt/sam-group-platform` on the VPS is not a git checkout, and `deploy.sh` does not make it one.** Confirmed directly on 18 September 2026: `git status` run inside that directory answers `fatal: not a git repository`. `deploy.sh` pulls the three application images by tag and recreates containers from whatever `docker-compose.yml` / `docker-compose.prod.yml` / `.env` already sit on disk there — it does not fetch, diff, or sync those files against this repository. **A compose-file change therefore ships inside the built image but has no effect in production until the same edit is also applied to the VPS's own copy of the file, by hand.** This was not hypothetical: the `MEDIA_PROXY_ENDPOINT`/`MEDIA_PROXY_BUCKET` variables added to the `web` service above were merged, released and deployed, and `/_next/image` kept failing on production until the VPS's `docker-compose.prod.yml` was patched separately (by hand, over the existing SSH session) and `web` was recreated a second time. There is no tooling that closes this gap today, and none should be assumed — a future compose-file change needs this step called out explicitly, every time, until it is fixed.

---

## Application authentication

`apps/api` issues the platform's access tokens, and that adds exactly one runtime variable — process-scoped and injected at deploy time like every other secret:

| Variable     | Meaning                                                                                                                                                                                                                                                                                |
| ------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `JWT_SECRET` | The HMAC key access tokens are signed and verified with. **Required** — the process refuses to boot without one of at least 32 characters. A real secret: never committed, never logged, never quoted in an error. Generate it (`openssl rand -base64 48`); do not compose it by hand. |

**It is the one required variable this section adds, and it is required on purpose.** Everything else optional in this document degrades a single capability when unset; an identity system with no signing key does not degrade, it forges. Generating one per boot would log every user out on each restart, and shipping a default would put a working Admin-token key in the repository.

**Per environment, never shared.** Rotating it invalidates every token already issued — a 15-minute inconvenience, since that is how long a session lasts. There is no key-id or overlap mechanism and none is needed at that lifetime.

**The token lifetime is not a variable.** It is frozen at 15 minutes by [SECURITY.md](./SECURITY.md#authentication) and [API_CONTRACT_FINAL.md](./API_CONTRACT_FINAL.md) §7 and lives as a constant in code, for the reason `apps/cms` keeps its locale list out of the environment: a variable that can override a frozen decision means it is not frozen.

**Payload's admin authentication is separate and configured separately** ([ADR-006](./ADR/ADR-006-payload-admin-authentication.md)). `PAYLOAD_API_KEY` is a _service_ credential for the Content module's server-to-server hop, not a user identity, and no value above is shared with `apps/cms`.

**The first Admin account is created outside the request path**, by an explicitly armed seed (`pnpm seed:admin`, `SAM_ALLOW_ADMIN_BOOTSTRAP=true`) that has no committed credential and refuses to run against any database but `sam_platform` — see [SECURITY.md](./SECURITY.md#admin-bootstrap). **Whether production bootstraps this way is an operational decision that has not been taken**, and belongs with the VPS work below.

### The Admin browser cookies depend on `NODE_ENV`, and on HTTPS

`apps/web` owns two browser cookies for the Admin surface, `sam_admin_refresh` and `sam_admin_access` (attributes in [SECURITY.md](./SECURITY.md#admin-dashboard-access)). One property is operational rather than architectural and belongs here:

**`Secure` is set whenever `NODE_ENV === "production"`, and dropped otherwise.** `next build` and `next start` both set `NODE_ENV=production`, so any deployed container issues `Secure` cookies — which a browser will only store over HTTPS. That is correct behind nginx with TLS terminated at the edge (ADR-005), and it means **an Admin surface served over plain HTTP cannot hold a session at all**: the browser silently discards both cookies and every sign-in appears to fail. If the Admin area ever seems to reject correct credentials in a deployed environment, check TLS before checking the credentials.

**It is deliberately not derived from the request.** Neither the protocol nor `X-Forwarded-Proto` decides it: a header a client controls must not decide whether a credential is transport-protected, and behind nginx the inner hop is plain HTTP anyway, so protocol sniffing would drop `Secure` in production — the exact failure this avoids. The only environment that legitimately runs without `Secure` is a local `next dev` over `http://localhost`.

**No new variable.** This section still adds exactly one, `JWT_SECRET`; the cookies read `NODE_ENV`, which the runtime already sets.

---

## Outbound Email (SMTP)

`apps/api` submits one internal notification per persisted lead to an SMTP relay. **This project runs no mail server and adds no Compose service for mail** — outbound submission to a relay the client supplies is the whole of it.

Runtime configuration, process-scoped and injected at deploy time like every other secret:

| Variable                      | Meaning                                                                                                                          |
| ----------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `SMTP_HOST`                   | Relay hostname.                                                                                                                  |
| `SMTP_PORT`                   | 587 (STARTTLS submission), 465 (implicit TLS), or 25 (internal relay).                                                           |
| `SMTP_USER` / `SMTP_PASSWORD` | Both or neither — half a pair is treated as unconfigured rather than attempted. `SMTP_PASSWORD` is a secret and is never logged. |
| `SMTP_SECURE`                 | Exactly `true` or `false`. `true` pairs with port 465.                                                                           |
| `MAIL_FROM`                   | The `From` header. Must be an address the relay is authorised to send as.                                                        |
| `LEAD_NOTIFICATION_TO`        | The single internal mailbox notifications are delivered to.                                                                      |

**All of them are optional, and the group degrades as one.** With any of `SMTP_HOST`, `SMTP_PORT`, `MAIL_FROM` or `LEAD_NOTIFICATION_TO` missing, the API still boots and every form still validates, persists and answers `201`; the notification is skipped and the names of the missing variables are logged. The same holds when the relay is down, rejects the credential or stalls — **a lead is never lost to a mail failure**, because the row is committed before the attempt is made.

**Operational notes:**

- A mail attempt is bounded at **5 seconds total**, so an unreachable relay adds up to ~5 s to a form submission's response and never more (measured: 5.09 s against a relay that accepts the connection and then stalls). Any reverse-proxy read timeout in front of `apps/api` must exceed that; the Nginx templates in `docker/` set no `proxy_read_timeout`, so the 60 s default applies and leaves ample margin.
- **No retries, no queue, and no delivery state in the database.** A failed notification is one `ERROR` log line carrying the submission id, the notification kind, `mechanism=smtp` and the error class/code — enough to find the lead in `sam_platform`, which still holds it. Alerting on that line is the recovery mechanism, and a durable retry or delivery audit would need both a queue and schema, so it is a separate architecture gate.
- Outbound egress on the relay's port must be open from the application container. No inbound mail port is needed and none is opened.
- **The production mailbox, relay and credential do not exist yet** and are the client's to supply. Until they do, every deployment runs with the notification skipped — a supported state, not a broken one.

---

## Anti-spam (Cloudflare Turnstile)

The two public write endpoints — `POST /inquiries` and `POST /custom-formulation-requests` — carry an **invisible** challenge in front of the rate limit, as [SITE_STRUCTURE.md](./SITE_STRUCTURE.md) §10 requires. Verification happens in `apps/api`, not in `apps/web`: the endpoints are public and unauthenticated, so a check that ran only inside a Next.js Server Action would protect the form and leave the endpoint open to anyone posting to it directly.

**This is the only third-party request any public page makes.** Web fonts are self-hosted through `next/font` precisely so no page contacts a CDN, and the Turnstile script on the two form pages is the single deliberate exception. It has a privacy consequence: the Privacy Policy must name Cloudflare as a processor before it is published.

| Variable                         | App        | Meaning                                                                                     |
| -------------------------------- | ---------- | ------------------------------------------------------------------------------------------- |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | `apps/web` | The **public** site key, rendered in the browser. `NEXT_PUBLIC_` is correct and required.   |
| `TURNSTILE_SECRET_KEY`           | `apps/api` | The **secret** key. Never logged, never returned by an endpoint, never in an error message. |

**Configure both or neither.** The two halves are independent variables and either can be missing, so the four states are worth stating:

| Site key | Secret | Result                                                                  |
| -------- | ------ | ----------------------------------------------------------------------- |
| set      | set    | The challenge runs and is verified.                                     |
| unset    | unset  | No challenge; rate limiting alone. The API warns once at startup.       |
| set      | unset  | A widget nobody verifies — a false sense of protection.                 |
| unset    | set    | No token is ever produced, so **every submission is refused with 403**. |

**The widget's mode is dashboard configuration, not application configuration.** A Turnstile widget's mode belongs to the site key, so the key must be created in a mode that presents no challenge to ordinary visitors — "Managed" combined with the `interaction-only` appearance the application sets, or "Invisible". Add `samgp.com` and any preview hostname to the key's allowed domains.

**Operational notes:**

- A verification attempt is bounded at **5 seconds**, and unlike the mail attempt it sits **in front of** the write, so it is latency a submitter waits through.
- **A Cloudflare outage accepts the submission rather than losing it.** An unreachable endpoint, a timeout, a non-2xx answer and Cloudflare's own `internal-error` all resolve to "accepted, logged at error level". A missing or genuinely invalid token is still refused. The trade is deliberate and narrow: an attacker cannot cause the outage state, and losing real leads to a third party's incident is the larger failure — the same rule the SMTP notification and the consent revision already follow.
- Nothing about the submitter is sent to Cloudflare beyond the token. The remote IP is deliberately **not** forwarded, because `trust proxy` is unconfigured and `req.ip` behind nginx is the proxy's address.
- **The production keys and the Cloudflare data processing addendum do not exist yet** and are the client's to supply. Until they do, every deployment runs with the challenge skipped — a supported state, not a broken one.

---

## Public site configuration (`apps/web`)

Two variables govern what the public site says about itself. Both are optional and both default to the safe value, so a deployment that sets neither behaves exactly as the platform has since locale routing shipped.

| Variable            | Default             | Meaning                                                                                                                                                 |
| ------------------- | ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `SITE_PUBLIC_URL`   | `https://samgp.com` | The public origin every absolute URL is built from — canonical tags, `hreflang`, Open Graph URLs, JSON-LD `@id` values, `robots.txt` and `sitemap.xml`. |
| `SITE_SEO_INDEXING` | unset (closed)      | The pre-launch indexing gate. Read by **both** the `robots` meta on every canonical page and by `/robots.txt`, so the two cannot contradict each other. |

**`SITE_PUBLIC_URL` is not `NEXT_PUBLIC_`**, deliberately: every consumer is server-side, and the origin is already visible in the page's own canonical tag. It is the only origin literal left in `apps/web` — the frozen domain lives in `src/features/seo/site.ts` and nowhere else. An unset, empty, malformed or non-http(s) value falls back to the frozen domain rather than failing a build.

**`SITE_SEO_INDEXING` opens the site only for the exact string `true`.** `1`, `yes` and `TRUE` all leave it closed, deliberately — the failure that matters is opening the site by accident. Unset means `noindex, nofollow` on every canonical page and `Disallow: /` in `robots.txt`.

**Do not set it to `true` before the launch checklist is cleared.** At the time of writing that list includes approved Privacy Policy content, product descriptions (the 100 catalog rows carry none), and reviewed `fa`/`ar` copy — the structural pages are code-owned English in all three locales, which is why `hreflang` is withheld and why the sitemap submits the default locale only.

**Payload's admin at `cms.samgp.com` is not covered by `robots.txt`.** It is a different host, so `apps/web`'s `robots.txt` does not govern it; it is kept out of the index with an `X-Robots-Tag` at the nginx layer ([SEO_ARCHITECTURE.md](./seo/SEO_ARCHITECTURE.md) §4). **That header is not yet configured in `docker/nginx/`** and is an outstanding production requirement.

---

## Monitoring & Backups (Phase 1 minimum)

- Container health checks in `docker-compose.yml`
- Automated nightly Postgres backups, encrypted at rest (see [SECURITY.md](./SECURITY.md))
- Centralized log output from all containers (`docker logs`, or shipped to a log aggregator once traffic justifies it)
