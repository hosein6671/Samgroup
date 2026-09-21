# Deployment package verification

> **Superseded, 18 September 2026.** Everything below describes a local-only smoke test; both of its own "still required" claims have since been closed. The release workflow **has** since been executed on GitHub (`.github/workflows/release-images.yml`, triggered after CI passes on `main`) and images have been pulled and deployed to a real VPS multiple times via `deploy/deploy.sh` — most recently commit `84e9567`, verified live via direct `curl` and a fresh PageSpeed Insights run. This file is kept as the historical record of the pre-deployment local verification pass, not edited in place, per this project's convention for dated status entries — see [DEVOPS.md § Deployment Target](../docs/DEVOPS.md#deployment-target) and [PROJECT_HANDOFF.md](../docs/PROJECT_HANDOFF.md) item 6 for current status.

## Verified locally — 14 September 2026

All three Linux images built successfully with the pinned dependency lockfile at installation: sam-platform/api:local-check, sam-platform/cms:local-check and sam-platform/web:local-check. None was published to a registry or deployed to a server.

- API: production build and image export passed. Isolated runtime imports for Nest, generated Prisma and shared content passed; native argon2 hashing passed. Separate localhost port 3301 returned 200 for health, locales and published Header content.
- CMS: optimized build and image export passed. Separate localhost port 3302 returned 200 for Admin and an authenticated published Header read. The CLI tsx loader, shared packages and full Payload configuration loaded with networking disabled. No migration was executed.
- Web: optimized Linux standalone build, type validation and page generation passed. Separate localhost port 3300 returned 200 for Home, Products and Login; unauthenticated Admin redirected to Login (307). The build and runtime used the packaged API.
- Dependency-version audit of the built artifacts: all 337 API and 670 CMS CLI packages matched versions present in the repository lockfile. No unlocked package version was found.
- Shared-runtime regression test and script lint passed. Compose configuration validates with the example environment; base upstream interpolation warnings are overridden by production service values.

## Packaging fixes

Complete workspace manifests are copied before installation. CMS includes shared content sources. Shared runtime exports are compiled to JavaScript and workspace links are materialized into the release package. This fixed an actual API image failure caused by a link back into the build workspace. CMS CLI retains its development tooling for migration configuration loading; this increases image size. Download cache is shared between images and available during packaging. Legacy pnpm deploy performs an additional resolution step, so installation's frozen lockfile check is not a claim that deploy is itself frozen.

Nested environment files, host build caches and generated Prisma output are excluded from Docker context. Linux generates Prisma during build. Image publication is gated by successful CI on main; the prior manual CI bypass was removed. The release workflow has not been executed on GitHub.

## Recovery history

Earlier attempts hit npm download timeouts. Sequential builds with cache reuse completed. Docker then reported a full C drive; the owner freed space and cancelled relocation before any data moved. Docker storage remains at its original location. No database volume was reset or deleted.

## Still required before production

This completes local image packaging and smoke testing, not the production launch. The CMS baseline/additive migration for five structural Globals, empty-database migration tests, full-stack production configuration, TLS, object-store decision, backups/restoration and server deployment remain separate gates. The draft deployment/backup scripts and untracked migration baseline are not certified by these image checks. Local CMS image contains the existing migration files, but they were not applied in this test. Public indexing stayed disabled.
