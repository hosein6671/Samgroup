# Website Content Approval Register

This register separates usable copy from facts that require evidence or a named owner. It is a publishing control, not a list of suggested claims.

## Copy ready for editorial review

- Brand voice, terminology, and CTA hierarchy
- Navigation and footer labels
- Claim-free Home, About, Products, Customized Solutions, Export & Logistics, Quality, Insights, FAQ, Contact, Distributor, Careers, Sitemap, 404, unavailable, thank-you, and cookie-interface copy
- Shared product-family and product-detail language
- Form introductions, submit actions, success messages, and empty states

## Technical approval required

- Every product description that names an application, performance level, standard, approval, compatibility, composition, or technical property
- Every typical-property value and test method
- TDS, SDS, COA terminology and availability per product
- Sample eligibility and evaluation conditions
- In-house versus outsourced laboratory tests
- Technical-data disclaimer wording

Owner evidence: approved TDS/SDS, certificate, laboratory record, supplied catalogue, or signed technical review.

## Commercial approval required

- MOQ, lead time, response time, payment terms, price validity, sample cost, and freight terms
- Available packaging per product
- Incoterms actually offered and named ports/places
- Market coverage, distributor exclusivity, and territory availability
- Private-label services and responsibilities

Owner evidence: approved commercial policy or written sales-owner confirmation.

## Corporate approval required

- Legal company name and registration details
- Addresses, phone numbers, email addresses, WhatsApp number, and working hours
- Founding year, milestones, facility details, production lines, capacity, countries served, customer or distributor counts, and employee figures
- Team biographies and photography

Owner evidence: current company record and content-owner sign-off.

## Certification approval required

For each certificate: exact title, issuing body, certificate number, holder name, scope, issue date, expiry date, status, and public file. Do not publish a logo or certificate name without the record.

## Legal approval required

- Privacy Policy
- Terms of Use
- Cookie Notice and actual cookie inventory
- General Sales Conditions
- Consent wording and retention statements
- Technical and commercial disclaimers

Machine-generated legal text is not a substitute for counsel. Translations require legal review in each published language.

## Known unsafe fixture content

`apps/web/src/features/home/home-data.ts` contains demonstration figures and claims that are not approved website content, including capacity, market counts, formulation counts, laboratory counts, yield, delivery performance, facilities, partners, and similar metrics. They must remain visibly identified as demo data or be removed/replaced before production publication.

## Locale rollout

1. Approve the English semantic master.
2. Insert verified company and technical facts.
3. Translate approved English into Persian and Arabic.
4. Run native-language technical review; do not rely on locale fallback as approval.
5. Load content into Payload through an explicitly approved content operation.
6. Verify page rendering, SEO fields, forms, RTL layout, and locale-specific links before publication.
