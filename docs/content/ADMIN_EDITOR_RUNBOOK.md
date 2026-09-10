# Admin editorial workspace

This describes the implemented ADR-024 slice, not completion of every proposed capability.

## Entry points

- `/admin/catalog/products`: real catalogue search, category filter and pagination.
- `/admin/catalog/products/:id`: English name, description and text/robots/keywords SEO. Save draft keeps public data unchanged. Publish updates Product and SEO together. Product URLs and technical review states are not edited here.
- `/admin/content`: About Us, Customized Solutions, Quality & Certifications and Contact Us (the existing contact-channel schema). Each page owns its content and SEO editing location.
- `/admin/users`: Admin-only creation and role/status changes. Self changes are refused; the final active Admin is protected. Disabling a user revokes credentials through the existing database trigger.
- `/admin/audit`: Admin-only account/security and product events; select Content activity for company-page draft/publication history.

Admin and Content Manager can enter both editorial areas. Users and audit are Admin-only. CMS accounts remain independent and are not created automatically.

## Configuration and rollout

Apply Prisma migrations to sam_platform using the existing migration workflow. The new product draft table starts empty: imported products remain public and unchanged. Product technical-copy files in `site-copy` remain drafts and are not automatically imported or approved.

Company editing/history additionally requires a random `PAYLOAD_EDITOR_SECRET` of at least 32 characters in API and CMS, with matching values. It must never appear in web configuration. The normal CMS service key is still required and remains insufficient on its own for draft reads or writes. The CMS `editorial-events` collection must exist; local development schema push created it. A versioned CMS production migration/baseline is still a rollout prerequisite, as no production CMS migration baseline exists here. Do not enable a production rollout based only on the local development result.

Reload after a conflict and retain a copy of unsaved edits. After an uncertain save response, check the current draft/history before retrying. Audit failures roll back same-database mutations; company content and receipts commit in sam_cms, and a durable receipt is checked before reporting success. No cross-database transaction is claimed.

## Remaining scope

Remaining public-page/category/shared content models, uploads/alt text/document ownership, new products/unpublication, rich-text formatting tools and full English content publication are not delivered by this slice. Technical specifications and claims continue through the existing review queue. Authentication audit events are best-effort and login/refresh attribution and operational retention cleanup remain production prerequisites. There is no production deployment in this work.

## Product sections

Applications, Features and Frequently asked questions are editable repeaters in the product editor. Each allows up to 20 rows. Save draft leaves their public snapshot unchanged; Publish makes them visible on the English product page. Removing all rows and publishing removes the section. No sections are automatically populated, and no generated technical claims are seeded. Other locales stay unchanged until translated editorial content is implemented. Migration `20260910090000_product_editorial_sections` adds the nullable published snapshot; legacy draft saves that omit these fields preserve them.

### Category page narrative

Open Website content in the Admin navigation, then choose one of the six Product category content cards. Hero, overview paragraphs, quality introduction, packaging/supply and documentation narrative are editable in English. Initial fields use the current page text. Save draft preserves the published page; Publish replaces only these narrative fields. Reload after a conflict and retain a copy of unsaved edits. Every mutation uses the existing content activity log.

This is a first narrative slice. Classification, methods, process claims, product rows, images, applications/industries, shared FAQ and category SEO retain their current sources. No technical approval is granted by narrative publication. Local CMS dev schema is updated; production migration baseline is still owed before deployment.

### Category SEO

The same category editor now contains SEO: search/social titles and descriptions, canonical HTTPS override, Twitter card, indexing/following controls and keywords. Save draft keeps SEO private; Publish applies narrative and SEO together. Blank canonical clears the override. Noindex categories and categories canonicalized elsewhere are omitted from the sitemap. The site's launch indexing switch still takes precedence over the page checkbox.

Media/social images and advanced JSON-LD editing remain separate pending workflows. Category SEO is edited here only; no duplicate Prisma editor is introduced.

### Shared FAQ and category applications

Open Website content → Shared FAQ library (`/admin/faqs`). Create an answer, choose one or more product categories, set its display order and save a draft or publish. Answers are plain paragraphs; separate paragraphs with a blank line. In each category editor, enable Use the shared FAQ library and publish to replace the existing FAQ. An empty published match removes that section; an unavailable service preserves existing answers. The public category loader caps retrieval at 2,000 answers and falls back rather than showing partial results above that bound.

Category editors also offer Use the applications below, heading, introduction and up to 20 title/description rows. Publish applies the selected replacement; publishing an empty list hides Applications. Leave both switches off to preserve the existing presentation. Existing clients omitting these fields preserve stored values.

The Contact eligibility flag is stored for a later consumer; the Contact page and standalone public FAQ page are not connected in this slice. No answers or category edits were seeded. Uploads and production CMS migrations remain outstanding.

### Public FAQ and Contact display

Published library entries now appear at `/en/faq`, grouped using the Topic selector. Enable Available for the Contact FAQ to include an answer on Contact Us. Publishing refreshes these surfaces and the sitemap. Empty Contact results hide its FAQ section; a temporary content failure leaves the enquiry form usable. Category assignment still requires its existing category switch. Seven initial English entries were published locally from `site-copy/ENGLISH_SHARED_FAQ.json`; edit them in the same FAQ library. Public FAQ heading/metadata controls are not yet in the Admin editor.
