# Data Model Gap Review

Review of every data-capture point in the approved website structure against the current Prisma model. **No schema is defined here, no Prisma code is written, no approved architecture is changed** — this identifies gaps and recommends where each belongs. Field lists below are the _required shape_, not a migration.

> **Status: all findings reviewed and approved.** Every gap below is now resolved by a decision — see the [Decisions Log](#decisions-log). The approved entity shapes have been carried into [DATA_MODEL.md](./DATA_MODEL.md) and [DATABASE.md](./DATABASE.md), which are now authoritative. This document is retained as the analysis record and the reasoning behind each decision.

Sources reconciled: [DATA_MODEL.md](./DATA_MODEL.md), [DATABASE.md](./DATABASE.md), [SITE_STRUCTURE.md](./SITE_STRUCTURE.md), [content/PAYLOAD_CONTENT_ARCHITECTURE.md](./content/PAYLOAD_CONTENT_ARCHITECTURE.md), and the source spreadsheet itself where the site structure summarizes rather than quotes it.

---

## Summary

| #   | Gap                                                                                   | Prisma or Payload              | Outcome                                                |
| --- | ------------------------------------------------------------------------------------- | ------------------------------ | ------------------------------------------------------ |
| 1   | `CustomFormulationRequest` — **no email/phone field at all**                          | Prisma (fix existing)          | ✅ 5 fields added                                      |
| 2   | `Inquiry` — missing 2 fields                                                          | Prisma (fix existing)          | ✅ 6 fields added (2 from the form + 4 from the merge) |
| 3   | `DistributorApplication` — entity missing                                             | Prisma (new)                   | ✅ Approved                                            |
| 4   | `JobApplication` — entity missing                                                     | Prisma (new)                   | ✅ Approved, **Admin-only**                            |
| 5   | `DownloadRequest` — entity missing, **explicitly required by the source document**    | Prisma (new)                   | ✅ Approved, **catalogues only**                       |
| 6   | `NewsletterSubscription` — entity missing, **not previously tracked in any gap list** | Prisma (new)                   | ✅ Approved for Phase 1                                |
| 7   | `SampleRequest` — keep, or fold into `Inquiry`?                                       | Prisma (decision)              | ✅ **Merged into `Inquiry`**                           |
| 8   | Personal-data retention undefined                                                     | Policy, not schema             | ✅ Recorded as a requirement; periods pending legal    |
| —   | FAQ content                                                                           | **Payload** (`FaqEntries`)     | Resolved — not a Prisma gap                            |
| —   | Certifications                                                                        | **Payload** (`Certifications`) | Resolved — not a Prisma gap                            |
| —   | Request-a-Quote workflow                                                              | **No new entity** — see §8     | Resolved — pre-filtered `Inquiry`                      |

Two gaps previously listed in [SITE_STRUCTURE.md](./SITE_STRUCTURE.md#data-model-gaps-surfaced-by-this-structure) (FAQ content, Certifications) are **closed by the approved Payload architecture** — both are editorial content, correctly Payload-owned, and need nothing in Prisma. Two gaps are **newly found in this review** (#5, #6) and appear in no prior gap list.

---

## 1. `CustomFormulationRequest` — missing contact fields (**critical**)

**The most serious finding in this review.** The entity currently has no `email` and no `phone` field. A customer submits a detailed formulation request — specifications, quantities, packaging, an uploaded technical document — and **there is no way to reply to them.** The form collects contact details ([SITE_STRUCTURE.md §5](./SITE_STRUCTURE.md#5-customized-solutions)); the entity discards them.

**Required additions:**

| Field                | Type                       | Notes                                                                                                                       |
| -------------------- | -------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `email`              | string, **required**       | Form marks it required; currently absent entirely                                                                           |
| `phone`              | string, nullable           | "Phone / WhatsApp" — WhatsApp is the primary channel for international customers ([PROJECT_VISION.md](./PROJECT_VISION.md)) |
| `destinationCountry` | string, nullable           | "Target market / destination country"                                                                                       |
| `preferredIncoterm`  | enum-like string, nullable | `EXW`/`FOB`/`CFR`/`CIF`                                                                                                     |
| `consentGiven`       | boolean, required          | Consent checkbox linked to Privacy Policy — legally required before this form can collect data at all                       |

**Relationships:** unchanged — optional `userId`, optional `assignedToId` (Sales Expert), `attachmentMediaId` → `Media`, `StatusHistory`.
**Ownership:** **Prisma.** Transactional submission data, not editorial content.

> **Current-schema correction — required fields.** The table above lists the fields this review _added_; it is not the entity's required set, and reading it as one understates that set. As migrated, `custom_formulation_requests` declares **seven** columns NOT NULL: `companyName`, `country`, `industry`, `email`, `productOrApplication`, `requiredSpecifications`, `consentGiven`. Those are the operational persistence contract, and both `POST /custom-formulation-requests` and the public form require all seven — accepting a submission the database then refuses, or writing `""` into a NOT NULL column, are the only alternatives and both are worse. No schema change was made and none is proposed: relaxing any of these is a migration and a decision of its own.

---

## 2. `Inquiry` — missing 2 fields

Already flagged in `SITE_STRUCTURE.md`; restated with exact shape.

| Field                    | Type                       | Notes                                                                                                            |
| ------------------------ | -------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `destinationCountryPort` | string, nullable           | Distinct from the existing `country` (buyer's own country ≠ where goods ship)                                    |
| `preferredIncoterm`      | enum-like string, nullable | `EXW`/`FOB`/`CFR`/`CIF`/`Not sure` — note the extra "Not sure" option the Customized Solutions form doesn't have |

**Also worth resolving while this entity is open:** `productsOfInterest` is currently a single `string`, but the form is a **multi-select** across 9 options. A delimited string makes "which inquiries mentioned Marine Lubricants?" unqueryable. Recommend a string array or a join table. Minor, but cheaper to fix now than after real submissions exist.

**Ownership:** **Prisma.**

---

## 3. `DistributorApplication` — new entity

**Purpose:** Captures the Become a Distributor application ([SITE_STRUCTURE.md §11](./SITE_STRUCTURE.md#11-careers--partners--new-page)). Distinct from `Inquiry` despite superficial similarity: it collects business-qualification data (volumes, storage capacity, existing brands) that has no meaning on a general inquiry, and it feeds a different commercial process — partner vetting, not a sales quote.

**Required fields:** `companyName`\*, `contactPerson`\*, `countryTerritory`\*, `email`\*, `phone`\* (Phone/WhatsApp — required here, unlike other forms), `website`, `yearsInBusiness`, `currentProductLines`, `sectorsServed`, `estimatedAnnualVolume`, `storageCapacity`, `brandsCurrentlyDistributed`, `additionalInformation`, `consentGiven`\*, `status`, `assignedToId`, `createdAt`.

**Relationships:** `assignedToId` → `User` (Sales Expert — consistent with how `Inquiry`/`CustomFormulationRequest` route leads); `StatusHistory` (polymorphic, existing pattern); no `Media` attachment — the form has no upload.

**Ownership:** **Prisma.** Same family as `Inquiry`/`CustomFormulationRequest`, follows their established shape rather than inventing a new pattern.

---

## 4. `JobApplication` — new entity

**Purpose:** Captures both a response to a listed vacancy and a speculative CV submission ([SITE_STRUCTURE.md §11](./SITE_STRUCTURE.md#11-careers--partners--new-page)).

**Required fields:** `firstName`\*, `lastName`\*, `email`\*, `phone`, `jobOpeningKey` (nullable — **null means speculative application**, no listed role), `coverLetter` (text), `cvMediaId`, `consentGiven`\*, `status`, `createdAt`.

**Relationships:** `cvMediaId` → `Media` (`ownerType: 'JobApplication'`, stored in MinIO — same pattern as existing form attachments); `jobOpeningKey` → Payload's `JobOpenings` collection **as a soft key, not a foreign key** (cross-database per ADR-002, resolved by NestJS — identical to `ProductCategoryContent.categoryKey`); `StatusHistory`.

**Ownership:** **Prisma.** Personal-data submission, not content.

**Two issues this surfaced, both now resolved:**

- **No role existed to manage these.** [SECURITY.md](./SECURITY.md)'s RBAC matrix had Admin, Content Manager, Sales Expert, Customer — none an appropriate owner for CVs. **Decided: Admin-only.** Content Manager and Sales Expert both get `none`, not read; a Sales Expert handling job applications is wrong on function and exposes applicant personal data to a team with no business need. Consequently `JobApplication` carries **no `assignedToId`**, unlike every other submission entity. A future HR/Recruiter role gets its own matrix row rather than widening an existing one.
- **CVs are the most sensitive personal data on the platform**, and no retention policy existed. **Decided: retention is now a recorded requirement** — see [SECURITY.md's Personal Data Retention section](./SECURITY.md#personal-data-retention). Concrete periods still need legal input, tracked as a remaining blocker in §11.

---

## 5. `DownloadRequest` — new entity (**newly found**)

**Not "if needed" — explicitly required by the source document**, which states for the Products Documentation block: _"Gate the full catalogue behind a short form (name, company, country, email) so the sales team gets a qualified lead from each download."_ Lead capture from downloads is a stated business requirement, not an optional analytics nicety. Download CTAs appear on the Products landing, all six category pages, Quality & Certifications, and the Thank You page.

**Purpose:** Captures the qualifying form gating document downloads, producing a sales lead per download and a record of who accessed which document.

**Required fields:** `firstName`/`lastName` (or a single `name` — the source says "name"), `companyName`\*, `country`\*, `email`\*, `documentKey` (which asset was requested — catalogue, a specific TDS/SDS, certificate pack), `documentType` (catalogue / TDS / SDS / certificate), `consentGiven`, `createdAt`, `assignedToId` (nullable — these are leads).

**Relationships:** `documentKey` resolves to either a Prisma `Media` record (product-specific TDS/SDS) or a Payload upload (company-wide catalogue) — deliberately a **string key, not a foreign key**, because the target lives on either side of the ADR-002 split. Optional `assignedToId` → `User`.

**Ownership:** **Prisma.** This is lead data, unambiguously. The _documents_ stay where the approved media boundary puts them (Prisma `Media` for product docs, Payload uploads for company-wide assets) — only the _access record_ is new.

**Decided — gating scope is narrow:** only the **Company Catalogue** and **Product Catalogue** are gated. **TDS and SDS are explicitly not gated.** Those are the technical documents that build buyer trust, and putting a form in front of them adds friction exactly where it costs most — a blender evaluating a base oil spec shouldn't have to fill in a form to read a viscosity table. `documentType` is scoped to the two catalogue types accordingly.

---

## 6. `NewsletterSubscription` — new entity (**newly found, in no prior gap list**)

The source document specifies a newsletter sign-up field in the footer of **every page** (Global Components, Footer Column 5) and a "Subscribe to Updates" CTA on the Insights index. No entity exists, and no prior gap list — including `SITE_STRUCTURE.md`'s own — caught it.

**Purpose:** Email capture for the newsletter.

**Required fields:** `email`\*, `locale` (which language to send in — the site ships in `en`/`fa`/`ar`), `status` (pending / confirmed / unsubscribed), `confirmedAt`, `unsubscribedAt`, `consentGiven`, `source` (footer / insights page — useful for knowing what converts), `createdAt`.

**Relationships:** none. Deliberately standalone — a subscriber is not a `User` and shouldn't be forced into one.

**Ownership:** **Prisma.**

**Two things worth flagging:**

- **Double opt-in should be assumed, not added later.** The `pending`/`confirmed` status split above exists for that reason. For a business targeting European buyers (and `SITE_STRUCTURE.md` lists Europe as a served market subject to REACH/GDPR), single opt-in is a real compliance risk. Cheap now; a data-cleanup exercise later.
- **Decided: Prisma owns it for Phase 1.** An external email service (Mailchimp, Brevo, etc.) remains a reasonable later addition — at which point this entity becomes either the system of record that syncs outward, or a thin local mirror. Deferred, not ruled out. Building it in Prisma now avoids blocking the footer sign-up field on a vendor selection.

---

## 7. `SampleRequest` — resolved: merged into `Inquiry`

The long-standing open thread ([SITE_STRUCTURE.md](./SITE_STRUCTURE.md#request-sample-form--resolved)). Restated as a data-model question, since that's what it now is:

"Request Sample" appears as a CTA on the Products landing, every product category page, and Quality & Certifications — but **no source sheet defines a Sample Request form with its own fields**, unlike the other two forms which are fully specified. The evidence points to it being an `Inquiry` submission (`inquiryType: 'Product Inquiry'` or a new `'Sample Request'` value) with the product pre-filled, not a separate entity.

**Two viable paths:**

- **A — Fold into `Inquiry`** (recommended): add `Sample Request` to `inquiryType`, add a nullable `relatedProductKey`. Drops one entity, keeps every sample lead in the same queue Sales already works. Matches the observed evidence.
- **B — Keep `SampleRequest`**: justified only if sample fulfilment is a genuinely distinct operational workflow (dispatch, tracking, lab feedback) rather than a lead type. Nothing in the source document suggests it is.

**Decided: path A.** `SampleRequest` is removed from `DATA_MODEL.md`; `Inquiry` gains `Sample Request` as an `inquiryType` value and `relatedProductId` to carry what `SampleRequest.productId` did. See the Decisions Log for the lead-routing consequence this surfaced.

---

## 8. Request-a-Quote workflow — no new entity

Confirmed, not a gap. `/contact-us/request-a-quote` is a **pre-filtered version of the main Inquiry form** ([SITE_STRUCTURE.md §0](./SITE_STRUCTURE.md#0-full-sitemap)), and "Request a Quote" is already an `inquiryType` value on `Inquiry`. A structured `Quote` entity (line items, pricing, validity, revisions) remains a **Customer Portal future module** per [DATA_MODEL.md §2](./DATA_MODEL.md#2-future-modules--planned-entities-not-implemented-in-phase-1) — building one now would be exactly the speculative future-phase infrastructure [AI_CONTEXT.md](../AI_CONTEXT.md)'s constraints rule out.

**Nothing to add.** The route needs frontend work (pre-filling the form), not a data model change.

---

## 9. Confirmed as Payload, not Prisma

For completeness, since both appeared in earlier Prisma gap lists and are now resolved on the Payload side:

- **FAQ content** → `FaqEntries` collection. Editorial content, reused across `/faq`, product pages, and Contact Us.
- **Certifications** → `Certifications` collection, with the approved Admin-publish gate.
- **Cookie consent choice** → **neither.** The banner "remembers the choice" client-side (cookie/localStorage). A server-side consent-proof record is only warranted if legal counsel requires demonstrable consent logs — worth asking during the Privacy Policy work, not worth pre-building.

---

## 10. Decisions Log

All five decisions this review raised are resolved:

1. **`SampleRequest` merges into `Inquiry`.** No separate entity. "Request Sample" CTAs submit an `Inquiry` with `inquiryType: 'Sample Request'` and `relatedProductId` set. Matches the evidence — the content source never defined a distinct sample form.
   _Consequence found while applying this:_ `Inquiry` was missing `assignedToId` and `userId`, both of which `SampleRequest` had. Without adding them, the merge would have silently dropped lead routing for every sample request. Both added.
2. **`JobApplication` is Admin-only.** CV handling is deliberately not assigned to Sales roles — a job application is not a sales lead, and routing it to a Sales Expert would expose applicant personal data to a team with no business need for it. `JobApplication` therefore carries **no `assignedToId`**, unlike every other submission entity. [SECURITY.md](./SECURITY.md)'s RBAC matrix updated with a dedicated Job Applications column (Admin: full; Content Manager and Sales Expert: none). A future HR/Recruiter role would get its own row rather than widening an existing one.
3. **`NewsletterSubscription` is a Prisma entity for Phase 1.** External email-provider integration deferred, not ruled out — the `status`/`confirmedAt` shape supports double opt-in from the start, which is the part that's expensive to retrofit.
4. **Download gating is limited to the Company Catalogue and Product Catalogue.** TDS and SDS are **not** gated — those are the technical documents that build buyer trust, and a form in front of them adds friction exactly where it costs most. `DownloadRequest.documentType` is scoped accordingly.
5. **Personal-data retention is recorded as a requirement.** CVs and all personal submissions need defined retention rules — see the new [Personal Data Retention](./SECURITY.md#personal-data-retention) section in `SECURITY.md`. The _requirement_ is approved; the _concrete periods_ still need legal input and are tracked as a remaining blocker below.

---

## 11. Remaining Blockers Before Implementation

No decisions remain. What's left is external input and sequencing:

**Legal (blocks launch, not schema work):**

- Concrete retention periods per entity, and confirmation of whether GDPR formally applies. Should be settled in the same pass as the Privacy Policy, which is already a launch blocker. Until then, no `retentionExpiresAt` field is added — guessing a period is worse than leaving the field out.
- Privacy Policy itself: the consent checkbox on every form above is legally inert without a policy to consent _to_. This blocks form launch, not form modeling.

**Content (blocks specific features, not the model):**

- The `[TO CONFIRM]` items in [SITE_STRUCTURE.md](./SITE_STRUCTURE.md#outstanding-confirmations-needed) — MOQ, lead times, contact details, real certifications.
- `JobOpenings` content in Payload: `JobApplication.jobOpeningKey` points at it, so vacancy-linked applications need at least one real listing (speculative applications work without one, since the key is nullable).

**Sequencing (dependency order, not a schedule):**

1. **`CustomFormulationRequest` and `Inquiry` first** — both are live Phase 1 forms in M4, and the missing `email` on the former is a functional defect. `Inquiry` must land with `relatedProductId` before any "Request Sample" CTA ships, or those submissions arrive unattributable to a product.
2. **`DistributorApplication` and `DownloadRequest`** — confirmed requirements, no dependencies.
3. **`NewsletterSubscription`** — independent of everything else; needs a double-opt-in confirmation email flow, which is the only genuinely new mechanism among these entities.
4. **`JobApplication` last** — Careers is optional at launch, and it's the entity with the heaviest privacy obligations, so it benefits most from the retention policy landing first.

All six new/changed entities follow patterns this model already uses (polymorphic `StatusHistory`, `Media` attachments via MinIO, soft keys across the ADR-002 split, optional `assignedToId` for lead routing). **Nothing here required a new architectural pattern** — the main thing worth confirming in a gap review of this size.
