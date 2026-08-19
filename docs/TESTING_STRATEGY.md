# Testing Strategy

## Tools

- **apps/api** (NestJS): Jest for unit + integration tests (NestJS's default)
- **apps/web** (Next.js): Vitest + React Testing Library for component/unit tests
  - **Vitest 4.1.10 is now installed and running** (`pnpm --filter @sam-group/web test`), configured in `apps/web/vitest.config.mts`: node environment, specs colocated as `src/**/*.spec.{ts,tsx}`.
  - **Pinned one patch behind the latest on purpose.** This workspace enforces pnpm's `minimumReleaseAge` supply-chain policy, and 4.1.11 was hours old — installing it made `pnpm install --frozen-lockfile` fail the policy check and required eight `minimumReleaseAgeExclude` entries in `pnpm-workspace.yaml`. 4.1.10 needs none, so the policy stays intact rather than being carved open for a version whose only advantage was recency. **Prefer this over adding an exclusion when bumping any dependency here.**
  - **React Testing Library is still not installed.** Every subject tested so far is server-side — cookie attributes, middleware, the session boundary, Server Actions, the API client — and the one rendering assertion (that no credential reaches the output) walks the returned React element tree, which inspects prop values as well as text and needs no DOM. RTL and a DOM environment arrive with the first gate that builds an interactive Admin component; adding them earlier would be two dependencies no assertion uses.
- **End-to-end**: Playwright, run against a full docker-compose stack

---

## What to Test

- **Unit**: services, utility functions, RBAC guards, DTO validation rules
- **Integration**: NestJS module endpoints against a real (test) Postgres database
- **E2E**: critical user journeys — browse catalog, submit sample request, submit custom formulation request, admin login + content edit

---

## Coverage Expectations

- Business logic (NestJS services, guards, validators): minimum 70% coverage
- UI components: test behavior, not implementation details — coverage is a signal, not a target to chase
- No merge to `main` with failing tests (enforced in CI, see [DEVOPS.md](./DEVOPS.md))

---

## Conventions

- Test files colocated with source: `*.spec.ts` (unit/integration), `*.e2e.spec.ts` (Playwright)
- Test database is separate from dev database, reset between test runs
- Mock external services (email, future ERP integration) — never call real third-party APIs in tests
