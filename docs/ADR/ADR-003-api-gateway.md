# ADR-003: NestJS as the Single API Gateway for the Frontend

## Status

Accepted

## Context

The platform has three potential API surfaces the `web` app could talk to: the NestJS `api` for business logic, and Payload CMS's own REST/GraphQL API for content (pages, menus, footer, settings). `ARCHITECTURE.md` originally listed all three applications without saying how they connect.

Two integration patterns were considered:

- **Next.js calls both APIs directly** — `web` talks to NestJS for business logic and to Payload directly for CMS content. Fewer network hops (no proxying), but:
  - Two different auth contexts in the frontend (NestJS JWT vs. Payload's own auth/API keys)
  - Two different response shapes/error formats to handle in the frontend
  - Rate limiting, caching, and request logging would need to be implemented twice
  - The frontend becomes coupled to Payload's API directly, so swapping or restructuring the CMS later means frontend changes too

- **NestJS fronts Payload** — `web` only ever calls the NestJS `api`. NestJS's Content module calls Payload internally (server-to-server) and re-exposes what the frontend needs in the platform's own response envelope.

## Decision

`web` calls only the NestJS `api`, at `/api/v1/*` (see [API_DESIGN.md](../API_DESIGN.md)). NestJS is the single API gateway for the frontend:

- Business-logic endpoints (catalog, blog, forms, users) are served directly by their respective NestJS modules.
- CMS-backed content is served under `/api/v1/content/*`, where NestJS's Content module calls Payload internally and translates Payload's shape into the platform's standard envelope.
- Authentication is unified: JWT is issued only by NestJS (see [ARCHITECTURE.md](../ARCHITECTURE.md#authentication--authorization)); Payload's own auth is used only for NestJS's internal service-level access to Payload, never exposed to the frontend.

## Consequences

**Positive**

- One API surface, one auth scheme, one error/response shape for the frontend to handle.
- Caching, rate limiting, and request logging live in one place (NestJS) instead of being duplicated per backend.
- Payload can be replaced, upgraded, or restructured later without touching `web` — only NestJS's Content module needs to change.
- Fits the "CMS only manages content, no business logic in CMS" rule already in `ARCHITECTURE.md`: business rules about *how* content is exposed live in NestJS, not Payload.

**Negative**

- Every piece of CMS content the frontend needs must be explicitly proxied/mapped by the Content module — no ad hoc direct queries against Payload's GraphQL API from the frontend.
- Adds one network hop (web → api → cms) for content requests versus calling Payload directly. Mitigated with caching in NestJS's Content module since CMS content (pages, menus, footer, settings) changes infrequently.

## Alternatives Considered

Direct dual-API access from the frontend was rejected mainly for the auth/response-shape duplication and the tighter coupling it creates between `web` and Payload's specific API. Revisit only if the proxy hop becomes a measurable performance problem that caching can't solve.
