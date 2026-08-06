# Testing Strategy

## Tools

- **apps/api** (NestJS): Jest for unit + integration tests (NestJS's default)
- **apps/web** (Next.js): Vitest + React Testing Library for component/unit tests
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
