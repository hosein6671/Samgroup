# Content and SEO administration — implementation audit

Date: 2026-09-08. Baseline: `6309c32`.

Owner requirement: the content/SEO operator must be able to manage public content and SEO without editing code. This audit records implementation evidence and proposed work, not a change to permissions or architecture. Findings are source-level; no authenticated editor session or live write was tested.

## Coverage

| Surface / capability                    | Evidence today                                                                                                                         | Gap to the owner requirement                                                                                                                           |
| --------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| CMS page content                        | Payload Pages has localized title, slug, body, SEO and versions/drafts                                                                 | Verify which public routes consume each page; Pages is not a universal website page builder                                                            |
| About Us, Customized Solutions, Quality | Registered Globals have editorial fields, SEO and versions                                                                             | Authenticated editorial workflow and public output need end-to-end verification                                                                        |
| Contact Us                              | Registered Global models contact channels and drafts                                                                                   | It does not expose the entire page or the shared SEO field group                                                                                       |
| Products landing / family pages         | Content and family metadata are maintained in frontend fixtures; family branch of the shared route does not consume Category SEO       | Build an editorial content model and connect metadata reads; editing database SEO alone will not update family metadata                                |
| Product detail                          | Shared route consumes product SEO: title, description, canonical, robots, social metadata and structured-data override                 | No general product/SEO editing screen or ordinary catalog write controller found; technical review screens are a separate capability                   |
| Blog                                    | Public read controllers exist; permissions specify Content Manager blog access                                                         | No general article editing route found under the Admin app                                                                                             |
| Images                                  | Payload Media supports editorial upload and alt; platform product media is separate                                                    | Product attachment, ordering, primary-image selection and accessible editing workflow remain to be built                                               |
| Metadata fields                         | Shared CMS field group includes meta title/description, canonical, OG, social image, Twitter, index/follow, keywords and JSON override | Field existence is not proof every public route consumes it; route-by-route verification required                                                      |
| Redirects                               | Public SEO redirects read endpoint/service exists                                                                                      | No redirect management UI/write controller found; validation and permissions required                                                                  |
| Sitemap                                 | Public generation and Category noindex exclusion exist                                                                                 | Product enumeration is absent; structural routes are code-driven. Define per-page eligibility and consistent noindex handling before exposing controls |
| Robots / hreflang                       | Public generation and locale infrastructure exist                                                                                      | No complete operator settings UI found. Keep protected-path rules enforced and fa/ar editorial rollout deferred                                        |
| Draft preview / history                 | Payload versions/drafts exist                                                                                                          | No explicit public preview integration found in inspected config/Globals; verify authenticated preview, revision restore and publication behavior      |
| SEO completeness overview               | No SEO area in Admin area registry                                                                                                     | Build a page inventory with missing-field and publication/indexability status; avoid presenting a score as a ranking guarantee                         |

## Permission conflict to resolve before implementation

`docs/SECURITY.md` RBAC grants Content Manager **read-only Products/Catalog**, full Blog/CMS content, and describes SEO metadata and translations as intended Admin capabilities. The implemented Admin area registry currently exposes only shell, leads and technical review; shell/review are Admin-only.

The owner's new requirement expands editorial access beyond the current catalog permission. Do not silently grant Admin or change the matrix. Proposed resource-level split for review:

- Content/SEO operator: public copy, editorial images, metadata, draft/preview/publication of ordinary editorial content, and scoped redirects.
- Admin technical reviewer: approval of specifications, product claims and certifications remains separate.
- User administration, credentials, infrastructure and private applicant data are not required for SEO work.

Any permission changes must be specified in SECURITY and the relevant architecture decision process, then enforced in NestJS and, where applicable, Payload. Two separate sign-ins remain required by ADR-006; a common navigation entry does not imply SSO or shared storage.

## Proposed implementation sequence

1. Define a per-field ownership/permission matrix: platform catalog/SEO versus CMS editorial content; identify technical fields that cannot bypass review.
2. Implement protected product SEO/copy editing and route metadata integration, with conflict handling and public-output verification.
3. Implement the product image workflow through the owning Media service; cover alt text, primary image and ordering.
4. Bring remaining code-owned public page content and SEO under the appropriate editorial model; preserve bespoke page templates.
5. Add redirects, sitemap eligibility controls and a content/SEO inventory. Verify canonical/noindex/redirect interactions.
6. Test as the actual content role: create draft, preview, publish, edit, restore, change slug and verify redirect, inspect emitted metadata and sitemap. Verify denied technical-approval and unrelated private-data actions.

No estimate of overall completion is inferred from field counts. Actual deployed data, editor accounts, preview behavior and publication results remain unverified.

## Evidence paths

- `apps/cms/src/payload.config.ts`, `collections/pages.ts`, `collections/media.ts`, `fields/seo.ts`, `access.ts`, `globals/*`
- `apps/web/src/app/[locale]/products/[slug]/page.tsx`, `products/page.tsx`, `about-us/page.tsx`, `app/sitemap.ts`
- `apps/web/src/features/admin/session/admin-areas.ts`, `apps/web/src/app/(admin)/admin/*`
- `apps/api/src/modules/seo/*`, `apps/api/src/modules/catalog/*controller.ts`, `apps/api/src/modules/blog/blog-posts.controller.ts`
- `docs/SECURITY.md`, `docs/content/PAYLOAD_CONTENT_ARCHITECTURE.md`, ADR-006

Some status comments are stale: sitemap comments describe an absent Product route and a catalog with no descriptions, while the shared Product route exists and prior verified catalog results contain descriptions. The observed implementation, rather than those historical reasons, is the basis for this audit.
