# RAG Implementation Architecture

The implementation plan for the strategy in [RAG_ARCHITECTURE.md](./RAG_ARCHITECTURE.md). That document establishes _why_ RAG is an independent module consuming only the public API; this one defines _exactly what gets indexed, what must never be, and how the pipeline runs_.

**Nothing here is built.** No library, embedding model, vector store, or LLM provider is chosen — where a concrete pick would normally go, this names the decision criteria instead. No frozen architecture (ADR-001/002/003) is changed. No code, no dependencies.

---

## 1. RAG Purpose in the Sam Group Platform

RAG exists to answer questions a buyer or an internal team member would otherwise have to email someone about. Concretely, the capabilities it enables ([PROJECT_VISION.md](../PROJECT_VISION.md)'s "AI Features" future phase):

| Capability                 | The question it actually answers                                      |
| -------------------------- | --------------------------------------------------------------------- |
| Intelligent product search | "Which base oil grade suits a 15W-40 blend at this viscosity target?" |
| Customer AI assistant      | "Do you supply Group III? In flexitank? To Turkiye?"                  |
| Technical document Q&A     | "What's the flash point of SN 500, and what test method?"             |
| Sales assistant            | "What did we tell this market about Incoterms and lead times?"        |
| Knowledge base search      | Internal lookup across product, process, and export documentation     |
| Internal company assistant | Broadest scope, most restricted audience                              |

The commercial case is specific to this business: [SITE_STRUCTURE.md](../SITE_STRUCTURE.md) shows most buyer questions are _technical qualification_ questions (specifications, grades, packaging, documentation, Incoterms), and the FAQ sheet exists precisely because the same questions arrive by email repeatedly. Those are exactly the questions a well-grounded retrieval system answers well — and the platform's `Specification` key/value model is unusually well-shaped for it (already noted in [SEO_ARCHITECTURE.md §9](../seo/SEO_ARCHITECTURE.md#9-ai-search--llm-readiness)).

**Not in scope:** RAG never quotes prices, never confirms availability, never commits to lead times or terms. Those are commercial commitments that belong to a human — an assistant that hallucinates an MOQ costs more than it saves.

---

## 2. The Governing Rule: Allow-List, Not Deny-List

**The single most important decision in this document.**

The instruction "never index JobApplication, CVs, personal submissions, private customer data" describes a _deny-list_. A deny-list **fails open**: when a new entity is added to the data model six months from now, it is indexed by default, and someone has to remember to exclude it. Given what's in this database — CVs, customer confidential specifications, lead contact details — failing open once is a data breach, not a bug.

**Therefore: indexing operates on an explicit allow-list.** A source is indexed only if it appears in §3. Anything not named there — including anything added later — is excluded by default and stays excluded until someone deliberately adds it, with review. §4's forbidden list is a restatement for clarity and a tripwire, **not** the mechanism.

Practically: the ingestion process must not accept "everything from endpoint X." It enumerates named, allow-listed sources, and a new source requires a documented change to §3.

---

## 3. Allowed Knowledge Sources

Every entry below is **public content** — already visible to any anonymous visitor on the website. That is the defining test.

| Source                                 | Owner                                            | Indexed subset                     | Notes                                                                                                                   |
| -------------------------------------- | ------------------------------------------------ | ---------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| **Products**                           | Prisma                                           | `name`, `slug`, `description`      | Published products only                                                                                                 |
| **Specifications**                     | Prisma                                           | `key`, `value`, `unit` per product | The highest-value source in the corpus — structured facts retrieve and cite far more reliably than prose                |
| **Categories**                         | Prisma                                           | `name`, `slug`, hierarchy          | Provides the taxonomy that grounds "which category is this in"                                                          |
| **Blog / Insights articles**           | Prisma                                           | `title`, `content`                 | **Only where `publishedAt` is set and in the past.** Scheduled-future and draft posts excluded                          |
| **Product category editorial content** | Payload (`ProductCategoryContent`)               | Published fields                   | Overview, applications, industries-served, packaging copy                                                               |
| **Company/brand page content**         | Payload (Globals)                                | Published fields                   | Home, About Us, Customized Solutions, Export & Logistics, Quality & Certifications, Contact Us                          |
| **FAQ entries**                        | Payload (`FaqEntries`)                           | Published Q&A pairs                | Purpose-built Q&A — ideal retrieval material                                                                            |
| **Certifications**                     | Payload (`Certifications`)                       | **Published only**                 | See the hard rule below                                                                                                 |
| **Legal pages**                        | Payload (`Pages`)                                | Published content                  | Terms, Privacy, Cookie Notice, Sales Conditions                                                                         |
| **Public technical documents**         | Prisma `Media` — **`ownerType: 'Product'` only** | TDS, SDS text                      | Public and ungated by decision ([DATA_MODEL_GAP_REVIEW.md](../DATA_MODEL_GAP_REVIEW.md)); see the `Media` warning in §4 |

### Two hard rules on published state

**Unpublished means unindexed, without exception.** Payload's draft/publish state and `BlogPost.publishedAt` are the authority. A draft is by definition _not approved content_, and an assistant citing an unpublished draft leaks editorial work-in-progress into a customer conversation.

**Certifications are the sharpest case.** [PAYLOAD_CONTENT_ARCHITECTURE.md](../content/PAYLOAD_CONTENT_ARCHITECTURE.md) gives them an Admin-only publish gate specifically because the source document warns that a buyer who checks a claimed certification and finds nothing will not come back. An unpublished certification is very likely a placeholder. **An AI assistant asserting Sam Group holds ISO 9001 when that record was never Admin-approved is the exact failure the publish gate was built to prevent** — and it would arrive with more authority than a webpage, because a user asked and got a direct answer. Index published certifications only, and when one is unpublished or expires, its vectors must be removed immediately (§10).

---

## 4. Forbidden Data Sources

Never indexed, at any tier, under any capability. These are not "restricted to internal users" — they are **absent from every corpus**.

| Never index                               | Why                                                                                                                                                                                    |
| ----------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **`JobApplication`**                      | Admin-only by design ([SECURITY.md](../SECURITY.md)). No assistant use case justifies putting applicant data in a retrieval corpus                                                     |
| **CV files** (`JobApplication.cvMediaId`) | The most sensitive assets in object storage                                                                                                                                            |
| **`Inquiry`** (incl. Sample Requests)     | Personal contact details, free-text customer messages                                                                                                                                  |
| **`CustomFormulationRequest`**            | Contact details **plus the customer's own confidential technical specifications**                                                                                                      |
| **`DistributorApplication`**              | Contact details, commercial business data (volumes, storage capacity, brands carried)                                                                                                  |
| **`DownloadRequest`**                     | Lead contact details                                                                                                                                                                   |
| **`NewsletterSubscription`**              | Email addresses                                                                                                                                                                        |
| **`User`, `Organization`**                | Account and identity data                                                                                                                                                              |
| **`StatusHistory`**                       | Audit trail referencing all of the above                                                                                                                                               |
| **Per-batch COA documents**               | Certificate of Analysis is issued **per batch, per customer shipment** — customer-specific documentation, not public product literature, even though it sits near TDS/SDS conceptually |
| **Anything not listed in §3**             | Per the allow-list rule (§2)                                                                                                                                                           |

### The `Media` table is the trap

**`Media` is polymorphic** ([DATA_MODEL.md](../DATA_MODEL.md)) — `ownerType`/`ownerId` — and it holds, in one table:

- Product images and public TDS/SDS documents → **allowed**
- `Inquiry.attachmentMediaId` → customer-uploaded files → **forbidden**
- `CustomFormulationRequest.attachmentMediaId` → **customer confidential specifications** → **forbidden**
- `JobApplication.cvMediaId` → **CVs** → **forbidden**

A naive implementation — "index every document in MinIO," or "index the `Media` table" — sweeps up CVs and customers' confidential formulation specs in a single pass. **`ownerType` filtering is mandatory and must be an allow-list (`ownerType == 'Product'`), never a deny-list.** This is the most likely way this system gets built wrong, so it is stated here as its own rule rather than buried in a field list.

### Why exclusion beats access-control here

For personal data, _not indexing_ is meaningfully safer than _indexing with permission filters_:

- **Retention/erasure works.** Deleting a `JobApplication` under a retention policy or a data-subject request ([SECURITY.md](../SECURITY.md#personal-data-retention)) deletes the record — but an embedding of that CV in a vector store is a separate copy, in a system with no deletion workflow of its own. Personal data in a vector store is personal data you will struggle to erase on demand.
- **Prompt injection can't extract what isn't there.** A permission filter is code that can have a bug. An empty corpus cannot leak.
- **Embeddings are not anonymization.** A vector derived from a CV is still personal data under GDPR.

---

## 5. Indexing Pipeline

Five stages, each with a defined failure behavior. Fails **closed** throughout: any stage that cannot verify a source's allow-list eligibility or published state drops that item rather than indexing it.

```
[1] SOURCE ENUMERATION        allow-listed sources only (§3), via GET /api/v1/rag/export
        │                     never "everything"; never a direct DB connection
        ▼
[2] ELIGIBILITY FILTER        published? allow-listed ownerType? locale active?
        │                     ── fails closed: unverifiable → dropped, logged
        ▼
[3] EXTRACTION & NORMALIZATION  PDF/rich-text → plain text, structure preserved
        │
        ▼
[4] CHUNKING                  strategy per content shape (§6)
        │
        ▼
[5] EMBED & UPSERT            vector + metadata → isolated vector store (§8)
                              tombstone anything no longer eligible
```

**Stage 1 never touches a database directly.** Per [RAG_ARCHITECTURE.md §0](./RAG_ARCHITECTURE.md#0-governing-rule), RAG consumes `/api/v1/rag/export` like any other API client. This is not ceremony: it means the NestJS layer — which already knows what "published" means and already enforces RBAC — is the thing deciding what leaves the database, rather than an indexer with its own copy of that logic that can drift.

**Stage 2 is where the allow-list is enforced in practice**, and it is deliberately redundant with the API's own filtering. If the export endpoint is ever changed carelessly, this stage still refuses unknown sources. Defense in depth on the boundary that matters most.

---

## 6. Document Processing Flow

Chunking follows content shape, not one global size:

| Content                                                | Approach                                                                                                  | Rationale                                                                                                                      |
| ------------------------------------------------------ | --------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| **Product + Specifications**                           | One chunk per product; specifications kept as labeled `key: value unit` facts, never flattened into prose | "Viscosity Index: 95–105" retrieves and cites precisely; "the viscosity index is around 95 to 105" does not                    |
| **TDS / SDS documents**                                | Section-based with overlap; section heading retained as chunk metadata                                    | Enables "per §4 of the SDS" style citation                                                                                     |
| **Blog articles / long-form pages**                    | Semantic/paragraph chunking with overlap                                                                  | Standard prose handling                                                                                                        |
| **FAQ entries**                                        | **One chunk per Q&A pair, never split**                                                                   | A question separated from its answer is worse than useless — it retrieves as a confident-looking fragment with no answer in it |
| **Short CMS fields** (nav labels, button text, footer) | **Not indexed at all**                                                                                    | Site chrome, not knowledge. Indexing it dilutes retrieval quality without adding answers                                       |

**Every chunk carries provenance metadata**, non-negotiable: source type, source ID, locale, published-at, and a resolvable URL. Without it the system cannot cite, and an uncitable answer about a technical specification is not usable in a B2B context — a blender needs to check the claim against the actual TDS.

---

## 7. Embedding Strategy

No model or provider is chosen here. The requirements it must satisfy:

- **Multilingual across `en`, `fa`, `ar`** — the three confirmed launch locales ([INTERNATIONALIZATION_STRATEGY.md](../i18n/INTERNATIONALIZATION_STRATEGY.md)), including two RTL languages. This is a real constraint that eliminates several otherwise-good English-first models.
- **Headroom for future locales**, since the i18n architecture explicitly supports adding languages by configuration.
- **Stable versioning.** Changing embedding model = re-embedding the entire corpus. Vectors from two model versions are not comparable, so the model version is recorded per vector and a change triggers a full rebuild, not an incremental update.

### Locale strategy

Each locale's content is embedded and stored **separately**, tagged with its locale. Two viable approaches, both acceptable, decided at implementation:

- **Shared multilingual space** — a Persian query can retrieve semantically similar English content directly. Better coverage when a locale's corpus is thin; risks cross-language noise.
- **Per-locale spaces with query-time translation** — cleaner separation, more moving parts.

**Machine-translated content is a real concern here.** `ContentTranslation.translationStatus` distinguishes `machine_draft` from `human_reviewed`. Recommendation: **index `human_reviewed` content preferentially, and never let a `machine_draft` be the sole basis of an answer about product specifications, certifications, or commercial terms** — the exact categories the approved translation workflow already requires human review for. A machine-translated viscosity spec presented as authoritative is a technical-accuracy risk, not just a language-quality one.

---

## 8. Vector Database Strategy

**Isolated store, always.** Never `sam_platform`, never `sam_cms`. This extends ADR-002's reasoning to a third independent concern.

Two acceptable shapes, decided at implementation:

| Option                                                                                 | For                                                                                                                                                                 | Against                                                                    |
| -------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| **`pgvector` in its own database** (e.g. `sam_vector`) on the existing Postgres server | Reuses existing operational tooling — same backups, same monitoring, same DBA knowledge. Consistent with the "separate database per concern" pattern already in use | Fewer purpose-built retrieval features (hybrid search, advanced filtering) |
| **Dedicated vector database** (Qdrant / Weaviate / Milvus / managed)                   | Native hybrid search, richer metadata filtering, built for scale                                                                                                    | One more service to run, monitor, secure, and back up                      |

**Decision criteria, in order:** (1) does it support metadata filtering on locale + source type + published state — non-negotiable for §9; (2) operational cost at this corpus size, which is modest — hundreds to low thousands of documents, not millions; (3) hybrid search, which matters here because exact-term queries ("SN 500", "ISO VG 46", "15W-40") are common in this domain and pure semantic similarity under-ranks exact matches.

**Required metadata per vector** regardless of choice: `sourceType`, `sourceId`, `locale`, `publishedAt`, `embeddingModelVersion`, `contentHash`, `url`.

---

## 9. Retrieval Permissions

**Phase 1 has exactly one corpus, and it is entirely public.** Every source in §3 is content an anonymous visitor can already read. This is a deliberate simplification with a real security payoff: there is no permission-filtering logic to get wrong, because there is nothing in the corpus that any user is forbidden to see.

Retrieval filters therefore operate on **relevance and correctness**, not confidentiality:

- **Locale** — retrieve the query's language (see §7 for cross-language fallback).
- **Published state** — enforced at index time (§5), re-checked at retrieval as a safety net. Cheap, and it catches the window between "content unpublished" and "vectors tombstoned."
- **Source type** — a product-search capability need not retrieve legal pages.

### The rule that survives adding an internal tier

If an internal corpus is ever added, one rule holds regardless: **permission filtering happens before context assembly, never only before display.** Once a chunk is in the model's context window, a sufficiently clever prompt can extract it no matter what the UI shows. Filtering at render time is not filtering.

Adding an internal tier would require, at minimum: per-chunk permission tags derived from [SECURITY.md](../SECURITY.md)'s RBAC matrix, authenticated retrieval requests carrying the caller's role, and physically separate indexes rather than one index with a flag. **That work is not in Phase 1 and should not be half-built in advance** — a partially-implemented permission model is more dangerous than none, because it looks like protection.

---

## 10. Data Refresh and Synchronization

### Incremental (default)

`GET /api/v1/rag/export?since=<timestamp>&locale=<locale>` returns content changed since the last run. Each item's `contentHash` is compared against the stored vector's hash; unchanged items are skipped, changed items are re-embedded, and the superseded vector is removed.

### Tombstoning — the part that gets forgotten

**Content leaving the allow-list must remove its vectors, and this is as important as adding them.** Three cases, all real:

1. **Unpublished** — a certification withdrawn or expired. If its vectors survive, the assistant keeps asserting a certification the company no longer holds. This is the failure mode §3's hard rule exists to prevent, and it happens _after_ successful indexing, so index-time checks alone don't catch it.
2. **Deleted** — a discontinued product still being recommended to buyers.
3. **Newly excluded** — a source removed from §3 must have its entire corpus purged, not merely stopped from updating.

The export endpoint must therefore report **deletions and unpublications**, not only changes. An export that returns "what's currently published" without saying "and these are gone" produces a corpus that only ever grows and silently accumulates stale claims.

### Full rebuild

Triggered by: an embedding model change (§7), a chunking strategy change, or on a periodic schedule as a reconciliation net against missed incremental updates. Rebuild into a new index and swap on completion — never delete-then-rebuild, which leaves the assistant answering from an empty corpus during the window.

### Freshness expectations

CMS content changes infrequently; products and specifications change more often but not by the minute. **Near-real-time indexing is not a requirement** and shouldn't be engineered for — a scheduled incremental run is sufficient, and simpler to reason about than an event-driven pipeline whose failure modes are harder to observe.

---

## 11. Security and Privacy Rules

1. **Allow-list, never deny-list** (§2). New entities are excluded until deliberately added.
2. **No personal data in the corpus, ever** (§4). Not filtered — absent.
3. **`Media` is filtered by `ownerType` allow-list** (§4). The single most likely implementation mistake.
4. **Published state is authoritative.** Drafts and unpublished certifications never indexed.
5. **RAG holds no credentials to `sam_platform`, `sam_cms`, or MinIO.** It authenticates to the NestJS API as a service client with read-only scope on `/api/v1/rag/*`. A compromised RAG service must not become a database compromise.
6. **Retrieval filtering precedes context assembly**, never only display (§9).
7. **The vector store is protected like a database**, because it is one: network-isolated, credentialed, encrypted at rest, backed up. It is not a cache.
8. **Every answer cites its sources.** In a technical B2B context an uncitable claim about a specification is unusable — the buyer needs to verify it against the TDS.
9. **The assistant states uncertainty rather than inventing.** No prices, no availability, no lead times, no MOQs, no commercial commitments (§1) — a hallucinated MOQ is a commercial problem, not a technical one.
10. **Queries are logged without personal data.** Query logs are useful for improving retrieval, but a user who types their email or company details into a chat box has just put personal data in a log — [SECURITY.md](../SECURITY.md)'s "no sensitive personal data in logs" rule applies here, and needs active scrubbing rather than assumption.

---

## Open Decisions (deferred to implementation, deliberately)

1. Vector store: `pgvector` vs. dedicated (§8).
2. Embedding model/provider — must cover `en`/`fa`/`ar` (§7).
3. LLM provider for response generation.
4. Locale embedding approach: shared multilingual space vs. per-locale (§7).
5. Deployment shape: `apps/rag` in this monorepo vs. a separate service — architecturally irrelevant per [RAG_ARCHITECTURE.md §0](./RAG_ARCHITECTURE.md#0-governing-rule), operationally a real choice.

## Prerequisites Before Any of This Is Built

RAG is a **future phase**, and these are genuinely blocking, not paperwork:

- **Content must exist.** There is no Phase 1 content in the database yet. A retrieval system over an empty corpus is untestable.
- **`GET /api/v1/rag/export` must be added** to [API_DESIGN.md](../API_DESIGN.md) and built — the only change to the current platform this ever requires, and purely additive.
- **The `[TO CONFIRM]` items must be resolved** ([SITE_STRUCTURE.md](../SITE_STRUCTURE.md#outstanding-confirmations-needed)). Indexing placeholder specifications and estimated statistics would train an assistant to confidently state figures explicitly marked as unverified — worse than having no assistant.
- **Certifications must be real and Admin-published** before that source is indexed (§3).
