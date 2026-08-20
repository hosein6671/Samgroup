# Security

Security is the highest priority per [AI_RULES.md](./AI_RULES.md). This document defines the concrete rules behind that principle.

---

## Authentication

- JWT issued only by NestJS (see [ARCHITECTURE.md](./ARCHITECTURE.md#authentication--authorization))
- Access token: short-lived (15 min)
- Refresh token: longer-lived (7 days), stored as an httpOnly, secure, same-site cookie — never in localStorage. **That cookie is `apps/web`'s** ([ADR-012](./ADR/ADR-012-application-session-and-account-status.md)); NestJS neither sets nor reads it, and receives the raw token as a request value over the trusted internal hop. See [the cookie boundary](./API_CONTRACT_FINAL.md#the-cookie-boundary).
- Account status: `active` or `disabled`, on `User`. Disabling **permanently invalidates every credential issued up to that moment** — re-enabling the account brings none of them back ([ADR-012](./ADR/ADR-012-application-session-and-account-status.md) §7)
- Passwords hashed with **argon2id**, never stored or logged in plain text (decided at Architecture Freeze — chosen over bcrypt for stronger resistance to GPU/ASIC cracking)

**Scope of this section: platform identity only.** Everything above governs the identities NestJS issues — public site, Admin Dashboard, and the API. **Payload's admin UI authenticates independently** and is not covered by any of it: Payload issues its own sessions and hashes its own admin passwords with its native implementation, so the argon2id requirement from [ADR-004](./ADR/ADR-004-freeze-decisions.md) does not extend to Payload accounts. See [Payload Admin Access](#payload-admin-access) below and [ADR-006](./ADR/ADR-006-payload-admin-authentication.md).

---

### Implementation status — the session lifecycle is live

Implemented in `apps/api`'s **Identity & Access** module (`src/modules/identity/`). The foundation below arrived first, against the existing `User` model with no schema change; the session half followed with one migration ([ADR-012](./ADR/ADR-012-application-session-and-account-status.md)) and is described after it.

- **Transport is `Authorization: Bearer`.** The two documents describing this do not conflict, and the reading is worth recording: [API_CONTRACT_FINAL.md](./API_CONTRACT_FINAL.md) §7 states "Access token 15 min (Authorization header)" and [FRONTEND_ARCHITECTURE.md](./frontend/FRONTEND_ARCHITECTURE.md) §11 says `apps/web` attaches that header on outbound calls, while the [Token handling](#token-handling--a-clarification-that-follows-from-the-architecture) note below describes where `apps/web` **stores** tokens in the browser — it says so itself, "only the storage location is made explicit". Those are two different hops. **NestJS accepts the access token in the header and reads no cookie**; a token presented in a cookie is treated as no token at all.
- **The token carries `sub`, `iat` and `exp`, and nothing else** — no email, no role, no status, **and no `jti`**. Identity, role and status are all resolved from `sam_platform` on **every** authenticated request, which costs one primary-key lookup and buys four properties: a role change takes effect immediately rather than up to 15 minutes later, **deleting a `User` revokes access on the very next request** rather than at the end of the token's life, **disabling one does the same**, and **a token issued before the account's credential cutoff is refused for good** — the cutoff is compared against the `iat` the token already carries, which is why revoking every token an account holds needs no new claim and no deny-list. All four are verified by test and end-to-end.
- **HS256, pinned on verification as well as on signing**, so a token's own header cannot choose the algorithm — `alg: none` and key-confusion tokens are rejected.
- **argon2id** (m=64 MiB, t=3, p=4), pinned in one service that both the API and the bootstrap script hash through.
- **RBAC is role-level and denies by default.** `@Roles(...)` + `RolesGuard`; a handler carrying no `@Roles()` is denied rather than allowed, which makes this document's "opt into higher requirements, never out of a base one" mechanical. **No permission model was built** — authorization is defined here as a role × resource matrix and nothing finer, there is no `Permission` entity anywhere in the data model, and a dynamic permission database would be exactly the speculative infrastructure the project's rules forbid.
- **The public site is untouched.** No global guard is registered; the guards are attached per route. Every catalog, blog, content, SEO and form endpoint still answers without a token — asserted by test, not left as an intention.

**Deliberately not built, each for a stated reason:**

| Not built                                                           | Why                                                                                                                                                                                                                                                                                           |
| ------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Refresh-token family / reuse detection                              | Replaying an already-rotated token is refused with the generic 401 and nothing further happens. No document freezes token-family semantics, and a half-modelled lineage is worse than none — [ADR-012](./ADR/ADR-012-application-session-and-account-status.md) §6 defers it to its own gate. |
| Account **suspend / lock / pending**, and soft delete               | `UserStatus` has two members by decision. Nothing on this platform distinguishes a suspended account from a disabled one, and an unused enum label reads as a promise. Adding a third is a migration and a decision.                                                                          |
| Status **management** — any endpoint that writes `status`           | No `PATCH /admin/users/:id`, no disable route, no DTO field. Changing an account's status is a database operation until a user-management gate builds the surface. `GET /admin/users` serves the field read-only.                                                                             |
| An access-token deny-list                                           | It would mean persisting every access token ever issued to answer a question that expires on its own in 15 minutes — and disabling or deleting the account already fails the very next request, permanently ([ADR-012](./ADR/ADR-012-application-session-and-account-status.md) §7).          |
| A cleanup job for `auth_sessions`                                   | Revoked and expired rows accumulate and nothing sweeps them. The table is bounded by staff headcount, so it is not urgent — but it is an **open retention/operations decision**, left to [Data retention](#data-retention) rather than invented alongside the session design.                 |
| Password reset, forgot-password, email verification, MFA, SSO/OAuth | Already deferred by [API_CONTRACT_FINAL.md](./API_CONTRACT_FINAL.md) §2.2, and unchanged here.                                                                                                                                                                                                |
| Self-registration                                                   | No endpoint creates an account. None is contracted, and none was added.                                                                                                                                                                                                                       |
| Password change                                                     | There is no authenticated flow to change a password, and the bootstrap script deliberately refuses to reset one.                                                                                                                                                                              |
| Any admin frontend                                                  | See [Admin Dashboard Access](#admin-dashboard-access).                                                                                                                                                                                                                                        |

### The session lifecycle — sessions, rotation, revocation

Added by [ADR-012](./ADR/ADR-012-application-session-and-account-status.md), with one migration (`20260819120000_add_auth_session_and_user_status`).

- **`AuthSession` in `sam_platform`** — `id`, `userId`, `tokenHash`, `createdAt`, `expiresAt`, `revokedAt`. Six columns and deliberately no IP address, user agent, device name or `lastUsedAt`: this is authentication state, not a device-management surface, and none of that data is needed to answer any question the platform asks. Owned by the Identity & Access module and read by nothing else.
- **The refresh token is opaque and 256 bits** — `randomBytes(32)`, base64url. Not a JWT: a self-validating refresh token needs a revocation list to be revocable, which is this table minus the benefit.
- **Only a SHA-256 digest is stored**, lowercase hex, under a unique index. **The raw token is never written to any column and never logged.** A dump of `auth_sessions` authenticates nobody. SHA-256 rather than argon2id is deliberate and is not a weakening: argon2's cost exists to slow the guessing of human-chosen secrets, there is nothing to slow down against 256 CSPRNG bits, and argon2's per-hash salt would make the indexed lookup impossible.
- **Rotation on every refresh.** The presented session is revoked and exactly one replacement is created, in one transaction. The presented token is dead immediately afterwards.
- **Concurrent refresh has exactly one winner.** The claim is a conditional `UPDATE ... WHERE revoked_at IS NULL AND expires_at > now AND <user is active>` requiring one affected row; under READ COMMITTED the loser re-evaluates its predicate against the committed row and matches nothing. **No in-process lock and no Redis** — the guarantee survives a second container.
- **Logout revokes one session, scoped to the authenticated caller.** Presenting another account's refresh token revokes nothing. It answers 204 and is idempotent.
- **Sessions are retained, never swept.** Revoked and expired rows stay — which is also what makes a disable auditable rather than a hole. **No cleanup job exists and building one is explicitly deferred**: the table is bounded by staff headcount, so this is not urgent, and a retention rule belongs to [Data retention](#data-retention) rather than being invented alongside the session design.

### Account status — `active` and `disabled`

| Transition          | Login   | Refresh | An access token already issued      | That account's sessions                  |
| ------------------- | ------- | ------- | ----------------------------------- | ---------------------------------------- |
| `active`            | allowed | allowed | valid until it expires              | usable                                   |
| `active → disabled` | refused | refused | **fails on the next request** (401) | **all revoked, in the same transaction** |
| `disabled → active` | allowed | allowed | **the pre-disable ones stay dead**  | **none come back**                       |

- **The refusal is never disclosed.** A disabled account gets the same 401, the same code and the same `"Invalid email or password."` as an unknown address — and because the status check runs _after_ the argon2 verification, it is not distinguishable by timing either.
- **Disable is revocation, not suspension.** `active → disabled` revokes every live session and stamps a per-user credential cutoff, `users.credentials_revoked_at`. Re-enabling clears neither, so a refresh token — or an access token whose 15 minutes have not elapsed — from before the disable is refused **forever**. The account becomes usable again; the credentials it held do not. Session rows are revoked rather than deleted, which is what leaves an auditable record instead of a hole.
- **The cutoff is enforced by the database, not by a service.** Two triggers: `users_credential_revocation_guard` (BEFORE UPDATE ROW) stamps it with `clock_timestamp()` and refuses to clear or rewind it, and `users_revoke_sessions_on_disable` (AFTER UPDATE STATEMENT, transition tables) revokes the sessions in the same transaction. **There is no status-management endpoint**, so every transition today is a direct `UPDATE`; an invariant living in NestJS would be enforced on none of the paths that actually perform one — and would be bypassed by this gate's own verification. Same position [ADR-011](./ADR/ADR-011-products-slug-namespace-enforcement.md) took.
- **Every authenticated request checks the token against the cutoff**, using the `iat` it already carries: `credentials_revoked_at IS NULL OR credentials_revoked_at < to_timestamp(iat)`. **No `jti` was added and the frozen claim set is unchanged** — a per-token identifier would need the deny-list this platform refuses to keep, while one nullable column revokes an account's entire credential set at once. `iat` is whole seconds and the cutoff is microsecond-precise, so a token whose `iat` second is _at or before_ the revocation second is rejected: the rounding always resolves against the token. The bounded cost, stated rather than discovered — an account disabled and re-enabled inside one second also refuses a token minted in that second, for at most one second.
- **`NOT NULL DEFAULT 'active'`**, applied at the database. A row written by any path — including a raw `INSERT` — is active unless it says otherwise, so "an account whose status was never decided" is not a state this platform can represent. The bootstrap admin writes it explicitly anyway.

<a id="admin-bootstrap"></a>

### Admin bootstrap

`users` starts empty, no endpoint creates an account, and `/admin/users` is Admin-only — so the first Admin cannot be created through the API. `prisma/seed-admin.ts` (`pnpm seed:admin`) breaks that circle once, following the precedent the demo seeds already set and the one [ROADMAP.md](./ROADMAP.md) records for Payload's first admin, created "with no seeded or committed credential".

- **Armed explicitly**, by the process-scoped `SAM_ALLOW_ADMIN_BOOTSTRAP=true`; anything else stops it before the first query. It is **not** wired into `prisma db seed`, so no migration command can create an account as a side effect.
- **Refuses any database but `sam_platform`**, asked of the server with `current_database()` rather than parsed out of a URL (ADR-002).
- **No committed credential and no default.** `SAM_ADMIN_EMAIL` and `SAM_ADMIN_PASSWORD` are supplied by the operator at run time; the file contains neither, and a password under 12 characters is refused.
- **Creates the account `active`**, written explicitly rather than left to the column default.
- **Idempotent, and it never resets an existing password — or an existing status.** A rerun with a _different_ password reports that the account exists and changes nothing; a rerun against a **disabled** admin does not re-enable it. A bootstrap script that silently rewrote a credential, or undid an administrative decision, would be a privilege-escalation path for anyone who could run it, and "I reran the seed" would be indistinguishable from an attack.
- **Nothing is printed but the address the operator supplied** — never the password, never the hash, and never a driver error that could quote the connection string.

**Whether production creates its first Admin this way is a separate operational decision, and it has not been taken** — the VPS does not exist yet ([DEVOPS.md](./DEVOPS.md#deployment-target)). The script is safe to run anywhere only in the sense that it refuses to do anything surprising.

### Auth secrets are deployment-scoped

`JWT_SECRET` is a real secret of the same class as `SMTP_PASSWORD` and the `DATABASE_URL` password: per-environment, injected through the process environment, never committed, never logged, never returned by any endpoint, and **never quoted in a validation message** — a boot failure prints to stdout and into container logs. It is **required**: startup validation refuses to boot without one of at least 32 characters, because the two alternatives — a per-boot generated key, or a committed default — are respectively "every restart logs everyone out and nobody knows why" and "anyone who has read this repository can mint an Admin token". Rotating it invalidates every issued token, which is a 15-minute inconvenience by construction.

The **token lifetime is not configurable**, deliberately. It is frozen at 15 minutes here and in [API_CONTRACT_FINAL.md](./API_CONTRACT_FINAL.md) §7, so it lives as a constant in code — the same rule `apps/cms` applies to its frozen locale list, where an environment variable able to override an already-frozen decision would mean it is not frozen.

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

**The lead workflow makes that row operational** ([ADR-013](./ADR/ADR-013-lead-assignment-and-status-workflow.md)). Within it:

| Capability                | Admin       | Content Manager | Sales Expert             | Customer |
| ------------------------- | ----------- | --------------- | ------------------------ | -------- |
| read lead                 | all         | all             | **own assigned only**    | none     |
| assign · reassign · clear | ✅          | ❌              | ❌                       | ❌       |
| change status · reopen    | ✅ any lead | ❌              | ✅ **own assigned only** | ❌       |
| read history              | ✅          | **❌**          | ✅ own                   | ❌       |

Three things worth stating rather than inferring. **Only Admin assigns**, and only to an **active Sales Expert** — Admin is not itself an eligible assignee under the single-role model. **A Sales Expert may not reassign**, including away from themselves: working a lead and redistributing ownership are different acts. And **Content Manager is excluded from history** even though they may read leads, because history records which member of staff did what and when — employee activity data rather than lead data.

Status is `new` · `in_progress` · `closed`, with `closed` reopenable to `in_progress` and never back to `new`. Every successful mutation writes one audit row in the same transaction as the change; a rejected one writes none. **Actor and assignee identity is snapshotted as text at write time** so the trail survives the physical `User` deletion [ADR-012](./ADR/ADR-012-application-session-and-account-status.md) keeps as the strongest revocation — the foreign keys remain `ON DELETE SET NULL` and were not weakened.

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
  **Status, 20 August 2026: still owed, and deliberately not yet due.** No `Certifications` collection exists, so there is nothing for this rule to guard (decision Q3 — see [PAYLOAD_CONTENT_ARCHITECTURE.md](./content/PAYLOAD_CONTENT_ARCHITECTURE.md) §Certifications). What holds in its place is stronger than an unbuilt gate and weaker than a built one: **no schema on the platform can express a certification claim at all.** The Quality & Certifications Global — which a Content Manager _can_ publish, under the ordinary CMS Content rule — models the certification section as five localized strings describing a withheld state, with no array, relation, issuer, certificate number, validity date, file or link anywhere in it, and tests fail if any such field appears. That is what keeps this row and the CMS Content row compatible today. **The moment a `Certifications` collection is created, this restriction becomes due in the same change**, and it must be server-side: Payload's field-level access on `_status` fails _silently_ (it deletes the value rather than refusing the write), and `restoreVersion` calls collection `update` access **without** `data`, so a data-driven `access.update` predicate alone would not close it.

- **Versions endpoints need their own explicit rule, per collection and per Global.** Verified in `payload@3.88.0`: `readVersions` is given **no default** for either, and `executeAccess` then grants **any authenticated identity** when an access function is absent. A collection whose `read` is correctly constrained to published documents therefore still exposes every draft through `/api/<collection>/versions` unless `readVersions` is declared. This was found and closed for the `AboutUs` Global, and closed for the `Pages` collection on 20 August 2026 — where it had been open, exposing unreviewed legal drafts to the NestJS service credential. **Every new collection and Global declares `readVersions` explicitly**, and a test asserts it.

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

**Which tier owns those cookies is now settled, and it is `apps/web`** ([ADR-012](./ADR/ADR-012-application-session-and-account-status.md)). NestJS emits no `Set-Cookie` and parses no `Cookie` header — a `Set-Cookie` from NestJS would land on a server-side `fetch` rather than on a browser — so `apps/web` reads its own cookie and forwards the raw refresh token as a request value on the internal hop. `apps/api` has no cookie dependency, and must not acquire one. **Cookie name, `SameSite`, `Secure`, `Path` and `Max-Age` remain unfixed** and belong to the frontend session gate, which is the tier that issues them.

### RBAC integration

The RBAC matrix above remains the single source of truth, enforced in NestJS guards. Two rules govern how the dashboard uses it:

1. **UI hiding is not authorization.** The dashboard hides actions a role can't perform — that's usability, not security. **Every `/api/v1/admin/*` request is independently authorized server-side**, on the assumption that the caller crafted it by hand. A hidden button is not a permission check.
2. **Scoping is applied by the server, never requested by the client.** A Sales Expert listing leads receives only their assigned records because NestJS constrains the query — not because the client sent a filter. A client-supplied `assignedToId` filter is an access-control decision made by the least trustworthy participant.

Per-role admin access follows the matrix directly: **Admin** — full. **Content Manager** — blog, SEO metadata, translations; read-only on leads; **no** access to users, catalog writes, or job applications. **Sales Expert** — own leads only; nothing else. **Customer** — no admin access whatsoever; the role has no route into the admin area.

**Job applications remain Admin-only inside the dashboard too** — there is no admin route, list view, or assignment action exposing them to any other role, which is the UI-level counterpart of `JobApplication` carrying no `assignedToId`.

### Implementation status — the session shell and the first operational module

**Built:** `/login`, `/admin`, the middleware session check, the two browser cookies, and — since 19 August 2026 — the **Admin lead inbox** (see below). The route architecture is unchanged ([FRONTEND_ARCHITECTURE.md](./frontend/FRONTEND_ARCHITECTURE.md) §1: an `(admin)` group outside `[locale]`); §2a of that document is the implementation record and the fuller description of what follows.

**The cookies this section left unfixed are now fixed**, by the tier that issues them:

| Cookie              | Purpose                                                   | `Max-Age` |
| ------------------- | --------------------------------------------------------- | --------- |
| `sam_admin_refresh` | the 7-day refresh credential                              | `604800`  |
| `sam_admin_access`  | the 15-minute access token, a **credential carrier only** | `900`     |

Both are `HttpOnly`, `SameSite=Strict`, `Path=/`, **host-only** (no `Domain`, so nothing reaches `cms.samgp.com` — ADR-006's separate realm stays separate), and `Secure` except on a local non-HTTPS development server. Clearing uses the identical name/`Path`/`Domain` triple with `Max-Age: 0`. **Neither is readable by browser JavaScript, and no credential is ever placed in `localStorage` or `sessionStorage`** — which is what makes the anti-XSS claim above true rather than aspirational.

Two cookies rather than one because Next 15 forbids `cookies().set()` outside the action phase: a Server Component cannot persist a rotated refresh token, and rotation revokes the presented one immediately. Middleware therefore owns rotation and refreshes only when the access cookie is absent.

**`apps/web` converts the access cookie into `Authorization: Bearer` on the internal hop and decodes no JWT.** Identity and role come from `GET /auth/me` on each request, so a role change, a delete, or a `disabled` transition takes effect on the very next Admin request. The `admin`-role gate in the shell decides what to render; **NestJS remains the authorization authority**, and the shell deliberately fetches no `/admin/*` data, so nothing on it depends on that gate being right.

**A backend outage is never treated as an authentication failure.** 401/403 clears credentials and requires a new sign-in; a network failure, timeout or 5xx clears nothing and renders a neutral unavailable state. An explicit logout is the mirror image: it calls `POST /auth/logout` and then clears both browser cookies **regardless** of the API's answer.

**Not built, deferred to their own gates:** every Admin module (leads, catalog, blog, users, locales, redirects, translations), password reset/change, MFA, SSO/OAuth, self-registration, any status- or role-management surface, session-management UI, and refresh-token family reuse detection.

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
- **Login is rate limited on its own budget** — 5 attempts per 15 minutes per client, per [API_CONTRACT_FINAL.md](./API_CONTRACT_FINAL.md) §Rate limits, and deliberately **not** sharing the form-submission bucket: one bucket would let submission volume lock staff out of the Admin surface, and let credential stuffing consume a lead's ability to submit
- Rate limiting on every public submission endpoint — Inquiry (incl. Sample Request), Custom Formulation Request, Distributor Application, Job Application, Download Request, and Newsletter Subscription — to prevent spam/abuse. Newsletter sign-up needs it most: an ungated email field is the easiest abuse surface on the site

---

## Secrets Management

- Secrets live in `.env` files, never committed (see `.gitignore`)
- `.env.example` documents required variables with placeholder values
- Production secrets injected via the deployment environment, not baked into Docker images
- **`SMTP_PASSWORD` is a secret of the same class as the `DATABASE_URL` password.** It is read from the environment and handed to nodemailer, and it is never logged, never included in an error message, never returned by any endpoint, and never written into `.env.example`. Startup validation checks that it is a string and nothing further, so no validation failure can quote it. Asserted by test in `env.validation.spec.ts` and `smtp.mailer.spec.ts`.

---

## Data Protection

- No sensitive personal data in URLs or logs
- Database backups encrypted at rest
- Media files (product docs, images) served through access-controlled URLs where confidentiality matters (e.g. unpublished formulation documents)
- **CV files** (`JobApplication.cvMediaId`) are the most sensitive assets in object storage — always access-controlled, never served from a public/guessable URL, and readable only by Admin per the RBAC matrix above

---

## Outbound Lead Notification

**Personal data leaves the platform by email**, and as of 18 August 2026 this is the only route by which it does. When a public form submission is persisted, `apps/api` sends one internal message over SMTP to the single mailbox named by `LEAD_NOTIFICATION_TO`, carrying the submitted contact and enquiry fields. Nothing is sent to the person who submitted the form.

- **The relay operator becomes a processor for that data.** Whichever mailbox and relay the client supplies, lead PII passes through it — a contractual and GDPR question, not only a technical one, since Europe is a served market. It belongs in the same processor and retention review as the tables below.
- **The recipient is configuration, never a literal.** No mailbox is hard-coded anywhere in code or documentation. With `LEAD_NOTIFICATION_TO` unset nothing is sent at all — the attempt is skipped and logged — so an unconfigured or half-configured deployment cannot deliver a lead to an unintended address.
- **The message is plain text with no HTML part**, so submitted markup can never be executable in a reader's mail client.
- **Logs carry the submission id and nothing else about the lead** — no name, company, email address, message body, or recipient mailbox. The id resolves to the full record in `sam_platform`, which is the access-controlled place it belongs, keeping the "no sensitive personal data in URLs or logs" rule below true of this path too.
- **No delivery state is persisted**, so the notification creates no second copy of lead data and nothing additional to retain or purge.

### The Admin lead inbox — read-only, and what that guarantees

Implemented 19 August 2026: `/admin/leads/inquiries` and `/admin/leads/custom-formulation-requests` in `apps/web`, over `GET /admin/inquiries` and `GET /admin/custom-formulation-requests` in `apps/api`. Contract detail is in [API_CONTRACT_FINAL.md](./API_CONTRACT_FINAL.md) §2.10; the security properties are these.

**Roles come from the matrix above, unchanged.** The "Forms & Leads" column governs: **Admin** (all), **Content Manager** (read), **Sales Expert** (own leads only). NestJS enforces it in `RolesGuard`; `Customer` is refused **403**, an absent or unusable token **401**, and the 403 message names neither the caller's role nor the permitted ones.

**Scoping is server-derived, as rule 2 of [RBAC integration](#rbac-integration) requires.** A Sales Expert's queries carry `assignedToId = <their own id>`, taken from the authenticated caller. Neither list DTO declares an `assignedToId` parameter, so a client-supplied one is answered **400** naming the property rather than honoured or ignored. **No assignment endpoint exists**, so no lead is assigned to anyone and a Sales Expert's inbox is legitimately empty — that is the truthful rendering of the data, not a defect.

**The Admin Dashboard is authorized per area, not per surface.** `apps/web` applies the same matrix the API does, one route group at a time:

| Area        | Path              | Roles admitted                           |
| ----------- | ----------------- | ---------------------------------------- |
| Admin shell | `/admin`          | **Admin only**                           |
| Lead inbox  | `/admin/leads/**` | **Admin, Content Manager, Sales Expert** |

The two lists are separate on purpose. The lead inbox had to admit Content Manager and Sales Expert — this matrix grants them read — and nothing on the shell is meant for either role yet, so widening one to accommodate the other would have handed two roles a page built for a third. A Customer is refused in both, and the refusal at `/admin` points a Content Manager or Sales Expert at the inbox they may open rather than leaving them at a dead end. **Every future module gets its own row here and its own `@Roles()` in NestJS — never a blanket `/admin/*` rule.**

**Entry is all the frontend decides.** Which _records_ a role sees is NestJS's, derived from the authenticated caller: `apps/web` sends no `assignedToId`, offers no control that could select another user's queue, and has no URL spelling for one. **An authorized Sales Expert with nothing assigned sees the ordinary empty state, not a refusal** — an empty queue is the truthful rendering of a successful read, and the wording is asserted by test to say so.

Navigation visibility follows the same area rules, so nobody is offered a link to a page that will refuse them — and a Customer, whom no area admits, is shown no navigation at all. That is an affordance; the boundary remains the NestJS guard.

**Read-only, and no lifecycle.** No admin endpoint writes: no status transition, no assignment, no notes, no tags, no delete, no export. `status` remains the initial ingestion state `new`, with no authorized transition and no second value.

**Personal data handling.** These are the most sensitive records the platform holds (see [Personal Data Retention](#personal-data-retention) below), so:

- Responses are **explicit projections**, never whole rows. `userId`, `assignedToId` and `attachmentMediaId` are omitted everywhere; free-text bodies (`message`, `requiredSpecifications`) appear only on a detail response, never in a list of 25.
- `limit` is **bounded at 100**, so no single request can extract the lead table. Bulk export is a separate, unbuilt capability.
- `Cache-Control: no-store` on every response, and `apps/web` fetches with `cache: "no-store"` and renders these routes dynamically.
- **No submission content is logged.** The frontend's one failure diagnostic carries an endpoint and a failure class; no name, email, message or specification reaches a log line.
- **The session cookies are `HttpOnly`, proven on the wire.** `Set-Cookie` from the middleware refresh carries `HttpOnly; Secure; SameSite=strict` for both `sam_admin_access` and `sam_admin_refresh`, and a browser holding a live session can read neither through `document.cookie`.
- The access token is read from an HttpOnly cookie **server-side only** and forwarded on the internal hop. It never reaches a browser bundle, the DOM, or a URL; there are no browser→NestJS requests on this surface.
- **An outage is never rendered as a missing record.** A definitive API 404 renders "not found"; a 5xx, timeout or transport failure renders "temporarily unavailable" and touches no cookie. A 401 clears the stale credentials through the session-end handler; a 403 does not.

### The Identity module's exported boundary

**One capability leaves the Identity & Access module: `AccessTokenVerifier`.** An `Authorization`
header value goes in; the live authenticated user, or `null`, comes out — verify the signature with
the algorithm pinned, require `sub` and `iat`, then resolve the user through the active-status and
credential-revocation gate. That plus the two guards is the whole of what `IdentityModule` exports.

**`UsersService`, `AuthSessionsService`, `AuthService`, `PasswordService` and `JwtModule` are not
exported**, and no module outside `modules/identity/` may name any of them, inject a `JwtService`,
or query `users` for itself. Architecture tests assert both halves — the module's own export
metadata, and the source of every other module.

Why the narrow class exists at all is a Nest mechanic worth recording, because it is not obvious and
no unit test catches it: **a class named in `@UseGuards()` is constructed in the module that declares
the controller**, not in the module that exported it. So whatever the guard injects must resolve in
every module that protects a route. The first attempt satisfied that by exporting `JwtModule` and
`UsersService` — which handed every consuming module the password-hash lookup and the staff table in
order to solve a wiring problem. `AccessTokenVerifier` is the correction: it exposes no Prisma, no
repository, no lookup by id or email, no password check, no token minting and no session mutation.

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

  **Item 2 implemented 18 August 2026 — the persistence exists; the consent links are still inactive.** `Inquiry` and `CustomFormulationRequest` each carry a nullable `privacyPolicyVersion` (`privacy_policy_version TEXT`, migration `20260818120000_add_consent_privacy_policy_version`), written on insert and never afterwards. **The value is owned by `apps/api`**, not by a client and not by the CMS: it is the constant `ACTIVE_PRIVACY_POLICY_REVISION` in `apps/api/src/modules/forms/privacy-policy-revision.ts`, and neither DTO declares the field, so a client sending it is answered **400 `VALIDATION_ERROR`** naming the property. **Nothing is read from Payload at submission time** — a stored literal rather than a lookup — for three reasons: a CMS outage must never turn a valid lead into an error, `Pages.lastUpdatedDate` remains an editor-set display field rather than an audit trail, and [ADR-002](./ADR/ADR-002-two-databases.md) forbids a cross-database reference in either direction. Changing the active revision is therefore a commit, and the repository history is the record of which revision was in force when.

  **The constant is `null` today, and that is a measurement rather than a placeholder.** No approved Privacy Policy content exists, in this repository or in `sam_cms`; `/{locale}/privacy-policy` answers 404 in all three locales; the four consent labels still name the policy as plain text and **link to nothing**. A submission made today was consented against no versioned document, and `NULL` records exactly that — no revision identifier was invented, and no historical value was fabricated. **Setting the first real revision belongs to the gate that publishes approved policy content**, which is where the identifier format (a date, a `v1.0`, whatever legal review names it) is decided too. **Item 1 of the ordering above is still open, so the consent links stay inactive.**

  **The column is immutable after insertion, enforced at the database layer.** Migration `20260818140000_privacy_policy_version_immutable` adds a `BEFORE UPDATE` trigger to both tables which raises `restrict_violation` whenever `privacy_policy_version IS DISTINCT FROM` the stored value: `NULL → revision`, `revision → NULL` and `revision → another revision` are all rejected, while `NULL → NULL`, an unchanged value, and updates to any other column proceed normally. **There is no privileged application bypass, by decision** — a consent recorded against `NULL` cannot be rewritten later to pretend a policy was in force, and any future legally required correction must be a separately designed audit record about the evidence rather than a mutation of it. Re-checkable with `scripts/verify-consent-version-immutability.sh`.

  **Deliberately not built:** no consent-history table — one immutable value per submission is the whole requirement; no index on the column — it is per-row audit evidence, not a query axis; and no `retentionExpiresAt`.

- **Lead workflow history is now in scope, and its deletion behaviour is an open decision.** `StatusHistory` and `LeadAssignmentHistory` record which member of staff changed a lead and when — **employee** personal data, which this table did not previously have to consider — and they hold an email snapshot that deliberately outlives the `User` row. **Neither has a foreign key to its lead** (both are polymorphic), so nothing cascades: deleting a lead today would leave orphan history behind. Whichever gate implements lead deletion or a retention purge **must handle both tables in the same transaction, or under an approved rule that says why they survive** — it may not leave the behaviour to the absence of a constraint. No duration is invented here; the periods remain blocked on legal input with the rest of this section.
- Deletion must be a real capability, not a manual database task — a data-subject deletion request has a legal response deadline.
- A `retentionExpiresAt` field (or an equivalent scheduled purge) may be added to these entities once concrete periods exist; deliberately not added to [DATA_MODEL.md](./DATA_MODEL.md) yet, since guessing a period is worse than leaving the field out.

**Still blocked:** the actual retention periods, and whether GDPR formally applies, require legal input. That work is already a launch blocker via the Privacy Policy ([SITE_STRUCTURE.md](./SITE_STRUCTURE.md#outstanding-confirmations-needed)) — retention periods should be settled in the same pass rather than as a separate exercise.

---

## Dependency & Build Security

- Dependabot (or equivalent) enabled for dependency vulnerability alerts
- `npm audit` / `pnpm audit` run in CI
- Docker images built from minimal, pinned base images
