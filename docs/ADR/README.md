# Architecture Decision Records

Each ADR captures a decision that was genuinely contested — where more than one reasonable option existed and one was chosen for stated reasons — not routine choices. Format: Status, Context, Decision, Consequences, Alternatives Considered.

| ADR                                      | Decision                                                                                    | Status   |
| ---------------------------------------- | ------------------------------------------------------------------------------------------- | -------- |
| [ADR-001](./ADR-001-monorepo.md)         | Monorepo with pnpm workspaces + Turborepo                                                   | Accepted |
| [ADR-002](./ADR-002-two-databases.md)    | Two independent Postgres databases (Prisma vs. Payload), not a shared database with schemas | Accepted |
| [ADR-003](./ADR-003-api-gateway.md)      | NestJS as the single API gateway; `apps/web` never calls Payload directly                   | Accepted |
| [ADR-004](./ADR-004-freeze-decisions.md) | Password hashing algorithm (argon2id) and version-pinning strategy at Architecture Freeze   | Accepted |

These four, together with the folder structure, API strategy, and CMS strategy documented elsewhere in `docs/`, make up the frozen architecture — see [`CLAUDE.md`](../../CLAUDE.md) and [`AI_CONTEXT.md`](../../AI_CONTEXT.md) at the repo root for what "frozen" means in practice.

## Adding a new ADR

Only write one for a decision with real alternatives and lasting consequence — not for routine implementation choices. Number sequentially, follow the existing template, and link it from this table.
