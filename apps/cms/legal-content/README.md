# Legal-text source files

This directory holds the **reviewed, approved text** of the legal pages, one JSON file per page, and
nothing else. `pnpm --filter @sam-group/cms publish:legal-content` reads one of these files and
publishes it into Payload's `Pages` collection.

Nothing in this repository drafts, generates or completes legal text.
[`docs/SITE_STRUCTURE.md`](../../../docs/SITE_STRUCTURE.md) §12 states that Privacy Policy, Terms of
Use, Cookie Notice and General Sales Conditions are "specifications for a legal drafter, not finished
legal text" and require actual legal review before publication. A file here is where that reviewed
result is committed; the publisher refuses anything empty, partial or marked as a placeholder.

Until `privacy-policy.json` exists and is published, `/{locale}/privacy-policy` answers **404 in
every locale** — which is the correct answer while the page genuinely does not exist — and the
footer and both consent labels name the policy as plain text rather than linking it.

## Publishing

```bash
SAM_ALLOW_LEGAL_CONTENT_PUBLISH=true SAM_LEGAL_CONTENT_FILE=./legal-content/privacy-policy.json pnpm --filter @sam-group/cms publish:legal-content
```

The run validates the whole file before opening a connection, so a rejected file leaves `sam_cms`
untouched — no draft, no partial document. Re-running after a correction updates the same page
rather than creating a second one.

## Format

`privacy-policy.example.json` is the shape, with every text value blank. It is a template and is
**not publishable**: the validator rejects empty strings, so it cannot be published by mistake.
Copy it to `privacy-policy.json` and fill it in with the approved text.

| Field                       | Required | Notes                                                                                           |
| --------------------------- | -------- | ----------------------------------------------------------------------------------------------- |
| `slug`                      | yes      | One of `privacy-policy`, `terms-of-use`, `cookie-notice`, `general-sales-conditions`.           |
| `lastUpdatedDate`           | yes      | `YYYY-MM-DD`. The document's real revision date — it is shown on the page and is never guessed. |
| `revision`                  | yes      | A short identifier for this revision of the text. See "After publishing" below.                 |
| `locales.en`                | yes      | Reviewed English text.                                                                          |
| `locales.fa`                | yes      | Reviewed Persian text.                                                                          |
| `locales.ar`                | yes      | Reviewed Arabic text.                                                                           |
| `locales.*.title`           | yes      | The page heading in that language.                                                              |
| `locales.*.body`            | yes      | A non-empty array of blocks (below).                                                            |
| `locales.*.metaTitle`       | no       | Omit the key entirely if there is none; nothing is derived to fill it.                          |
| `locales.*.metaDescription` | no       | Same.                                                                                           |

**All three locales are required.** Payload is configured with `fallback: true`, so a document
published in English alone still answers 200 under `/fa` and `/ar` and shows English text with a
"not translated into this language" notice above it. That is acceptable for editorial copy and not
for a document a visitor is asked to consent to, so the publisher refuses a partial file.

### Body blocks

```jsonc
{ "kind": "heading", "level": 2, "text": "…" }        // level 2 or 3; the page title is the h1
{ "kind": "paragraph", "text": "…" }
{ "kind": "list", "items": ["…", "…"] }               // add "ordered": true for a numbered list
```

Nothing else is accepted. Bold, italics, links and tables are supported by the editor and can be
added in Payload's admin panel after publishing; this format covers the structure a policy is
actually written in.

### Rejected outright

Empty or whitespace-only strings, a missing locale, an unknown locale, an empty `body`, a
`lastUpdatedDate` that is not a real calendar date, and any string containing `[TO CONFIRM]`,
`[ESTIMATE`, `lorem ipsum`, `TODO`, `TBD`, `XXX` or `placeholder`.

## After publishing

Set `ACTIVE_PRIVACY_POLICY_REVISION` in
[`apps/api/src/modules/forms/privacy-policy-revision.ts`](../../api/src/modules/forms/privacy-policy-revision.ts)
to the same `revision` value. It is `null` until an approved policy exists, and it is what every
stored consent record is stamped with — a consent recorded against `null` can never be rewritten
(the column is immutable at the database level), so this is set in the same gate that publishes the
text, not afterwards.
