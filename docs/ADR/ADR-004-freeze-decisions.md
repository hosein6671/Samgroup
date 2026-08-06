# ADR-004: Architecture Freeze Decisions — Password Hashing and Version Pinning

## Status

Accepted

## Context

At Architecture Freeze, every architectural area was reviewed against the 7-category checklist (folder structure, technology stack, monorepo strategy, database strategy, API strategy, CMS strategy, authentication strategy). Two genuine either/or decisions were found still open within that review, both narrow enough to resolve immediately rather than block the freeze:

1. **Password hashing algorithm.** `SECURITY.md` said "bcrypt or argon2" — not a single choice. Both are viable: bcrypt is older and more battle-tested with more existing NestJS tooling/guides; argon2id is the more modern default (winner of the Password Hashing Competition) with stronger resistance to GPU/ASIC-accelerated cracking.
2. **Version pinning strategy.** `TECH_STACK.md` named every framework with no version numbers at all (Node.js, pnpm, Next.js, NestJS, Payload CMS, Prisma, PostgreSQL). The Bootstrap Plan assumed pinning would happen at scaffold time but never said to what, or when that decision itself gets made.

Neither blocks the folder structure, monorepo tooling, database topology, or API/CMS integration decisions already made in ADR-001/002/003 — both are narrower, leaf-level parameters within already-decided strategies.

## Decision

1. **Password hashing: argon2id.** Chosen over bcrypt for stronger resistance to modern cracking hardware, consistent with `SECURITY.md`'s "Security First" priority and `AI_RULES.md`'s security-first ordering.
2. **Version pinning: deferred to the point of actual use, not fixed at freeze time** — pin to latest-stable when the Bootstrap Plan actually scaffolds each piece (Node/pnpm at monorepo init, Next.js/NestJS/Payload/Prisma at their respective scaffold steps), rather than freezing a number now that risks being outdated by the time bootstrap actually runs.

This decision was later partially superseded for the frontend specifically: when the frontend stack was finalized, Next.js 15 and React 19 were pinned explicitly (see `docs/technology/FRONTEND_STACK.md`). Backend/infrastructure versions (Node.js, pnpm, NestJS, Payload CMS, Prisma, PostgreSQL) remain deferred per this ADR until bootstrap.

## Consequences

**Positive**

- `SECURITY.md` now states a single, unambiguous hashing algorithm — no implementation-time guessing.
- Version pinning happens against whatever is actually latest-stable when each piece is scaffolded, avoiding freezing a number that goes stale during the gap between documentation and bootstrap.

**Negative**

- argon2id has a smaller pool of existing NestJS-specific guides/examples than bcrypt — expect to write more of the integration code from the library's general docs rather than copying a ready-made NestJS recipe.
- Deferred version pinning means `TECH_STACK.md` is deliberately incomplete on exact versions until bootstrap actually runs; anyone reading it before then must know this is intentional, not an oversight (this ADR is that record).

## Alternatives Considered

- **bcrypt** — rejected only on the margin of cracking-resistance; not rejected for any functional deficiency. Revisit is low-priority since both remain viable password hashing choices industry-wide.
- **Pinning exact versions at freeze time** — rejected because the gap between "architecture frozen" and "bootstrap actually runs" is unpredictable, and a frozen version number can go stale (security patches, breaking changes already fixed upstream) before it's ever used.
