# Owner questionnaire — Privacy Policy

Answers needed to finish [`DRAFT-privacy-policy-REVIEW-ONLY.md`](./DRAFT-privacy-policy-REVIEW-ONLY.md).

Only facts are asked for here. Nothing on this list can be researched, inferred
or reasonably guessed from the repository — every item was checked first. Items
marked **counsel** need a lawyer rather than a business answer; the rest need
someone at the company.

Please answer "not decided yet" where that is the truth. A blank is more useful
than a plausible answer, because a plausible answer becomes published text.

---

## A. Identity and contact — 6 questions, 3 partly answered

1. ✅ **Partly answered — "SAM Group Iran".** Supplied as the public-facing name.
   **Still needed:** confirmation that this is the exact **registered legal
   entity name**, or the registered name if it differs. A privacy policy
   normally names the registered entity, not a trading name.
2. ✅ **Partly answered — "Iran, Tehran, SAM Group".** **Still needed:** the
   complete postal/registered address. What was supplied has no street,
   building or postal code, so it cannot be used for correspondence or given to
   a regulator.
3. Does the company have a registration number that should be published? If so,
   what is it? _Not answered._
4. ✅ **Answered — `info@Samgp.com`** is the published privacy contact address.
   **Still needed:** whether a telephone number should be published beside it.
5. Has a data protection officer, or a privacy representative in any other
   jurisdiction, been appointed? If yes, who, and should their details be
   published? _Not answered._
6. Who inside the company is responsible for answering a data subject request
   within the legal deadline, and is `info@Samgp.com` monitored closely enough
   to meet it? _Not answered._

## B. Jurisdiction — 2 questions, 1 partly answered (**counsel**)

7. ✅ **Partly answered — the business is based in Iran**, so the draft is
   written to be read under Iranian law. **Still needed from counsel:**
   confirmation that Iranian law governs, and identification of the specific
   Iranian data protection instrument(s) this policy must satisfy.
8. ⚠️ **Owner reported, counsel confirmation still required.** The owner states
   the business **currently has no EU or UK users and is not targeting the EU
   or UK market**. That is recorded as the owner's present understanding — it is
   **not** recorded as a conclusion that the GDPR does not apply, and the draft
   does not make that claim anywhere.

   **Still needed from counsel:** whether the EU/UK GDPR, or any other foreign
   privacy regime, nonetheless applies; what would have to change for it to
   begin applying; and what the company should do if an enquiry does arrive
   from an EU or UK visitor. Please also reconcile the owner's report with the
   project's own security documentation, which describes Europe as a served
   market — the two statements are inconsistent and one of them must stop being
   relied on.

   _This still unblocks draft sections 5, 10, 11, 13, 14 and 16._

## C. Retention — 1 question, 7 answers (**counsel**, with the business)

9. How long should each of these be kept, and what happens at the end?
   - enquiry records
   - custom formulation request records
   - consent evidence
   - staff accounts and sign-in sessions
   - lead workflow history (which identifies employees)
   - server access logs
   - database backups

   _This is the hardest blocker. It is recorded in `docs/SECURITY.md` as an
   approved requirement that has been outstanding since 17 August 2026, and the
   policy cannot be published with it open._

## D. Lawful basis — 1 question (**counsel**)

10. What is the lawful basis for (a) replying to an enquiry and the business
    correspondence that follows, (b) keeping the record afterwards, and (c) the
    bot check and server logging? The forms already collect and store an
    explicit consent tick — please confirm whether consent is in fact the right
    basis, or whether it is contract or legitimate interests.

## E. Third parties — 4 questions

11. Which company will send our outbound email, and from which country?
12. Which hosting provider will run the server, and in which country?
13. Which internal mailbox will receive lead notifications, and who can read it?
14. Which Cloudflare account and plan do the Turnstile keys belong to? Has any
    data localisation option been enabled on it?

## F. Cloudflare and transfers — 2 questions (**counsel**)

15. How should Cloudflare's role be described? Cloudflare's own addendum says it
    acts in more than one capacity depending on the processing, so we must not
    call it "our processor" without confirmation. Is a data processing agreement
    in place?
16. Does any personal data leave the governing jurisdiction, and on what legal
    mechanism? _Depends on 7, 11, 12 and 14._

