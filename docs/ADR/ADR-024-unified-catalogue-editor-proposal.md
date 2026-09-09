# ADR-024: Unified catalogue editing through the Admin Dashboard

Status: Accepted, 2026-09-08. Owner explicitly authorized implementation, including user management and activity/security logs. Acceptance authorizes the design below; it does not mean the features are implemented.

## Decision

Allow `/admin` to be the operator workspace for catalogue data and its Payload-owned editorial content. This changes the editing-UI split in API_CONTRACT_FINAL §2.11; it does not change database ownership or introduce a second CMS.

Allow Content Manager to edit and publish ordinary catalogue editorial content and SEO, while keeping specification and claim approval Admin-only. This changes the Products/Catalog read-only permission for Content Manager in SECURITY. It does not grant user administration or access to unrelated private data.

## Implementation boundary

- Next.js server actions call protected NestJS endpoints. No browser token exposure or direct browser-to-Payload access.
- NestJS authorizes each operation and writes Prisma-owned catalogue data through Catalog, SEO and Media service interfaces.
- Payload remains the owner of category editorial content, repeaters, shared catalogue copy and its editorial media. NestJS uses a narrowly scoped service interface to edit that content on behalf of the authorized operator; operator identity is captured in audit records without impersonating a Payload user.
- Payload admin retains separate authentication. No SSO, shared cookies or account synchronization. Service-mediated editing requires explicit authorization and audit design, not reuse of unrestricted service credentials in the browser.
- Each entity has one SEO editing location. Product SEO belongs to the product editor, category SEO to the category editor. Avoid multiple independent sources for the same public metadata.
- Existing public records remain public during rollout. New draft and publication storage must be specified and migrated explicitly, with the published representation preserved until a publish operation succeeds.
- Technical specifications, claims, provenance and review decisions remain under existing review rules. Ordinary content publication never sets technical approval or republishes withheld source-document bytes.

## Delivery sequence and acceptance checks

User and audit foundations precede new catalogue writes. Existing read-only endpoints can be connected while these foundations are implemented.

1. Update the API contract, security matrix and content model to match this decision. Specify editable fields, validation, ownership, revision tokens and audit records before writes.
2. Add authenticated real catalogue lists and details, with search, category filter, pagination, empty and unavailable states. Keep design fixtures isolated.
3. Add ordinary product content/SEO drafts, validation and optimistic concurrency. Verify a stale save cannot overwrite a newer edit; verify unknown fields and unauthorized roles are rejected.
4. Add category/shared editorial content using Payload-owned models and the NestJS gateway. Connect the public category and shared templates to published content, preserving current content during migration.
5. Add owner-scoped media upload, attachment, ordering, primary selection, alt text and document metadata. Enforce file size/type and ownership. Never expose CVs, lead attachments or technical source evidence through catalogue media APIs.
6. Add explicit publish/unpublish and preview workflows, subject to technical-review boundaries. Verify metadata, canonical, robots, redirects and sitemap agree with publication state; preserve existing URLs until a reviewed slug-change workflow exists.
7. Verify Admin and Content Manager workflows, denied technical approval, session expiry, concurrent edits, upload failures and public output. Use disposable fixtures; do not change real product content solely to demonstrate a save.

## Current implementation limits

The committed preview is a design artifact with sample entries and disabled save/upload/publish controls. It is not a persistence implementation. Product-level applications, benefits and FAQ proposed by that preview require an approved content model and public rendering integration. This proposal must not be reported as those features being complete.

## User management and audit — approved extension

- Admin alone may create platform users, assign existing roles and enable/disable accounts from `/admin`. No new dynamic permission model, shared Payload accounts or automatic CMS account provisioning.
- Account changes must preserve at least one active Admin, prevent accidental self-lockout, use optimistic concurrency and revoke affected sessions when required. Passwords use the existing credential policy and argon2id service; credentials are never returned by list endpoints or logged.
- Record successful user/content mutations in a durable append-only activity trail atomically with the mutation where both are in the same database. Cross-service editorial writes need an explicit failure/reconciliation design before enabling publication.
- Record authentication success/failure, access denial, session revocation and privilege changes as security events. Use bounded structured metadata; never log passwords, tokens, cookies, request bodies, private attachments or unrestricted before/after content.
- Admin-only log views support actor, time, event and outcome filters with bounded pagination. No edit/delete endpoints for logs. Retention and operational purge procedures must be specified before enabling collection; append-only through the application is not a claim of protection against database administrators.
- Security checks include unauthorized log access, sensitive-field exclusion, stale user updates, concurrent last-Admin changes and audit-write failure. Verify with disposable accounts rather than altering real staff for demonstration.

## Alternatives

- Retain the existing split: catalogue CRUD in `/admin`, category editorial content in Payload Admin. This preserves the current contract but does not meet the owner's single-workspace requirement.
- Move Payload editorial content into Prisma: rejected by this proposal because it creates a second CMS and changes ownership unnecessarily.

Relevant sources: AGENTS §2; ADR-002, ADR-003, ADR-006; API_CONTRACT_FINAL §2.10–2.11; SECURITY RBAC matrix; PAYLOAD_CONTENT_ARCHITECTURE.
