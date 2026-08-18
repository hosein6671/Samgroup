# Site Structure (Phase 1)

**Source of truth (superseding the earlier simplified version):** [`content/Sam Group Website Structure - Completed.xlsx`](./content/Sam%20Group%20Website%20Structure%20-%20Completed.xlsx) — a 23-sheet, launch-ready expansion of the original 7-sheet file. Per its own "READ ME FIRST" sheet: nothing from the original was removed, thin sections were expanded, and new sheets were added (full per-category product pages, Quality & Certifications, Blog & Insights editorial plan, FAQ, Careers & Partners, Legal Pages, Global Components, and an SEO Master sheet). The old `content/Sam Group Website Structure_v2.xlsx` is kept for history only — **do not build against it.** If this document and the spreadsheet ever disagree, the spreadsheet wins.

This is **content and information architecture, not implementation** — same ground rules as before. Legend: **[CMS]** = Payload-managed content · **[DATA]** = backed by a Prisma entity · **[FORM]** = user-submitted · **[NEW]** = page/section that didn't exist in the previously-reconciled structure.

---

## 0. Full Sitemap

| Level | Page                                | URL                                           | Nav             | Status                                                                                              |
| ----- | ----------------------------------- | --------------------------------------------- | --------------- | --------------------------------------------------------------------------------------------------- |
| 1     | Home                                | `/`                                           | Yes (logo)      | Defined                                                                                             |
| 1     | About Us                            | `/about-us`                                   | Yes             | Defined                                                                                             |
| 1     | Products                            | `/products`                                   | Yes (mega-menu) | Defined                                                                                             |
| 2     | Base Oils                           | `/products/base-oils`                         | Yes (sub)       | Defined                                                                                             |
| 2     | Lubricant Additives & Components    | `/products/lubricant-additives`               | Yes (sub)       | Defined                                                                                             |
| 2     | Engine Oils & Automotive Lubricants | `/products/engine-oils-automotive-lubricants` | Yes (sub)       | Defined                                                                                             |
| 2     | Industrial Oils & Lubricants        | `/products/industrial-oils-lubricants`        | Yes (sub)       | Defined                                                                                             |
| 2     | Marine Oils & Lubricants            | `/products/marine-oils-lubricants`            | Yes (sub)       | Defined                                                                                             |
| 2     | Antifreeze & Coolants               | `/products/antifreeze-coolants`               | Yes (sub)       | Defined                                                                                             |
| 2     | Product Finder                      | `/products/finder`                            | No              | Defined                                                                                             |
| 1     | Customized Solutions                | `/customized-solutions`                       | Yes             | Defined                                                                                             |
| 1     | Export & Logistics                  | `/export-logistics`                           | Yes             | Defined                                                                                             |
| 1     | Quality & Certifications            | `/quality-certifications`                     | Yes             | **[NEW]** — blocked until real certificate list confirmed                                           |
| 1     | Insights (Blog index)               | `/insights`                                   | Yes             | **[NEW]**                                                                                           |
| 2     | Article                             | `/insights/[slug]`                            | No              | **[NEW]**                                                                                           |
| 1     | Contact Us                          | `/contact-us`                                 | Yes             | Defined                                                                                             |
| 2     | Request a Quote                     | `/contact-us/request-a-quote`                 | No (CTA)        | Defined — pre-filtered Inquiry form                                                                 |
| 1     | Become a Distributor                | `/become-a-distributor`                       | No (footer)     | **[NEW]**                                                                                           |
| 1     | FAQ                                 | `/faq`                                        | No (footer)     | **[NEW]** — feeds `FAQPage` schema                                                                  |
| 1     | Careers                             | `/careers`                                    | No (footer)     | **[NEW]** — optional at launch                                                                      |
| 1     | Privacy Policy                      | `/privacy-policy`                             | No (footer)     | **[NEW]** — legally required before the contact form can launch                                     |
| 1     | Terms of Use                        | `/terms-of-use`                               | No (footer)     | **[NEW]** — required                                                                                |
| 1     | Cookie Notice                       | `/cookie-notice`                              | No (footer)     | **[NEW]** — required if analytics/marketing cookies are used                                        |
| 1     | General Sales Conditions            | `/general-sales-conditions`                   | No (footer)     | **[NEW]** — recommended for B2B export                                                              |
| 1     | Sitemap (HTML)                      | `/sitemap`                                    | No (footer)     | **[NEW]**, plus `sitemap.xml` (already covered by [SEO_ARCHITECTURE.md](./seo/SEO_ARCHITECTURE.md)) |
| —     | 404 / Error                         | —                                             | No              | **[NEW]** — designed state with product links                                                       |
| —     | Thank You                           | `/thank-you`                                  | No              | **[NEW]** — post-submission, required for conversion tracking                                       |

