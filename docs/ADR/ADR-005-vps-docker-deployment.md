# ADR-005: VPS-Only Deployment with Docker

## Status

Accepted, 7 August 2026 (supersedes the split-hosting proposal recorded in `TECH_STACK.md` and `technology/FRONTEND_STACK.md`)

## Context

`ARCHITECTURE.md` and `DEVOPS.md` described, from the beginning, a single undifferentiated deployment: Docker containers behind Nginx on one Linux VPS, covering all three apps plus PostgreSQL.

When the frontend stack was finalized separately, **Vercel** was proposed for `apps/web` on the strength of genuine advantages — it is first-party hosting for Next.js, with automatic per-PR preview deployments, a global edge network, and image optimization tuned for the framework this project had already committed to. That produced a **split-hosting model**: `apps/web` on Vercel, `apps/api`/`apps/cms`/PostgreSQL on the VPS.

The split was recorded in `TECH_STACK.md` and `technology/FRONTEND_STACK.md` but never reconciled into `ARCHITECTURE.md`/`DEVOPS.md`, which continued to describe single-target VPS deployment. The contradiction was tracked as an open thread in [`/AI_CONTEXT.md`](../../AI_CONTEXT.md) and as blocker 5 in [PROJECT_HANDOFF.md](../PROJECT_HANDOFF.md), with the explicit instruction not to treat either document as authoritative on deployment topology until resolved. Three questions stayed open the whole time:

- **Cross-origin configuration.** A Vercel-hosted `web` calling a VPS-hosted `api` is cross-origin, requiring CORS policy maintained across staging and production as environments multiply.
- **Two of everything.** Two vendors, two secret stores (Vercel dashboard vs. VPS environment), two deployment mechanisms, two places to look when something breaks.
- **The VPS is required regardless.** PostgreSQL ×2 (ADR-002), MinIO, `apps/api`, and `apps/cms` all need the host and the Compose stack no matter what. Vercel would add a second system without removing the first.

This ADR resolves that thread.

## Decision

**The entire platform deploys to a single Linux VPS, as Docker containers orchestrated by Docker Compose behind Nginx. No part of the platform is hosted on an external provider, and `apps/web` is not deployed to Vercel.**

