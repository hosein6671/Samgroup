# ADR-023: Admin dashboard brand alignment

Status: Accepted, 2026-09-08. Owner requested an Admin appearance aligned with the public site and instructed implementation after the ADR-022 conflict was explained.

## Decision

The Admin Dashboard may use the SAM navy/brass identity, existing brand artwork and display font, while retaining readable light work surfaces and compact operational typography. This supersedes ADR-022 only where it excludes brand alignment of Admin. Shared primitive tokens, public styles and architecture remain unchanged. Admin styles stay locally scoped; do not import the full marketing stylesheet into operational screens.

The first implementation is the authenticated Admin home: navigation to existing modules and clear descriptions of what each module does. Unbuilt features are not working links. No fabricated metrics.

This decision grants no new data permission. Existing role guards, technical approval boundaries, separate Payload authentication, two databases, and NestJS gateway remain unchanged. Unified SEO editing and expanded content permissions require their own specified implementation and access decisions.

## Alternatives and consequences

Retaining the separate blue/light identity was rejected by the owner. Reusing the entire public layout would introduce marketing navigation and styles into staff workflows; instead use a scoped Admin presentation. Further modules can adopt this language incrementally after their behavior is verified.
