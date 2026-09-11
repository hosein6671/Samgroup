# ADR-025: Versioned blog editorial drafts

Status: Accepted, 2026-09-11. The owner explicitly approved this recommendation and authorized implementation.

## Context

`BlogPost` is the public Prisma-owned article record. Public reads treat `publishedAt` as the visibility boundary, but an already-published article remains visible while editors work on its next revision. Writing edits directly to `BlogPost` would therefore expose incomplete copy before an explicit publish action.

The Admin Dashboard must manage articles through NestJS. Payload remains responsible only for the CMS-owned collections documented in the content architecture; duplicating blog ownership in Payload would create two sources of truth.

## Decision

- Store one current, versioned `BlogEditorialDraft` for each `BlogPost`.
- The draft contains the complete publishable snapshot, including title, slug, content, category, tags and SEO input. `revision` is an optimistic-concurrency token.
- `BlogPost` remains the published projection. A new, never-published post may have a base row with `publishedAt = NULL`; public APIs must continue to exclude it.
- Saving a draft changes only the draft. Publishing validates the submitted revision and applies the article, tag and SEO snapshot in one serializable Prisma transaction, then advances the draft revision and writes the Admin audit event.
- Republishing an existing article preserves its original `publishedAt`; first publication sets it to the publication time. Unpublishing is a separate explicit operation.
- The browser communicates only with Next.js server actions and protected NestJS endpoints. It never calls Prisma or Payload directly.

## Consequences

- Editors can safely save incomplete changes to published articles without affecting the public site.
- Stale browser sessions cannot silently overwrite newer edits.
- The additive table and relation require a Prisma migration, but existing public rows and URLs remain unchanged.
- A draft is the current working copy, not a permanent revision archive. Durable publication history, if required later, needs a separate decision.
- Article media selection must follow the same staged-publication boundary when it is added to the editor.

## Alternatives considered

- Edit `BlogPost` directly: rejected because changes to a published row become public before Publish.
- Move blog editing to Payload: rejected because Prisma already owns BlogPost, BlogCategory and BlogTag and the frozen architecture forbids a second source of truth.
- Store a full immutable revision history or event stream: rejected for this phase because safe editing needs one concurrency-controlled working copy, not a general version-control system.