The stack on the host is `nginx`, `web`, `api`, `cms`, `postgres`, and `minio`; supporting services join it only when a phase actually requires one. Nginx terminates TLS and reverse-proxies every HTTP-facing service. `postgres` and `minio` are reachable only on the internal Docker network. Full service table, environments, and the three-phase CI/CD flow: [DEVOPS.md](../DEVOPS.md#deployment-target).

### Approved implementation decisions

Confirmed 7 August 2026, from the design review held before the first Dockerfile was written:

1. **Payload's admin UI is served from its own subdomain, `cms.<domain>`** — not a path on the main domain. Payload's admin route defaults to `/admin`, which collides with the Admin Dashboard already specified at `/admin` inside `apps/web` ([ARCHITECTURE.md](../ARCHITECTURE.md#admin-dashboard)). A subdomain avoids `basePath` rewriting and keeps the two admin surfaces in separate cookie scopes. This does **not** resolve the outstanding Payload admin authentication question, which remains open.
2. **Nginx runs as its own container from the official image, with its configuration bind-mounted** from `docker/nginx/`. Proxy configuration is operational data, not application code — baking it into a custom image would force an image rebuild to change a routing rule.
3. **GitHub Container Registry (GHCR)** holds the three application images. CI is already GitHub Actions and authenticates with the built-in token, so no second vendor is introduced — consistent with this ADR's single-target reasoning.
4. **Local development runs infrastructure in Docker and the applications on the host** via `pnpm dev`. Rebuilding images on every code change is not a workable inner loop. A fully containerized profile stays available for pre-release parity checks.
5. **Phase 1 accepts brief downtime during a Compose update.** `docker compose up -d` recreates containers rather than draining them, so an affected service has a short gap. Genuine zero-downtime needs blue/green or rolling deployment, which a single Compose host does not provide natively.
6. **Phase 1 uses a single VPS deployment model with no separate staging environment. Any future staging environment requires a new architecture decision.** Both `samgp.com` and `cms.samgp.com` resolve to that one host, served by the same Docker Compose stack (`nginx`, `web`, `api`, `cms`, `postgres`, `minio`).

## Consequences

**Positive**

- **Full control of the runtime.** Node version, Nginx configuration, TLS, caching policy, resource limits, and network boundaries are all ours to set, with no platform-imposed constraints on any of them.
- **One environment.** One host, one orchestration tool, one secret store, one deployment pipeline, one place to read logs. Local development and production share the same service model, so parity is structural rather than maintained by hand.
- **Fits the multi-service architecture.** The platform is six services, not a frontend. Compose is required for `postgres`/`minio`/`api`/`cms` regardless, so `web` joins a stack that already exists rather than justifying a second system.
- **No CORS between `web` and `api`.** Both are served from one origin behind Nginx, so browser traffic is same-origin. This removes the cross-origin question that the split-hosting model left open.
- **Internal traffic stays internal.** `api`→`cms` (ADR-003) and `api`→`postgres` (ADR-002) never traverse the public internet, and the `web`→`api` call is host-local — a latency reduction relative to the split model.

**Negative**

- **We manage the infrastructure.** OS patching, TLS certificate renewal, Nginx configuration, backups, uptime monitoring, and capacity are our responsibility. No managed platform absorbs any of it. `DEVOPS.md` "Monitoring & Backups" is the Phase 1 minimum, not a complete operations plan.
- **SEO performance now depends on our own VPS/CDN strategy.** There is no third-party edge network. The Core Web Vitals budget in [seo/SEO_ARCHITECTURE.md](../seo/SEO_ARCHITECTURE.md) (LCP < 2.5s, INP < 200ms, CLS < 0.1) is unchanged but must be met from the origin — through Nginx cache headers, image optimization, and VPS proximity to the primary export markets (Africa, regional neighbours, India, Turkiye). This needs real measurement at M5, not assumption.
- **Single point of failure in Phase 1.** One host means host loss is total outage. Accepted for Phase 1; revisit when load or availability requirements justify it.
- **No pre-production environment at all.** Vercel provided per-PR previews automatically. With one VPS and no staging host, changes move from local development straight to production, gated only by CI validation and the manual approval step. Anything more — per-PR previews or a staging stack — would have to be built deliberately, and a staging environment would need a new architecture decision (see approved implementation decision 6).
- **`apps/web` must run as a Node server.** Next.js is built in standalone output mode and served by its own process in the container, rather than by a managed platform. A build/runtime configuration detail for the `apps/web` scaffold — it changes no application architecture.

## Alternatives Considered

- **Split hosting: Vercel for `apps/web`, VPS for everything else** — rejected. The advantages are real but bounded to one of six services, while the costs (cross-origin CORS across environments, two vendors, two secret stores, two pipelines) apply permanently. Decisive point: the VPS and its Compose stack are required either way, so this adds a second system without removing the first. Revisit only if origin-served frontend performance proves inadequate _and_ a CDN in front of Nginx (below) fails to close the gap.
- **Fully managed PaaS for all services** — rejected. Poor fit for two independently-credentialed PostgreSQL databases (ADR-002) plus self-hosted MinIO; would fragment a stack whose services are deliberately co-located on an internal network.
- **Kubernetes on the VPS** — rejected as substantially heavier than a single-host Phase 1 warrants, for the same reason ADR-001 rejected Nx: operational weight without a matching problem. Revisit only if horizontal scaling becomes a real requirement.

## Future Option

**A CDN in front of Nginx may be evaluated after performance measurement.** This is deliberately deferred, not rejected: it is the natural mitigation if origin-served static/ISR pages miss the Core Web Vitals budget for geographically distant markets. The trigger is measurement at M5 launch-readiness ([ROADMAP.md](../ROADMAP.md)) — not a preemptive assumption that the budget will be missed. Adding a CDN is an additive change to the ingress path and would not alter this ADR's core decision.
