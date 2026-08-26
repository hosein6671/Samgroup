# Product Research Register

**Snapshot:** 27 August 2026
**Machine-readable register:** [`PRODUCT_RESEARCH_REGISTER.json`](./PRODUCT_RESEARCH_REGISTER.json)

## Purpose

This register supports product-page copy without changing a formulation or inventing a technical fact. The canonical product identity remains the 100-row catalog manifest. Research metadata is supplementary and is never a second product database.

## Coverage

- 100 catalog products accounted for.
- 66 products checked against an official manufacturer page on `kingpowerlub.com` or `addilex.com`.
- 34 HSB products tied to the supplied printed catalog already transcribed in the repository; no independently matchable official web catalog was found.
- 66 records are structurally ready for a copy draft.
- 34 records contain a conflict or withheld fact and require data review before copy is drafted.
- The 66 structurally ready records carry a conservative English copy draft: summary, selection note and two B2B CTAs. The other 34 deliberately carry `copyDraft: null`.
- Every record remains blocked from technical publication until its Specification and Product Claim decisions pass the existing review workflow.

## Rules

1. `currentName` remains the workbook/catalog name. Web metadata never renames a product automatically.
2. King Power's raw series labels, API labels, SAE labels and feature descriptors are stored separately. Internal spelling and underscore conventions are preserved as evidence, not silently polished into a new identity.
3. Addilex titles come from official product pages; the WordPress site suffix is removed only as presentation chrome.
4. HSB facts come from the supplied catalog, not from name similarity on the open web.
5. Missing data stays missing. No inferred OEM approval, performance level, application, formulation or technical value is added.
6. External URLs and source locators are not copied into the register or any public payload. The existing non-public provenance model remains authoritative.
7. `publicationBlockedUntilTechnicalApproval` is always `true` in this research artifact. This register prepares copy; it grants no approval.
8. Draft copy may restate a verified official feature descriptor or the existing family/type/grade classification. It may not introduce a new application, performance promise, OEM approval or technical value.
9. Persian and Arabic translations remain `not_started` until the English source copy is reviewed; this prevents three independently generated versions from drifting technically.

## Reproduction

Generate the frozen-fixture manifest with the existing catalog importer, then run:

```text
pnpm exec tsx scripts/research-catalog-products.ts \
  --manifest <catalog-manifest.json> \
  --output docs/content/PRODUCT_RESEARCH_REGISTER.json
```

The collector accepts only the two allow-listed official web hosts. It reads public metadata, writes no database row, stores no downloaded source document and does not alter the import manifest.
