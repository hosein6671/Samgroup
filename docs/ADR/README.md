# Architecture Decision Records

Each ADR captures a decision that was genuinely contested — where more than one reasonable option existed and one was chosen for stated reasons — not routine choices. Format: Status, Context, Decision, Consequences, Alternatives Considered.

| ADR                                                                  | Decision                                                                                                                                  | Status   |
| -------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| [ADR-001](./ADR-001-monorepo.md)                                     | Monorepo with pnpm workspaces + Turborepo                                                                                                 | Accepted |
| [ADR-002](./ADR-002-two-databases.md)                                | Two independent Postgres databases (Prisma vs. Payload), not a shared database with schemas                                               | Accepted |
| [ADR-003](./ADR-003-api-gateway.md)                                  | NestJS as the single API gateway; `apps/web` never calls Payload directly                                                                 | Accepted |
| [ADR-004](./ADR-004-freeze-decisions.md)                             | Password hashing algorithm (argon2id) and version-pinning strategy at Architecture Freeze                                                 | Accepted |
| [ADR-005](./ADR-005-vps-docker-deployment.md)                        | VPS-only deployment with Docker; `apps/web` is not deployed to Vercel                                                                     | Accepted |
| [ADR-006](./ADR-006-payload-admin-authentication.md)                 | Payload Admin uses separate authentication; no SSO bridge, no synced accounts, no shared cookies                                          | Accepted |
| [ADR-007](./ADR-007-product-taxonomy-v2.md)                          | Product Taxonomy v2; canonical Product Detail routes supersede the no-`[productSlug]` rule                                                | Accepted |
| [ADR-008](./ADR-008-b2-filter-contract-and-segment-vocabulary.md)    | Segment slugs, `Other` as vocabulary rather than a row, and the `GET /products` taxonomy filter contract                                  | Accepted |
| [ADR-009](./ADR-009-product-family-canonical-identifier.md)          | A Product Family has one canonical identifier — its default-locale `Category.slug`                                                        | Accepted |
| [ADR-010](./ADR-010-products-slug-namespace-and-collision-policy.md) | Product Family and Product Detail share one `products/` slug namespace; Family precedence, reserved slugs, and a symmetric collision rule | Accepted |
| [ADR-011](./ADR-011-products-slug-namespace-enforcement.md)          | A shared, database-maintained slug claim registry enforces that namespace; ADR-010 §6's mechanism deferral is closed                      | Accepted |
| [ADR-012](./ADR-012-application-session-and-account-status.md)       | Refresh sessions in `sam_platform` with rotation; `active`/`disabled` account status; `apps/web` owns the browser cookie                  | Accepted |
| [ADR-013](./ADR-013-lead-assignment-and-status-workflow.md)          | Lead assignment and status workflow                                                                                                       | Accepted | 20 August 2026 |

These twelve, together with the folder structure, API strategy, and CMS strategy documented elsewhere in `docs/`, make up the frozen architecture — see [`CLAUDE.md`](../../CLAUDE.md) and [`AI_CONTEXT.md`](../../AI_CONTEXT.md) at the repo root for what "frozen" means in practice.

## Adding a new ADR

Only write one for a decision with real alternatives and lasting consequence — not for routine implementation choices. Number sequentially, follow the existing template, and link it from this table.
