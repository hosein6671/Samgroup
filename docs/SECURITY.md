# Security

Security is the highest priority per [AI_RULES.md](./AI_RULES.md). This document defines the concrete rules behind that principle.

---

## Authentication

- JWT issued only by NestJS (see [ARCHITECTURE.md](./ARCHITECTURE.md#authentication--authorization))
- Access token: short-lived (15 min)
- Refresh token: longer-lived (7 days), stored as an httpOnly, secure, same-site cookie — never in localStorage
- Passwords hashed with **argon2id**, never stored or logged in plain text (decided at Architecture Freeze — chosen over bcrypt for stronger resistance to GPU/ASIC cracking)

---

## RBAC Permission Matrix

| Role            | Products/Catalog | Blog | CMS Content | Certifications                           | Forms & Leads    | Job Applications       | Users            | Admin Settings |
| --------------- | ---------------- | ---- | ----------- | ---------------------------------------- | ---------------- | ---------------------- | ---------------- | -------------- |
| Admin           | full             | full | full        | full (incl. publish)                     | full             | **full — sole access** | full             | full           |
| Content Manager | read             | full | full        | create/edit drafts only — **no publish** | read             | **none**               | none             | none           |
| Sales Expert    | read             | read | none        | read                                     | full (own leads) | **none**               | none             | none           |
| Customer        | read             | read | none        | read (published only)                    | create (own)     | create (own)           | own profile only | none           |

This matrix is the source of truth for RBAC guards in NestJS. Update it whenever a new role or resource is introduced.

**On the Certifications column:** it's broken out separately because it's the one deliberate exception to Content Manager's otherwise-full CMS Content access. A certification is a verifiable third-party claim — a buyer who checks one and finds it doesn't exist is a lost buyer — so publishing requires Admin approval even though drafting doesn't. Approved as decision 7 in [docs/content/PAYLOAD_CONTENT_ARCHITECTURE.md](./content/PAYLOAD_CONTENT_ARCHITECTURE.md#decisions-log); enforced in Payload's access control, not only in the NestJS guard, since editing happens in the CMS admin UI.

**On the Job Applications column: Admin-only, deliberately.** CVs and cover letters are the most sensitive personal data the platform holds, and a job application is not a sales lead. Routing it into a Sales Expert's queue would expose applicant personal data to a team with no business need for it — so Sales Expert and Content Manager both get **none**, not read. This is why `JobApplication` carries no `assignedToId` in [DATA_MODEL.md](./DATA_MODEL.md), unlike every other submission entity. If a dedicated HR/Recruiter role is introduced later, it gets its own row here rather than widening any existing one.

**"Forms & Leads"** covers Inquiry (including Sample Requests), Custom Formulation Request, Distributor Application, and Download Request — the lead-bearing submissions Sales Expert works. Job Applications and Newsletter Subscriptions are deliberately excluded from that column.

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
- Deletion must be a real capability, not a manual database task — a data-subject deletion request has a legal response deadline.
- A `retentionExpiresAt` field (or an equivalent scheduled purge) may be added to these entities once concrete periods exist; deliberately not added to [DATA_MODEL.md](./DATA_MODEL.md) yet, since guessing a period is worse than leaving the field out.

**Still blocked:** the actual retention periods, and whether GDPR formally applies, require legal input. That work is already a launch blocker via the Privacy Policy ([SITE_STRUCTURE.md](./SITE_STRUCTURE.md#outstanding-confirmations-needed)) — retention periods should be settled in the same pass rather than as a separate exercise.

---

## Dependency & Build Security

- Dependabot (or equivalent) enabled for dependency vulnerability alerts
- `npm audit` / `pnpm audit` run in CI
- Docker images built from minimal, pinned base images
