# ADR-006: Payload Admin Uses Separate Authentication

## Status

Accepted, 7 August 2026

Completes the question [ADR-005](./ADR-005-vps-docker-deployment.md) left open under approved implementation decision 1 ("This does not resolve the outstanding Payload admin authentication question, which remains open"). ADR-005 itself is unchanged — this ADR closes the thread through the decision chain rather than by amending an accepted record.

## Context

`ARCHITECTURE.md` stated from the beginning that CMS editors "authenticate through the platform's normal login (Admin/Content Manager roles), **not a separate Payload account**." That sentence was written when Payload was the only admin surface anyone expected staff to use.

Two later decisions changed the picture:

- **[ADR-002](./ADR-002-two-databases.md)** forbids Payload from touching `sam_platform`, where products, blog content, form submissions and users live. Something else has to administer that data.
- The **Admin Dashboard** was therefore approved as an application area inside `apps/web` at `/admin/*`, and **ADR-005** put Payload's admin UI on its own subdomain (`cms.<domain>`) because Payload's admin route also defaults to `/admin`.

That left **two admin surfaces on two hosts** — and a mechanism that had never been specified. Payload's admin UI requires its own session; a platform JWT issued by NestJS is not one. Three options existed:

1. **SSO bridge** — exchange a platform JWT for a Payload session.
2. **Synced accounts** — provision Payload users from Prisma `User` and keep them in step.
3. **Separate authentication** — Payload keeps its own admin users; editors sign in twice.

The contradiction was tracked as an open thread in [`/AI_CONTEXT.md`](../../AI_CONTEXT.md), as blocker 1 in [PROJECT_HANDOFF.md](../PROJECT_HANDOFF.md) §7, and as blocker 1 in [API_CONTRACT_FINAL.md](../API_CONTRACT_FINAL.md), in every case marked as needing a decision before M2 stands up Payload.

## Decision

**Payload Admin uses separate authentication.**

1. **Payload CMS keeps its own admin authentication.** Payload's native auth is the mechanism for `cms.<domain>/admin` — not an internal detail borrowed for service access only.
2. **`cms.samgp.com/admin` uses Payload's native admin users.** These accounts live in `sam_cms` and have no relationship to the Prisma `User` table.
3. **NestJS authentication does not manage Payload admin sessions.** NestJS issues platform JWTs for the public site and the Admin Dashboard, and nothing else.
4. **No SSO bridge between NestJS and Payload will be implemented.** Not now, and not as deferred work — building one later is a new decision requiring its own ADR.
5. **Authentication cookies are never shared between `samgp.com` and `cms.samgp.com`.** The subdomain split from ADR-005 already puts them in separate cookie scopes; this makes that separation a rule rather than a side effect.

NestJS's existing **service-level** access to Payload is unaffected: the Content module still calls Payload's REST API server-to-server on the internal network (ADR-003), authenticated as a service, never as an editor.

### Payload role model

Because Payload no longer inherits anything from platform users, it must express the required access rules itself.

- Payload defines **its own role model**, independent of platform users, with a minimum of **`Admin`** and **`Content Manager`**.
- Those roles **mirror the CMS-facing access rules** in the [SECURITY.md](../SECURITY.md#rbac-permission-matrix) RBAC matrix. The matrix stays the single source of truth for what each role may do; Payload is a second place where the CMS-facing subset of it is enforced.
- **The Certification publishing restriction must exist in Payload's own permissions**: a Content Manager may create and edit certification drafts, and only an Admin may publish. This carve-out is the one place where Content Manager does not have full CMS Content access, and it is enforced in Payload's access control because that is where certifications are edited.
- **Payload RBAC is not synchronized with NestJS users.** Role assignment in Payload is an independent administrative act.

## Consequences

**Positive**

- **Payload stays an independent CMS boundary.** It owns its database (ADR-002), its admin UI, its sessions, and now its roles. Nothing in the platform's identity system reaches into it.
- **NestJS remains the only public API surface.** No new auth endpoint, no token-exchange route, no second consumer of platform JWTs (ADR-003 holds unchanged).
- **No shared-cookie surface between the two hosts.** A session compromise on one admin surface does not carry to the other. Options 1 and 2 would both have created a path between them.
- **Least implementation risk of the three options.** An SSO bridge is bespoke security code on the highest-value session in the system; account syncing is a correctness problem that fails quietly. Neither is written.

**Negative**

- **Editors sign in twice.** A Content Manager updating a product category page authenticates once at `samgp.com/admin` for catalog data and once at `cms.samgp.com/admin` for editorial copy. This is a real, recurring cost, accepted deliberately. The deep-linking mitigation in [API_CONTRACT_FINAL.md](../API_CONTRACT_FINAL.md) §2.11 makes the boundary navigable but does not remove the second login.
- **Account lifecycle is manual, and that is an offboarding risk.** Disabling a platform user has no effect on their Payload account. Someone whose platform access has been revoked can still reach `cms.<domain>` until their Payload account is disabled separately. **Recorded as an operational rule in [SECURITY.md](../SECURITY.md#payload-admin-access): creating, reviewing, disabling and removing Payload admin accounts is a mandatory part of CMS onboarding and offboarding.** No automation for this is being built.
- **The RBAC matrix is enforced in two places.** The CMS-facing rules — CMS Content access and the Certifications publish gate — must be kept aligned between the NestJS guards and Payload's access control by hand. A change to either column in the matrix is a change in two systems.
- **[ADR-004](./ADR-004-freeze-decisions.md)'s argon2id requirement applies to platform identity only.** Payload hashes its own admin passwords with its native implementation, which we no longer control. The scope is made explicit in [SECURITY.md](../SECURITY.md#authentication) rather than left as an implied contradiction.

## Alternatives Considered

- **SSO bridge (platform JWT → Payload session)** — rejected. It is bespoke authentication code sitting on the most privileged session in the platform, and it would make NestJS an issuer of Payload sessions, coupling the two identity systems that ADR-002 and ADR-003 otherwise keep apart. The benefit is one fewer login for a small number of staff; the cost is a custom security surface maintained forever.
- **Payload accounts provisioned and synced from Prisma `User`** — rejected. Cheaper than a bridge, but it is a distributed-state problem with a quiet failure mode: a sync that silently stops leaves stale accounts with live access, which is the same offboarding risk as this decision without the honesty of admitting it is manual. It also reintroduces a coupling between `sam_platform` and `sam_cms` at the application layer, which is the coupling ADR-002 exists to prevent.
- **Amending nothing and leaving the mechanism undefined** — rejected. It blocked M2 and step 6, and an undefined authentication mechanism is decided by whoever writes the code first.

## Future Option

**A single sign-on experience may be revisited if editor volume makes the second login a real operational cost.** Deliberately deferred, not permanently closed. The trigger would be staffing — a CMS team large enough that account lifecycle by hand becomes unreliable. Reopening it requires a new ADR, and this one would be superseded rather than quietly extended.
