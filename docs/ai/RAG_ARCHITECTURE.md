# RAG (Retrieval Augmented Generation) Architecture

> **Companion document:** [RAG_IMPLEMENTATION_ARCHITECTURE.md](./RAG_IMPLEMENTATION_ARCHITECTURE.md) is the approved implementation plan built on this strategy — it defines the exact allow-list of indexable sources, the forbidden sources, the pipeline stages, and the security rules. Where the two overlap, the implementation document is more specific and takes precedence; this document remains the rationale for *why* RAG is an independent module.

Future-readiness design for AI capabilities on the platform — **nothing here is built**. This is the architectural anchor for the "AI Features" future phase already named in [PROJECT_VISION.md](../PROJECT_VISION.md#future-phases), the same way [DATA_MODEL.md §2](../DATA_MODEL.md#2-future-modules--planned-entities-not-implemented-in-phase-1) anchors Customer Portal, CRM, Workflow, and ERP Integration without building them. No frozen decision (ADR-001/002/003, monorepo tooling, database topology, API gateway pattern, CMS boundaries) is changed by anything below. No package is installed; no vector database, embedding model, or LLM provider is chosen here — where a concrete choice would normally go, this document names the *options* and the *decision criteria*, not a pick.

---

## 0. Governing Rule

**RAG must be an independent module and must not create a dependency on the core platform.** Every design choice below exists in service of this one rule. Concretely, that means:

- RAG **never reads `sam_platform` or `sam_cms` directly**. It consumes the platform's existing public API (`/api/v1/*`, per [API_DESIGN.md](../API_DESIGN.md)) exactly the way `apps/web` does — as an external client of a versioned contract, not an internal module with schema-level access.
- This is a direct extension of a pattern this project already relies on twice: ADR-002 isolates Payload from Prisma because sharing storage creates exactly this kind of fragile coupling, and ADR-003 makes NestJS the one API surface everything else depends on. RAG is the *proof* that boundary works — a whole new capability can be added, changed, or removed without ever touching `apps/api`, `apps/web`, or `apps/cms` source code.
- Practically: **RAG can be built, deployed, versioned, and decommissioned as its own service**, independent of the monorepo's release cycle, because its only integration point is a stable API contract, not internal implementation details. Whether it eventually lives as `apps/rag` inside this monorepo or as a fully separate repository is an implementation choice that doesn't affect this architecture either way.
- If a future implementation is ever tempted to give RAG a direct database connection "for performance," that is the one thing this document rules out by design — see §2's Integration section for the sanctioned alternative (a dedicated export endpoint) when bulk access is genuinely needed.

---

## 1. Data Sources

| Source | Where it actually lives | Reaches RAG via |
|---|---|---|
| Products, Categories, Specifications | Prisma, `sam_platform` | NestJS Catalog module API |
| Technical documents, PDFs (spec sheets, certifications) | `Media` records (MinIO for bytes, Prisma for metadata) | NestJS Media module API |
| Articles (Blog) | Prisma, `sam_platform` | NestJS Blog module API |
| Company knowledge, Pages, Landing Pages | Payload, `sam_cms` | NestJS Content module API (already proxies Payload — see [ARCHITECTURE.md](../ARCHITECTURE.md#cms-integration)) |
| CMS content generally (Menus, Footer, Settings) | Payload, `sam_cms` | NestJS Content module API |
| Localized versions of all the above | `ContentTranslation` (Prisma) / Payload localized fields | Same endpoints, locale-parameterized (per [docs/i18n/INTERNATIONALIZATION_STRATEGY.md](../i18n/INTERNATIONALIZATION_STRATEGY.md)) |

No new data source bypasses the existing API surface. This table is really just [DATABASE.md](../DATABASE.md)'s existing entity index, read from the angle of "what would a RAG indexer need to pull," not a new inventory of content.

`Specification`'s existing key/value structure (already called out as LLM-friendly in [docs/seo/SEO_ARCHITECTURE.md §9](../seo/SEO_ARCHITECTURE.md#9-ai-search--llm-readiness)) is the single best-shaped data source in the platform for retrieval — structured facts retrieve and cite more reliably than prose extracted from marketing copy.

---

## 2. RAG Pipeline

### Data ingestion
A separate ingestion process (own deploy, own schedule) calls the NestJS API — either the existing per-resource endpoints (`/products`, `/blog`, `/content/pages`, ...) for incremental updates, or a new dedicated **bulk export endpoint** (`GET /api/v1/rag/export?since=<timestamp>&locale=<locale>`) for efficient full/incremental corpus pulls, added to [API_DESIGN.md](../API_DESIGN.md) when this is actually built. This endpoint is the sanctioned way to get bulk access without a direct database connection — it's still just an API contract, versioned and access-controlled like everything else.

### Document processing
- Structured content (Products/Specifications) needs no extraction — it's already field-level data.
- Unstructured content (PDFs, technical documents) needs text extraction (and OCR for scanned documents) before chunking.
- CMS rich text (Payload Pages) needs conversion from its rich-text/block format to plain text while preserving heading structure, since heading structure informs chunk boundaries below.

### Chunking strategy
Not one strategy for everything — chunking follows content shape:

| Content type | Approach |
|---|---|
| Product + Specification | One structured chunk per product, specifications embedded as labeled key/value facts, not prose-flattened |
| Technical documents/PDFs | Paragraph/section-based chunking with overlap, preserving section headings as chunk metadata for citation |
| Blog articles, Company Pages | Semantic/paragraph chunking with overlap, sized to the embedding model's effective context |
| Short CMS content (Settings, Footer) | Usually not chunked at all — small enough to embed as a single unit, or excluded from retrieval entirely if purely structural (e.g. Menus — see [docs/seo/SEO_ARCHITECTURE.md §3](../seo/SEO_ARCHITECTURE.md#3-payload-cms-seo-architecture)'s equivalent call on Menus not needing SEO fields; the same "not all content is retrieval-worthy" logic applies here) |

### Embedding generation
Provider-agnostic by design — no embedding model is chosen here (that's a future implementation decision, not an architecture one). Requirement: the chosen model **must support all three launch locales** (`en`, `fa`, `ar` — see §6). Whatever provider is chosen, embedding generation is a step the ingestion process calls out to, not logic embedded in `apps/api`.

### Vector storage
A **dedicated, isolated store — never `sam_platform` or `sam_cms`.** This is the same reasoning ADR-002 already applied to Payload vs. Prisma, extended to a third independent concern. Two realistic shapes, either satisfies the independence rule:
- **`pgvector` in its own Postgres database** (e.g. `sam_vector`) on the same Postgres server as `sam_platform`/`sam_cms` — reuses operational familiarity (same server, same backup tooling) while staying a fully separate database, consistent with the "separate database per concern" pattern.
- **A dedicated vector database** (e.g. Qdrant, Weaviate, Milvus, or a managed equivalent) as its own service — more purpose-built retrieval features (hybrid search, filtering) at the cost of one more operational component.

Neither is chosen here — see §4's scalability section and the Remaining Decisions at the end.

### Retrieval
Vector similarity search, filtered by:
- **Locale** (retrieve the query's language, or the content's cross-lingual match — see §6).
- **Permission scope** (§3 below) — filtering happens *before* results reach the LLM context, not just before display.
- Optionally hybrid (vector + keyword) for queries where exact-term precision matters (a spec number, a product code) — pure semantic similarity can under-rank an exact match.

### Context preparation
Retrieved chunks are assembled into the LLM's context window with their **source reference preserved** (which Product/Document/Page/locale a chunk came from) so the final response can cite sources — this is what makes "Technical document Q&A" and "Knowledge base search" trustworthy rather than a black box.

### AI response generation
Provider-agnostic (no LLM vendor chosen here). The response generation step receives the prepared context + the user's query + a prompt template appropriate to the use case (product search vs. customer assistant vs. internal assistant have different tone/scope prompts), and returns a response with citations back through the same API boundary described in §3.

---

## 3. Integration

Consistent with §0 — every integration point below is the existing API/auth pattern, not a new one:

- **Payload CMS**: RAG never touches `sam_cms`. It reads Payload content exclusively through NestJS's existing Content module, the same way `apps/web` does.
- **NestJS API**: RAG is a *client* of `/api/v1/*`, plus (when built) new dedicated endpoints under a `/api/v1/rag/*` namespace for bulk export and for serving retrieval-augmented queries back to the frontend — following the exact resource-naming and envelope conventions already in [API_DESIGN.md](../API_DESIGN.md), not a parallel API style.
- **PostgreSQL**: RAG's own vector store (§2) is a separate, isolated database — never `sam_platform`/`sam_cms`.
- **Frontend**: `apps/web` calls RAG capabilities (product search, customer assistant chat, etc.) through NestJS only — never a direct frontend-to-RAG-service connection. This preserves the single-API-surface rule (ADR-003) exactly as-is.
- **Authentication**: RAG-facing endpoints require the same NestJS-issued JWT as everything else (per [ARCHITECTURE.md](../ARCHITECTURE.md#authentication--authorization)) — no separate auth system, no API keys issued directly to the frontend for RAG.
- **RBAC**: retrieval reuses the existing RBAC matrix in [SECURITY.md](../SECURITY.md) rather than inventing a parallel permission model — see §3 (Security) for how that matrix maps onto retrieval scope.

---

## 4. Security

### Permission-aware retrieval
Every indexed chunk carries a permission tag (which role(s) may retrieve it) derived from the same RBAC matrix already in [SECURITY.md](../SECURITY.md). **Filtering happens at retrieval time, before context assembly — not only at display time.** This is the single most important rule in this section: if a chunk a Customer shouldn't see ever enters the LLM's context window, a sufficiently clever prompt can talk the model into revealing it regardless of what the UI displays. The permission check has to happen before the model ever sees the content, not after.

### Private vs. public data — separate corpora, not one shared index with a filter
Rather than one index with permission tags bolted on, maintain **logically separate retrieval scopes by audience**, as defense in depth on top of the permission tags above:
- **Public corpus**: published Products, published Blog posts (`publishedAt` already gates this in [DATA_MODEL.md](../DATA_MODEL.md)), published Payload Pages (Payload's own draft/publish status already gates this).
- **Internal corpus**: unpublished/draft content, internal company knowledge, anything [SECURITY.md](../SECURITY.md) already flags as confidentiality-gated (that document specifically calls out "unpublished formulation documents" needing access-controlled URLs — the same content needs to stay out of the public corpus here, not just off public URLs).
- A **Customer AI assistant** only ever retrieves from the public corpus. An **Internal company assistant** or **Sales assistant** can retrieve from both, per the matrix below.

### Use case → corpus/audience mapping

| Capability | Corpus | Audience (RBAC role) |
|---|---|---|
| Intelligent product search | Public (Products, Specifications, Categories) | Everyone |
| Customer AI assistant | Public (Products, Blog, Pages, Company info) | Everyone (including anonymous visitors) |
| Technical document Q&A | Public docs by default; internal docs if the requester's role permits | Role-dependent — same per-document permission tag as above |
| Sales assistant | Public + internal (leads/inquiries context) | Sales Expert, Admin |
| Knowledge base search | Public + internal, scoped by role | Role-dependent |
| Internal company assistant | Internal corpus (broadest access, most restricted audience) | Admin, Content Manager (or as the RBAC matrix is extended for this use case) |

### User access control
A Customer's queries must never retrieve `Inquiry`/`CustomFormulationRequest`/`DistributorApplication`/`DownloadRequest` content (lead/CRM-adjacent data) even for an "Internal company assistant" style capability — that data is Sales Expert/Admin-scoped in [SECURITY.md](../SECURITY.md)'s RBAC matrix, and retrieval scope must inherit that, not create a side door around it. **`JobApplication` is stricter still: never index it at any tier.** It's Admin-only by design, contains CVs, and no assistant use case justifies putting applicant personal data into a retrieval corpus — the same reasoning that keeps it out of Sales queues applies with more force to an LLM context window.

### Sensitive information protection
Never embed raw PII (customer names, emails, phone numbers, free-text form submissions) into a vector store without explicit justification — embedded PII is still PII at rest, and inherits the same protections [SECURITY.md §Data Protection](../SECURITY.md#data-protection) already requires for the primary database (encryption at rest, no exposure in logs). Where lead/inquiry content genuinely needs to be retrievable (Sales assistant use case), prefer indexing de-identified summaries over raw form contents where the use case allows it.

---

## 5. Scalability

### Future vector database options
Not chosen here (§2) — `pgvector` (reuses existing Postgres operational investment) vs. a dedicated vector database (Qdrant/Weaviate/Milvus/managed equivalents, better native hybrid-search/filtering support at the cost of one more service). Revisit when embedding volume and query-latency requirements are concrete enough to decide.

### Multi-language embeddings
The embedding model must cover `en`, `fa`, `ar` (§6) at minimum, with headroom for whatever locale gets added next per [docs/i18n/INTERNATIONALIZATION_STRATEGY.md](../i18n/INTERNATIONALIZATION_STRATEGY.md) — a model/provider decision, not an architecture one, but the requirement is fixed now so it isn't discovered late.

### Document versioning
Content changes (a Product edited, a spec sheet replaced) make existing embeddings stale. Track a content hash or `updatedAt` per source record (already present on most entities in [DATA_MODEL.md](../DATA_MODEL.md)) so the ingestion process can detect "this chunk's source changed" and re-embed just that chunk, tombstoning the old vector rather than leaving a stale one searchable.

### Re-indexing strategy
Incremental by default (only re-embed changed content, driven by the `since=<timestamp>` export parameter in §2), with a periodic full re-index as a reconciliation safety net against any missed incremental update — the same "trust but verify" pattern, applied to data freshness instead of code correctness.

---

## 6. Internationalization

Full platform i18n strategy: [docs/i18n/INTERNATIONALIZATION_STRATEGY.md](../i18n/INTERNATIONALIZATION_STRATEGY.md). RAG-specific implications:

- **Multilingual documents**: each locale's version of a Product/Article/Page (via `ContentTranslation` or Payload's localized fields) is indexed as its own set of chunks, tagged with its locale — not just the default locale's content.
- **Multilingual embeddings**: the embedding model must place `en`/`fa`/`ar` content in a way that supports retrieval for all three — either a genuinely multilingual embedding space (a query in Persian can retrieve semantically similar English content directly) or per-language embedding spaces with query-time translation. Both are legitimate; the choice is a provider/model decision deferred to implementation.
- **Language-aware retrieval**: default behavior is to retrieve content in the query's own language; falling back to another locale's content (with a translation note) is a reasonable fallback when a locale's corpus is thin, but should never silently present untranslated content as if it were native.

---

## 7. Architecture Rules (restated)

1. RAG is a consumer of the platform's public API — never a direct consumer of `sam_platform`/`sam_cms`/MinIO internals.
2. RAG's own storage (vector store) is its own isolated store — never grafted onto an existing database.
3. RAG's auth is the platform's existing JWT/RBAC — never a parallel permission system.
4. Retrieval respects permission scope *before* context assembly, not just at display time.
5. Every capability in the goal list (product search, customer assistant, document Q&A, sales assistant, knowledge base search, internal assistant) is a different **retrieval scope/prompt configuration** on top of the *same* pipeline — not six separate systems.

If a future implementation ever violates rule 1 or 2 "for performance," that's the point at which this document's core premise has been abandoned — worth flagging explicitly if it comes up.

---

## Future Implementation Roadmap (non-binding — sequencing only, no dates)

1. Add the `/api/v1/rag/export` bulk-read endpoint to the existing NestJS API (§2) — the only change to the current platform this ever requires, and it's purely additive.
2. Stand up the isolated vector store (§2) and a minimal ingestion job against a small, low-risk corpus (e.g. published Products only) to validate the pipeline end-to-end.
3. Add permission-aware retrieval and the public/internal corpus split (§4) before any customer-facing capability ships — security scoping comes before feature breadth, not after.
4. Ship "Intelligent product search" first (public corpus, lowest security surface, clearest value) as the proof of concept for the rest.
5. Layer in the remaining capabilities (customer assistant, document Q&A, sales assistant, knowledge base, internal assistant) as additional retrieval scopes/prompts on the same pipeline, per the use case table in §4.
6. Only then evaluate multilingual embedding quality against real `fa`/`ar` content and tune per §6.

## Remaining Decisions (not resolved by this document — deferred to implementation)

1. Vector store choice (`pgvector` vs. dedicated vector database).
2. Embedding model/provider (must support `en`/`fa`/`ar`).
3. LLM provider(s) for response generation.
4. Whether RAG ships as `apps/rag` inside this monorepo or as a fully separate repository/service — architecturally irrelevant per §0, but a real operational choice when the time comes.