27 pages total (was 6). Every product category page and every net-new page below still fits inside the frozen architecture — Prisma-owned catalog/blog data, Payload-owned everything else, NestJS as the only API surface (ADR-002/003) — nothing here changes that.

---

## 1. Home Page

| Section                      | Notes                                                                                                                                                                                                                                                                                                   |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Hero Section                 | Unchanged copy; primary CTA "Explore Our Products," secondary "Request a Quote"                                                                                                                                                                                                                         |
| Who We Are                   | Unchanged                                                                                                                                                                                                                                                                                               |
| Company Statistics           | **[NEW]** Six counter-style figures (25+ years, 30+ export destinations, 100,000+ tons capacity, 200+ formulations, 100% batch-tested, 24/7 support). Explicitly marked `[ESTIMATE — CONFIRM]` in the source — industry-plausible placeholders, **must be replaced with audited figures before launch** |
| Product Portfolio Overview   | Six product cards (one per category below), 3×2 grid                                                                                                                                                                                                                                                    |
| Why Choose Sam Group         | Unchanged 6-item grid                                                                                                                                                                                                                                                                                   |
| Industries We Serve          | **[Expanded]** now 7 industries (added Marine & Shipping, Agriculture/Construction/Mining)                                                                                                                                                                                                              |
| Custom Formulation Highlight | 5-step process teaser + note that a sample is issued at the first stage for both engine oil and base oil enquiries                                                                                                                                                                                      |
| Latest News / Insights       | Pulls 3 most recent posts from Blog; 4 suggested launch articles listed on the Blog & Insights sheet                                                                                                                                                                                                    |
| Footer                       | Full 5-column spec — see [§13 Global Components](#13-global-components)                                                                                                                                                                                                                                 |

---

## 2. About Us

**Not a static page.** Layout (section order, visual composition) is code, per [FRONTEND_ARCHITECTURE.md](./frontend/FRONTEND_ARCHITECTURE.md) — but every piece of editorial content below is Payload-managed and editable without a code change: text, images, video, company information, milestones, and each field's localized versions (`en`/`fa`/`ar`). This isn't specific to About Us — it's the general rule for every `[CMS]`-tagged section in this document (see [FRONTEND_ARCHITECTURE.md §10](./frontend/FRONTEND_ARCHITECTURE.md#10-payload-cms-data-fetching-strategy)) — About Us just happens to be where it matters most, because two of its sections are open-ended lists.

| Section                    | Notes                                                                                                                                                                                                                                                                                                             | CMS field shape                                                                                                                                            |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Hero Section               | Same as Home                                                                                                                                                                                                                                                                                                      | Text/rich-text + image/video fields                                                                                                                        |
| Who We Are                 | **[Expanded]** into 6 finished sub-sections: what Sam Group does, where it operates (Iran-based production; exports to Africa, neighboring markets, India, Turkiye, Middle East, Asia, Europe — `[ESTIMATE — CONFIRM]`), core categories, customers, direct-producer positioning, long-term B2B partnership focus | Rich text                                                                                                                                                  |
| Company Milestones         | **[NEW]** Timeline, 2000–2026, marked `[ESTIMATE — CONFIRM]` — replace every year/event with real company history                                                                                                                                                                                                 | **Repeater/array field** (year, title, description per entry) — an editor adds, removes, or reorders milestones directly; the count is never fixed in code |
| Our Expertise              | **[Expanded]** now 6 items (added Base Oil Processing / thin film polishing, Quality Laboratory)                                                                                                                                                                                                                  | Repeater/array field (icon, title, description)                                                                                                            |
| Our Competitive Advantages | Unchanged 6-item grid                                                                                                                                                                                                                                                                                             | Repeater/array field                                                                                                                                       |
| Quality & Standards        | **[NEW]** COA-per-batch, TDS/SDS, sample-before-commitment, batch traceability; `[TO CONFIRM]` actual certifications held                                                                                                                                                                                         | Rich text + repeater for the bullet list                                                                                                                   |
| Our Team                   | **[NEW]**, optional at launch — **blocked on photography** (see [§13](#13-global-components))                                                                                                                                                                                                                     | **Repeater/array field** (photo, name, role, bio per person) — same open-ended-list treatment as Milestones                                                |
| Final CTA                  | Unchanged                                                                                                                                                                                                                                                                                                         | Text + button fields                                                                                                                                       |

---

## 3. Products (Landing)

Hero ("A Complete Range of Petroleum Products") → six category cards (below) → **Product Finder** (filter by category/industry/application/packaging, search by grade name) → **Documentation** block (TDS/SDS/COA download, gated behind a short qualifying form) → bottom-of-every-product-page CTA ("Can't Find Exactly What You Need?" → Request Custom Solution / Request Sample).

---

## 4. Product Category Pages (P1–P6)

**Structural clarification, not in the previous version of this document:** each of the six product lines is **one rich category-level page**, not a category-listing-page-plus-per-SKU-detail-pages. All grades/SKUs within a category (e.g. SN 150, SN 350, SN 500, SN 650, BS 150 under Base Oils) are sections _within_ that one page (accordion or filterable table), not separately routed. See the [Data Model Gaps](#data-model-gaps-surfaced-by-this-structure) section below for what this implies for `Product`/`Category`.

**"Not separately routed" is superseded by [ADR-007](./ADR/ADR-007-product-taxonomy-v2.md) (accepted 12 August 2026); the rest of the paragraph above stands.** The **six Product Family pages remain** exactly as specified here, and grades continue to be presented as sections within them. What changed is that per-product detail pages are **additionally approved**, canonically at `/{locale}/products/{product-slug}`. **Decided — not implemented**: no product detail page exists, and the sitemap in §0, the page count, and the SEO Master table in §14 are deliberately left unchanged until that implementation is approved.

**Shared template** (every one of the six follows this exact structure):

1. Hero — product family name + scope + primary/secondary CTA (Request a Quote / Request Sample)
2. Overview — positioning as producer, not reseller
3. Product Range — sub-categories/grades, rendered as accordion or filterable table
4. Key Specifications — typical-properties table (grade × viscosity/VI/flash point/pour point/colour, test methods cited); marked `[ESTIMATE — CONFIRM]`, replace with real lab data
5. Processing & Quality (Base Oil only — Thin Film Polishing block) / Quality & Testing (all others)
6. Applications
7. Industries Served
8. Packaging & Supply (formats, MOQ/lead time `[TO CONFIRM]`, Incoterms)
9. Customization — links to Customized Solutions
10. Documentation (TDS/SDS/COA downloads)
11. FAQ (also feeds `FAQPage` schema per-page)
12. Product Page CTA (shared, per §3)

| Page                                | URL                                           | Distinguishing content                                                                                                                                                                              | Reference taxonomy                                                    |
| ----------------------------------- | --------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| Base Oils                           | `/products/base-oils`                         | Group I (SN 150/350/500/650), Group II, Group III, Naphthenic, Bright Stock (BS 150), Synthetics (PAO/Ester/PAG), Virgin & Re-refined grades; Thin Film Polishing named block                       | afzoonravan.com                                                       |
| Lubricant Additives & Components    | `/products/lubricant-additives`               | Additive packages by application (gasoline/diesel engine oil, driveline, gear, ATF, grease, anti-freeze, brake fluid, fuel) + lubricant components (transformer oil, white oil, rubber process oil) | afzoonravan.com                                                       |
| Engine Oils & Automotive Lubricants | `/products/engine-oils-automotive-lubricants` | Segmented by vehicle type (Passenger Cars, Trucks & Buses, Motorcycle & ATV, Agriculture, Construction & Mining, Gardening) × fluid type; sample issued at first stage of every enquiry             | wolflubes.com                                                         |
| Industrial Oils & Lubricants        | `/products/industrial-oils-lubricants`        | Hydraulic, gear, compressor, cutting/metalworking, heat transfer, pneumatic, slideway, stationary engine oils, industrial greases                                                                   | wolflubes.com                                                         |
| Marine Oils & Lubricants            | `/products/marine-oils-lubricants`            | TPEO, cylinder oils, system oils, stern tube/gear oils, deck hydraulic, marine greases                                                                                                              | wolflubes.com                                                         |
| Antifreeze & Coolants               | `/products/antifreeze-coolants`               | By base fluid (MEG/MPG) and inhibitor technology (IAT/OAT/HOAT/Si-OAT, NAP-free); concentrate or ready-to-use                                                                                       | No source reference — taxonomy derived from automotive reference site |

Every category page's FAQ, Documentation, and Customization sections link back to [Quality & Certifications](#7-quality--certifications), [Customized Solutions](#5-customized-solutions), and the Inquiry/Sample-request flow on [Contact Us](#10-contact-us).

---

## 5. Customized Solutions

Heading → Introduction → What Can We Customize? (5-card grid, unchanged) → **Our Customization Process** (now explicitly 6 steps with an indicative timeline: sample within 7–14 days of a complete spec, first production batch within 3–6 weeks of sample approval — `[ESTIMATE — CONFIRM]`) → **Private Label Programme** [NEW] (what Sam Group provides vs. what the partner provides; MOQ per SKU `[TO CONFIRM]`) → **Case Examples** [NEW] (3 anonymized project summaries, currently placeholders — `[TO CONFIRM]` real, customer-approved cases) → **Custom Product Request** [FORM].

**Custom Product Request form fields** (supersedes the field list previously in this document): Company Name, Country, Industry, Product/Application, Required Specifications, Estimated Quantity, Packaging Requirements, Additional Information, Upload Technical Specifications, **plus [NEW]** Email Address\*, Phone/WhatsApp, Target market/destination country, Preferred Incoterm (EXW/FOB/CFR/CIF), Consent checkbox. See [Data Model Gaps](#data-model-gaps-surfaced-by-this-structure) — the current `CustomFormulationRequest` entity is missing several of these.

> **Current-schema correction — required fields.** The single asterisk above is **not** the set of fields this form requires. `custom_formulation_requests` as migrated declares seven columns NOT NULL, and they are the operational persistence contract: **Company Name, Country, Industry, Email Address, Product/Application, Required Specifications, and the Consent checkbox.** The API and the built form require all seven. Everything else on the list is genuinely optional. This note records what the schema already enforces — no schema change was made, none is proposed here, and no field is required beyond the existing NOT NULL columns. Relaxing any of them would be a migration and a separate decision.

---

## 6. Export & Logistics

Hero → Global Reach (**[Expanded]**: Africa, Middle East & Neighbouring Markets, Asia/India, Turkiye — called out as "technically demanding," Europe subject to REACH — `[TO CONFIRM]` final market list and distributor exclusivity; **map is explicitly requested here** — "Interactive or illustrated map plus regional cards," resolving the Mapbox-placement open thread) → From Production to Delivery (8-step pipeline, each step now has real explanatory copy) → Flexible Shipping & Packaging (added Pails & Retail Packs to Bulk/Flexitank/Drums/IBC/Customized) → **Incoterms & Commercial Terms** [NEW] (EXW/FOB/CFR/CIF explained; payment terms/lead time `[TO CONFIRM]`) → Reliable Partnerships.

---

## 7. Quality & Certifications — **[NEW page]**

Hero ("Quality You Can Verify") → Our Quality Approach (Incoming/In-Process/Outgoing testing stages) → **Laboratory Capability** (in-house test list: viscosity, VI, flash/pour point, colour, density, TBN, TAN, water content, foam, copper corrosion, coolant freeze point/reserve alkalinity, ICP elemental analysis — `[TO CONFIRM]` which are in-house vs. outsourced) → **Certifications** (`[TO CONFIRM]` — explicitly blocked until a real certificate list exists; **the source document is emphatic that no placeholder certifications should ever be published**) → Documentation We Provide (COA/TDS/SDS/Certificate of Origin/commercial docs/loading photos) → Sampling Policy (confirms: samples issued at first stage for base oil and engine oil, before commitment) → Final CTA.

This page is the natural home for the design direction's `ResearchLaboratory` component (see [FRONTEND_ARCHITECTURE.md](./frontend/FRONTEND_ARCHITECTURE.md)) — its "Laboratory Capability" section is the first concrete content anchor that component has had. Proposed, not yet confirmed with design/content ownership.

---

## 8. Blog & Insights (`/insights`) — **[NEW, renamed from generic "Blog"]**

Index hero → Categories (Technical Guides, Product Knowledge, Industry & Market Updates, Export & Logistics, Company News) → **Article Template** (breadcrumb, H1, byline, featured image with alt text, intro, ToC for 1000+ word articles, H2/H3 body, key-takeaways box, related-products block, CTA, related articles, `Article` + `BreadcrumbList` schema) → **Editorial Plan**: 8 priority "Technical Guides" articles (each targeting a real buyer search term and linking to a specific product page) + 6 "Buyer & Export Guides" articles → Publishing Cadence (2/month at launch, dropping to 1/month; owner/reviewer/second-language decision still `[TO CONFIRM]`).

---

## 9. FAQ (`/faq`) — **[NEW]**

Consolidates the per-page FAQs already embedded in Home/About/each product page/Quality/Contact into one indexable page, feeding `FAQPage` schema. Five categories: About the Company, Products & Specifications, Ordering & Samples, Export & Logistics, Customization & Private Label. Several answers still `[TO CONFIRM]` (headquarters location, years operating, MOQ, lead time, payment terms, formulation-development pricing).

---

## 10. Contact Us

| Section                     | Notes                                                                                                                                                                                                                                                                                                                                                     |
| --------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Hero Section                | Unchanged                                                                                                                                                                                                                                                                                                                                                 |
| Contact Options             | 4 cards, unchanged                                                                                                                                                                                                                                                                                                                                        |
| Contact Information         | **[Expanded]** — Head Office + Factory/Production Site addresses, 3 email addresses (general/sales/technical), phone, **WhatsApp Business given explicit visual priority** (per the Notes sheet — "communication with foreign customers is mainly via WhatsApp"), working hours (Iran timezone), embedded map. All contact details currently placeholders |
| Main Contact / Inquiry Form | **[Expanded field set]** — see below                                                                                                                                                                                                                                                                                                                      |
| Direct Contact CTA          | Email/Call/WhatsApp, unchanged                                                                                                                                                                                                                                                                                                                            |
| Global Inquiries            | Unchanged                                                                                                                                                                                                                                                                                                                                                 |
| Contact FAQ                 | **[NEW]** — deflects the 4 most common first-email questions (MOQ, samples, markets, response time)                                                                                                                                                                                                                                                       |

**Main Inquiry form fields** (supersedes the field list previously in this document): First Name\*, Last Name\*, Company Name\*, Country\*, Email\*, Phone/WhatsApp, Industry\*, Inquiry Type (dropdown, same 6 values as before), Product of Interest (multi-select, same 6 categories + Petroleum Derivatives/Customized Products/Other), Required Quantity, **[NEW]** Destination Country/Port, **[NEW]** Preferred Incoterm (EXW/FOB/CFR/CIF/Not sure), Message, File Upload, Consent checkbox. **[NEW]** Anti-spam via invisible captcha (not a visible challenge) — an implementation note, not a data-model change. See [Data Model Gaps](#data-model-gaps-surfaced-by-this-structure) — `Inquiry` needs two new fields.

---

## 11. Careers & Partners — **[NEW page]**

**Become a Distributor**: Hero → What We Offer Partners → What We Look For → **Distributor Application** [FORM]: Company Name\*, Contact Person\*, Country/Territory\*, Email\*, Phone/WhatsApp\*, Website, Years in Business, Current Product Lines, Sectors Served, Estimated Annual Volume, Storage Capacity, Brands Currently Distributed, Additional Information, Consent checkbox. **No existing entity covers this** — see Data Model Gaps.

**Careers** (optional at launch): Hero → Open Positions (job listing block, `[TO CONFIRM]` real vacancies or replace with a general expression-of-interest form) → Speculative Application (CV upload, catch-all). **No existing entity covers this either.**

---

## 12. Legal Pages — **[NEW]**

Privacy Policy, Terms of Use, Cookie Notice, General Sales Conditions, and a Technical Data Disclaimer (footer note on every product page/TDS: technical data is indicative, not a contractual guarantee). All four full pages are **specifications for a legal drafter, not finished legal text** — the source document is explicit that these need actual legal review before publication, and that the Privacy Policy specifically blocks the contact form from legally collecting data until it exists. These map onto the existing Payload `Pages` collection (a Legal Page is a `Page` with a template, same pattern already established for Company/Landing pages) — **no new content type needed.**

**Route status, 17 August 2026 — capability, not content.** `/{locale}/privacy-policy` is implemented as a canonical route reading Payload through NestJS, with a shared legal-page template the other three will reuse. **It answers 404 in every locale** — measured against a healthy CMS and Content API — because no approved Privacy Policy text exists and none was invented to fill the page; publishing a `Pages` document with slug `privacy-policy` after legal review is what turns it on. A CMS or API outage renders a restrained unavailable state instead, never a 404. `/terms-of-use`, `/cookie-notice` and `/general-sales-conditions` have no route. **The legal-review item in Outstanding Confirmations below is unchanged and remains a launch blocker** — the route existing does not move it, and neither does the fallback that would serve English text under `/fa` and `/ar`: a Payload locale fallback is not a human-reviewed legal translation.

---

## 13. Global Components

- **Header / Main Navigation** — sticky, mega-menu under Products (3 columns: 3 categories / 3 categories / Product Finder + Catalogue download promo), flat links for everything else, language selector, "Request a Quote" as the primary button. Mobile: hamburger + accordion, WhatsApp and Request a Quote pinned to the drawer.
- **Footer** — 5 columns (Company / Products / Company links / Support / Get in Touch) + legal bar. Matches Home page's footer spec exactly.
- **Floating WhatsApp Button** — **[NEW]**, persistent on every page (not just Contact Us), pre-filled message referencing the current page. Direct implementation of the Notes sheet's WhatsApp priority — this is a stronger, page-aware version of the "WhatsApp Us" CTA already tracked in [PROJECT_VISION.md](./PROJECT_VISION.md).
- **Cookie Consent Banner** — **[NEW]**, required if analytics/marketing cookies are used; Accept all / Reject non-essential / Manage preferences.
- **404 Page** — **[NEW]**, designed state with product/contact/home links + search.
- **Thank You Page** (`/thank-you`) — **[NEW]**, post-submission, fires the analytics conversion event.
- **Photography Shot List** — **[NEW]**, consolidates the previously-tracked "photography not done" dependency into a concrete list: facility exterior, production/blending area, laboratory, storage tanks/warehouse, container/flexitank loading, each packaging format, every SKU on white background, team portraits. Still the single outstanding content dependency — see below.

---

## 14. SEO Master

Per-page meta title/description/primary keyword/schema type, for all 16 top-level indexable pages — this **supersedes** the earlier structured-data mapping table in this document.

| Page                     | URL                                           | Primary Keyword                      | Schema Type                  |
| ------------------------ | --------------------------------------------- | ------------------------------------ | ---------------------------- |
| Home                     | `/`                                           | petroleum products manufacturer      | `Organization` + `WebSite`   |
| About Us                 | `/about-us`                                   | petroleum products manufacturer Iran | `AboutPage` + `Organization` |
| Products                 | `/products`                                   | lubricant products supplier          | `CollectionPage`             |
| Base Oils                | `/products/base-oils`                         | base oil supplier                    | `Product` + `FAQPage`        |
| Additives                | `/products/lubricant-additives`               | lubricant additive packages          | `Product` + `FAQPage`        |
| Engine Oils              | `/products/engine-oils-automotive-lubricants` | engine oil manufacturer              | `Product` + `FAQPage`        |
| Industrial Oils          | `/products/industrial-oils-lubricants`        | industrial lubricants manufacturer   | `Product` + `FAQPage`        |
| Marine Oils              | `/products/marine-oils-lubricants`            | marine lubricants supplier           | `Product` + `FAQPage`        |
| Antifreeze & Coolants    | `/products/antifreeze-coolants`               | antifreeze manufacturer              | `Product` + `FAQPage`        |
| Customized Solutions     | `/customized-solutions`                       | custom lubricant formulation         | `Service`                    |
| Export & Logistics       | `/export-logistics`                           | lubricant export supplier            | `Service`                    |
| Quality & Certifications | `/quality-certifications`                     | lubricant quality certification      | `AboutPage`                  |
| Insights                 | `/insights`                                   | base oil industry insights           | `Blog`                       |
| Contact Us               | `/contact-us`                                 | contact base oil supplier            | `ContactPage`                |
| Become a Distributor     | `/become-a-distributor`                       | lubricant distributor opportunity    | `WebPage`                    |
| FAQ                      | `/faq`                                        | base oil supplier FAQ                | `FAQPage`                    |

Cross-reference: [docs/seo/SEO_ARCHITECTURE.md §8](./seo/SEO_ARCHITECTURE.md#8-structured-data-schemaorg) — `FAQPage` and `LocalBusiness` were previously marked "not applicable to Phase 1 content." **`FAQPage` is now applicable** (every product page plus the dedicated FAQ page needs it) — that section of the SEO doc should be revisited in a future SEO-focused pass; not changed here since it wasn't in this task's file list.

---

## Outstanding Confirmations Needed

Consolidated from every `[TO CONFIRM]` / `[ESTIMATE — CONFIRM]` marker in the source document — real launch blockers, not documentation gaps:

- **Photography** — facility, production, lab, warehouse, packaging, product SKUs, team (blocks Home, About Us, Quality & Certifications, Export & Logistics).
- **Real figures** — Home page trust-indicator statistics, About Us milestones/timeline.
- **Certifications** — the actual list held (ISO 9001/14001/45001, API licences, OEM approvals, lab accreditation). Explicitly: do not publish placeholders here.
- **Contact details** — head office/factory address, phone, WhatsApp Business number, email addresses.
- **Commercial terms** — MOQ per product family/SKU, lead times, payment terms.
- **Market list** — final confirmed export markets and whether any are exclusive to existing distributors.
- **In-house vs. partner-refinery labeling** — which base oil groups Sam Group produces itself vs. sources externally.
- **Legal review** — Privacy Policy (confirm GDPR applicability), Terms of Use, Cookie Notice, General Sales Conditions all need actual legal drafting/review before publication.
- **Editorial ownership** — content owner, technical reviewer, and English-only vs. multi-language articles for the Blog.
- **Analytics/marketing tools** — must be decided before the Cookie Notice/consent banner can be finalized.

---

## Request Sample Form — RESOLVED

Long tracked as an open gap: no source sheet ever defined a "Sample Request form" with its own fields, because **"Request Sample" is only ever a CTA** (Products landing, every category page, Quality & Certifications), never its own form.

**Decided: sample requests submit through the `Inquiry` flow.** `inquiryType` gains a `Sample Request` value and `Inquiry` gains a nullable `relatedProductId` recording which product page the CTA was clicked from. There is **no `SampleRequest` entity** — it has been removed from [DATA_MODEL.md](./DATA_MODEL.md). One lead queue, one entity, no duplicated submission/assignment/status machinery. Full reasoning: [DATA_MODEL_GAP_REVIEW.md §7](./DATA_MODEL_GAP_REVIEW.md#7-samplerequest--resolved-merged-into-inquiry).

---

## Data Model Gaps Surfaced By This Structure

> **Superseded by [DATA_MODEL_GAP_REVIEW.md](./DATA_MODEL_GAP_REVIEW.md)**, which is now the authoritative gap list. That review closed items 5 and 6 below (FAQ and Certifications are Payload-owned, not Prisma), confirmed item 7 needs no schema change, and found two gaps this list missed entirely: **download-gating lead capture** (explicitly required by the source document) and **newsletter subscription**. The list below is kept as the original record of what this structure first surfaced.

1. **`CustomFormulationRequest` is missing fields** the actual form now collects: email address, phone/WhatsApp, destination country, preferred Incoterm. (It was also missing a way to be contacted back at all — no email/phone field existed.)
2. **`Inquiry` is missing two fields**: destination country/port, preferred Incoterm.
3. **No entity exists for Distributor Applications** (§11) — a new form type, same shape-family as `Inquiry`/`CustomFormulationRequest`.
4. **No entity exists for Job Applications / speculative CVs** (§11).
5. **No entity exists for FAQ content** — needed to drive the consolidated FAQ page and per-page `FAQPage` schema; likely a Payload collection (content, not transactional data) rather than Prisma.
6. **No entity exists for Certifications** (§7) — name, issuing body, certificate number, valid-until, PDF; likely Payload content.
7. **Product/Category routing structure**: confirmed in [§4](#4-product-category-pages-p1p6) above that each category is one page with grades listed as sections, not individually routed. This doesn't require a `Product`/`Category`/`Specification` schema change — Products can still be individual rows grouped by category and rendered together — but it does change how `apps/web` queries and renders them, addressed in [FRONTEND_ARCHITECTURE.md](./frontend/FRONTEND_ARCHITECTURE.md). _Annotation: the "not individually routed" conclusion is superseded by [ADR-007](./ADR/ADR-007-product-taxonomy-v2.md) — decided, not implemented. The rest of the item is unchanged._

None of these are fixed here. Recommend a dedicated `DATA_MODEL.md`/`DATABASE.md` update pass before these features are built.
