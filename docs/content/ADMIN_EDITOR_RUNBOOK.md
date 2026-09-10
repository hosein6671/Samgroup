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