## G. Operations — 4 questions

17. Are encrypted nightly database backups actually configured, and who holds
    the encryption keys? (Today this is a documented intention; no server
    exists.)
18. How long are server access logs kept, and who may read them?
19. Will a cookie consent banner be deployed? _Not required while the site sets
    no non-essential cookie — but mandatory the moment any analytics is added._
20. ✅ **Answered and implemented — the design preview routes are gated outside
    development.** The original answer was a blanket production 404; on
    2 September 2026 that was superseded by a redirect-or-404 contract, set out
    in the implementation follow-up below. The `design-proof` pages redirect to
    their canonical routes in production and `cms-proof` answers 404, so a
    production visitor reaches no proof page and no proof form. **Still needed at
    publication time:** confirm the deployed build carries it, and keep draft
    section 7 covering `cms-proof` for as long as that route exists.

## H. Policy versioning — 2 questions

21. What revision identifier will the first approved version carry (for example
    `v1.0`, or a date)? _The same value must be set in
    `ACTIVE_PRIVACY_POLICY_REVISION` in the same change — see the open ADR-021
    question about keeping the two from drifting._
22. What is the effective date?

## I. Translations — 1 question

23. Who will produce the Persian and Arabic translations, and which lawyer will
    review each one? Machine translation is not acceptable for this document.

---

## Implementation follow-up — approved and implemented

**Superseded decision (owner, 2 September 2026).** The earlier entry here asked
for a blanket production **404** across the whole proof tree. That has been
replaced by a narrower contract, approved on the same date:

| Route                                  | Production behaviour                               |
| -------------------------------------- | -------------------------------------------------- |
| `/design-proof`                        | 307 → `/en`                                        |
| `/design-proof/about-us`               | 307 → `/en/about-us`                               |
| `/design-proof/products`               | 307 → `/en/products`                               |
| `/design-proof/customized-solutions`   | 307 → `/en/customized-solutions`                   |
| `/design-proof/quality-certifications` | 307 → `/en/quality-certifications`                 |
| the six Product Family proof routes    | unchanged — they already redirect                  |
| `/{locale}/cms-proof/{slug}`           | **404**, until a canonical legal page is published |

All proof routes remain fully available in development.

**Why a redirect rather than a 404 for most of them.** The concern the original
entry was written for is that a production visitor must never reach a proof
page's form. A redirect satisfies that concern exactly as well as a 404 — the
gate runs before the page renders, so no form markup is produced — and it is
better for the reader, who lands on the page they were looking for. It is also
the step [ADR-010](../ADR/ADR-010-products-slug-namespace-and-collision-policy.md)
§9 already names as the one before a proof route is removed.

`cms-proof` keeps the 404 because it is the only proof route whose canonical
counterpart does not exist: its counterparts are the legal pages in this folder,
and `/{locale}/privacy-policy` itself answers 404 today. Redirecting there would
point one 404 at another; redirecting anywhere else would publish CMS content as
though it were policy.

**Implemented**, in `apps/web/src/features/site/proof-routes.ts` and the six page
files it gates, with the mapping and the development/production split covered by
`features/site/proof-routes.spec.ts` and
`app/design-proof/proof-route-gate.spec.tsx`.

Two notes that still hold, and one that has been acted on. Excluding the routes
in `robots.txt` does **not** satisfy this — `robots.txt` governs crawling, not
access, and the pages stay reachable to anyone with the URL; the implementation
therefore gates the route rather than adding a directive. And the routes render
the real shared components, so the gate removes the route's reachability rather
than changing the components' behaviour, which the canonical pages depend on.

**Draft section 7 no longer needs to cover the `design-proof` pages** once this
ships, because a production visitor cannot reach one. It must still cover
`cms-proof` for as long as that route exists in any environment — and note that
the 404 above is a production behaviour, not a deletion.

---

## One thing to confirm rather than answer

The draft states that this website uses **no analytics and no tracking of any
kind**. That was verified against the source code and is currently true. Please
confirm that no analytics, tag manager or advertising pixel is planned before
launch — if one is, sections 4.7, 8 and 9 all change, and a cookie consent
banner becomes mandatory.
