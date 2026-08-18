# Security

Security is the highest priority per [AI_RULES.md](./AI_RULES.md). This document defines the concrete rules behind that principle.

---

## Authentication

- JWT issued only by NestJS (see [ARCHITECTURE.md](./ARCHITECTURE.md#authentication--authorization))
- Access token: short-lived (15 min)
- Refresh token: longer-lived (7 days), stored as an httpOnly, secure, same-site cookie — never in localStorage
- Passwords hashed with **argon2id**, never stored or logged in plain text (decided at Architecture Freeze — chosen over bcrypt for stronger resistance to GPU/ASIC cracking)

**Scope of this section: platform identity only.** Everything above governs the identities NestJS issues — public site, Admin Dashboard, and the API. **Payload's admin UI authenticates independently** and is not covered by any of it: Payload issues its own sessions and hashes its own admin passwords with its native implementation, so the argon2id requirement from [ADR-004](./ADR/ADR-004-freeze-decisions.md) does not extend to Payload accounts. See [Payload Admin Access](#payload-admin-access) below and [ADR-006](./ADR/ADR-006-payload-admin-authentication.md).

---

## RBAC Permission Matrix

| Role            | Products/Catalog | Blog | CMS Content | Certifications                           | Forms & Leads    | Job Applications       | Users            | Admin Settings |
| --------------- | ---------------- | ---- | ----------- | ---------------------------------------- | ---------------- | ---------------------- | ---------------- | -------------- |
| Admin           | full             | full | full        | full (incl. publish)                     | full             | **full — sole access** | full             | full           |
| Content Manager | read             | full | full        | create/edit drafts only — **no publish** | read             | **none**               | none             | none           |
| Sales Expert    | read             | read | none        | read                                     | full (own leads) | **none**               | none             | none           |
| Customer        | read             | read | none        | read (published only)                    | create (own)     | create (own)           | own profile only | none           |

This matrix is the source of truth for RBAC guards in NestJS. Update it whenever a new role or resource is introduced.

**It is enforced in two systems, not one.** The **CMS Content** and **Certifications** columns describe rules that take effect inside Payload's admin UI, where that content is actually edited — and under [ADR-006](./ADR/ADR-006-payload-admin-authentication.md) Payload authenticates independently and knows nothing about platform users or their roles. Payload therefore maintains **its own role model** (minimum `Admin` and `Content Manager`) mirroring those two columns. The matrix remains the single source of truth for what a role may do; Payload is a second place where the CMS-facing subset of it is enforced, kept aligned by hand. A change to either column is a change in two systems. Details: [Payload Admin Access](#payload-admin-access).

**On the Certifications column:** it's broken out separately because it's the one deliberate exception to Content Manager's otherwise-full CMS Content access. A certification is a verifiable third-party claim — a buyer who checks one and finds it doesn't exist is a lost buyer — so publishing requires Admin approval even though drafting doesn't. Approved as decision 7 in [docs/content/PAYLOAD_CONTENT_ARCHITECTURE.md](./content/PAYLOAD_CONTENT_ARCHITECTURE.md#decisions-log); enforced in Payload's access control, not only in the NestJS guard, since editing happens in the CMS admin UI.

**On the Job Applications column: Admin-only, deliberately.** CVs and cover letters are the most sensitive personal data the platform holds, and a job application is not a sales lead. Routing it into a Sales Expert's queue would expose applicant personal data to a team with no business need for it — so Sales Expert and Content Manager both get **none**, not read. This is why `JobApplication` carries no `assignedToId` in [DATA_MODEL.md](./DATA_MODEL.md), unlike every other submission entity. If a dedicated HR/Recruiter role is introduced later, it gets its own row here rather than widening any existing one.

**"Forms & Leads"** covers Inquiry (including Sample Requests), Custom Formulation Request, Distributor Application, and Download Request — the lead-bearing submissions Sales Expert works. Job Applications and Newsletter Subscriptions are deliberately excluded from that column.

---

## Payload Admin Access

**Payload's admin UI is a separate authentication system** ([ADR-006](./ADR/ADR-006-payload-admin-authentication.md)). This is the second of the platform's two admin surfaces — the first is the Admin Dashboard inside `apps/web`, covered in the next section — and the two share no identity, no session, and no cookie.

### Authentication boundary

- **Payload keeps its own admin authentication.** `cms.<domain>/admin` is reached with a Payload account stored in `sam_cms`. A platform JWT is not accepted there and is not exchangeable for a Payload session.
- **NestJS does not manage Payload admin sessions**, and **no SSO bridge exists** between the two systems. Building one is a new decision requiring its own ADR.
- **Authentication cookies are never shared between the main domain and the CMS subdomain.** The subdomain split from [ADR-005](./ADR/ADR-005-vps-docker-deployment.md) already places them in separate cookie scopes; treat that separation as a rule, not an incidental property. No cookie issued by either surface may be scoped to a parent domain that would make it readable by the other.
- **NestJS's service-level access to Payload is a different thing entirely** and is unchanged: the Content module calls Payload's REST API server-to-server on the internal network, authenticated as a service, never as an editor (ADR-003).

### Payload's own role model

Payload cannot read platform roles, so it expresses the CMS-facing access rules itself:

- **Minimum roles: `Admin` and `Content Manager`**, mirroring the CMS Content and Certifications columns of the RBAC matrix above.
- **The Certification publishing restriction must exist in Payload's permissions**, not only in a NestJS guard: a Content Manager may create and edit certification drafts; **only an Admin may publish**. This is the one deliberate exception to Content Manager's otherwise-full CMS Content access, and certifications are edited in Payload, so Payload is where it has to hold.
- **Payload RBAC is not synchronized with NestJS users.** Role assignment inside Payload is an independent administrative act, performed in Payload.

### Account lifecycle — mandatory procedure

Because nothing is synchronized, **revoking a platform user does not revoke their CMS access.** Someone whose platform account has been disabled retains access to `cms.<domain>` until their Payload account is disabled separately.

**Rule: creating, reviewing, disabling, and removing Payload admin accounts is a mandatory part of CMS onboarding and offboarding procedures.** Offboarding is not complete until the Payload account has been disabled or removed. Payload admin accounts are also reviewed periodically against the current staff list, since drift here is silent by construction.

No automation for this is being built. It is a documented manual procedure, and the accepted cost of the separate-authentication decision.

---

## Admin Dashboard Access

The Admin Dashboard is an application area inside `apps/web` ([ARCHITECTURE.md](./ARCHITECTURE.md#admin-dashboard)). Its security boundary:

### Authentication boundary

- **The public site is entirely unauthenticated in Phase 1.** No Phase 1 page authenticates an end user — the Customer role exists for the future Customer Portal. So the admin area is the _only_ authenticated surface, which keeps the boundary unusually clean: one protected route segment, everything else public.
- **Admin routes are protected in middleware**, before any page renders. An unauthenticated request to an admin path is redirected to login — never served a shell that fetches and fails, which leaks the surface's existence and structure.
- **Access is denied by default.** The admin segment requires a valid session for _every_ route within it; individual routes opt into higher role requirements, never opt out of the base requirement.

### Token handling — a clarification that follows from the architecture

The token model in [Authentication](#authentication) above (15-min access token, 7-day refresh token in an httpOnly cookie) assumed the common case of a browser calling an API directly. **This platform has no browser→NestJS calls at all** — every request is server-side, from Server Components or Server Actions ([FRONTEND_ARCHITECTURE.md](./frontend/FRONTEND_ARCHITECTURE.md)).

That means **the access token never needs to be readable by JavaScript**, and shouldn't be: both tokens live in httpOnly cookies, read server-side per request and attached to the outbound NestJS call. This is strictly stronger than the usual pattern — an XSS bug in the admin UI cannot exfiltrate a token it has no way to read. Lifetimes, rotation, and argon2id hashing are unchanged; only the storage location is made explicit.

### RBAC integration

The RBAC matrix above remains the single source of truth, enforced in NestJS guards. Two rules govern how the dashboard uses it:

1. **UI hiding is not authorization.** The dashboard hides actions a role can't perform — that's usability, not security. **Every `/api/v1/admin/*` request is independently authorized server-side**, on the assumption that the caller crafted it by hand. A hidden button is not a permission check.
2. **Scoping is applied by the server, never requested by the client.** A Sales Expert listing leads receives only their assigned records because NestJS constrains the query — not because the client sent a filter. A client-supplied `assignedToId` filter is an access-control decision made by the least trustworthy participant.

Per-role admin access follows the matrix directly: **Admin** — full. **Content Manager** — blog, SEO metadata, translations; read-only on leads; **no** access to users, catalog writes, or job applications. **Sales Expert** — own leads only; nothing else. **Customer** — no admin access whatsoever; the role has no route into the admin area.

**Job applications remain Admin-only inside the dashboard too** — there is no admin route, list view, or assignment action exposing them to any other role, which is the UI-level counterpart of `JobApplication` carrying no `assignedToId`.

### Non-indexable by construction

The admin area sits outside the localized public route tree, is excluded from `sitemap.xml`, and is disallowed in `robots.txt`. It carries no SEO metadata, no `hreflang`, and no structured data — it isn't a website surface, and treating it as one would only create ways to leak its existence.

---

## Input Validation

- All incoming requests validated via NestJS `class-validator` DTOs before reaching business logic
- Reject unknown fields (`whitelist: true` in the global validation pipe)
- Sanitize any user-submitted rich text (blog comments, form free-text fields) before storage/render

---

## Transport & Network

- HTTPS enforced everywhere (Nginx terminates TLS)
- CORS restricted to known frontend origins — no wildcard `*` in production
- Rate limiting on every public submission endpoint — Inquiry (incl. Sample Request), Custom Formulation Request, Distributor Application, Job Application, Download Request, and Newsletter Subscription — to prevent spam/abuse. Newsletter sign-up needs it most: an ungated email field is the easiest abuse surface on the site

---

## Secrets Management

- Secrets live in `.env` files, never committed (see `.gitignore`)
- `.env.example` documents required variables with placeholder values
- Production secrets injected via the deployment environment, not baked into Docker images

---

## Data Protection

- No sensitive personal data in URLs or logs
- Database backups encrypted at rest
- Media files (product docs, images) served through access-controlled URLs where confidentiality matters (e.g. unpublished formulation documents)
- **CV files** (`JobApplication.cvMediaId`) are the most sensitive assets in object storage — always access-controlled, never served from a public/guessable URL, and readable only by Admin per the RBAC matrix above

---

## Personal Data Retention

**Approved as a requirement.** Every entity that stores personal data needs a defined retention period, after which records are deleted or irreversibly anonymized. This is not optional housekeeping: the platform collects personal data from EU-market buyers (Europe is a served market per [SITE_STRUCTURE.md](./SITE_STRUCTURE.md)), and indefinite retention of unsuccessful job applicants' CVs in particular is a standard compliance finding.

Entities in scope, in rough order of sensitivity:

| Entity                            | Personal data held                                             | Retention consideration                                                                                                                                                             |
| --------------------------------- | -------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `JobApplication`                  | Name, contact details, **CV file**, cover letter               | Highest sensitivity. Unsuccessful-applicant data typically carries a short, explicitly-stated window; keeping a CV "in case something opens up" generally requires separate consent |
| `Inquiry` (incl. Sample Requests) | Name, company, contact details, free-text message, attachments | Commercial lead data — longer retention is usually defensible, but not indefinite                                                                                                   |
| `CustomFormulationRequest`        | Contact details, technical requirements, attachments           | As above; attachments may also contain the customer's own confidential specifications                                                                                               |
| `DistributorApplication`          | Contact details, commercial business data                      | As above                                                                                                                                                                            |
| `DownloadRequest`                 | Name, company, country, email                                  | Lightest — but highest volume, so the largest accumulation of personal records over time                                                                                            |
| `NewsletterSubscription`          | Email, locale                                                  | Retained until unsubscribe; unsubscribed records should be purged or reduced to a suppression hash rather than kept whole                                                           |

**Requirements this establishes now:**

- Every entity above already carries `consentGiven`. Recording **when** consent was given, and **against which version** of the Privacy Policy, is a recommended addition when the policy is drafted — it's the part that's expensive to reconstruct retroactively.

  **Sharpened 17 August 2026, from "recommended" to sequenced.** The canonical `/{locale}/privacy-policy` route now exists and reads Payload, so the gap between "no policy" and "a live policy consent labels link to" is one editorial publish, not another gate. Two facts make the sequencing matter: `Inquiry` and `CustomFormulationRequest` store `consentGiven` and nothing else about the agreement, and `Pages.lastUpdatedDate` is an **editor-set display field in `sam_cms`, not an audit trail** — so once the policy is live, neither database can answer "which text did this person agree to". Today that costs nothing, because a consent that references a nonexistent document has no version to lose. **It starts costing from the first submission made against a published policy.** The requirement, **ratified 17 August 2026**, is therefore: **before consent links are activated, a separate approved `sam_platform` schema gate must persist the policy version/revision agreed to.** Consent links go live only when that gate has landed **and** approved published policy content exists — either alone is insufficient. The field shape — a version string, a date snapshot, a slug+revision pair, a reference to a Payload revision id — is **not decided here**; it is a `sam_platform` schema change needing its own approval, and guessing it would be the same error as guessing a retention period. **`Pages.lastUpdatedDate` does not satisfy this and must not be treated as consent evidence:** it is an editor-set display field, freely editable after the fact, nullable, and not localized.

- Deletion must be a real capability, not a manual database task — a data-subject deletion request has a legal response deadline.
- A `retentionExpiresAt` field (or an equivalent scheduled purge) may be added to these entities once concrete periods exist; deliberately not added to [DATA_MODEL.md](./DATA_MODEL.md) yet, since guessing a period is worse than leaving the field out.

**Still blocked:** the actual retention periods, and whether GDPR formally applies, require legal input. That work is already a launch blocker via the Privacy Policy ([SITE_STRUCTURE.md](./SITE_STRUCTURE.md#outstanding-confirmations-needed)) — retention periods should be settled in the same pass rather than as a separate exercise.

---

## Dependency & Build Security

- Dependabot (or equivalent) enabled for dependency vulnerability alerts
- `npm audit` / `pnpm audit` run in CI
- Docker images built from minimal, pinned base images
