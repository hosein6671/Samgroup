<!--
  ============================================================================
  NOT A PUBLISHED POLICY. NOT LEGALLY APPROVED. DO NOT PUBLISH.
  ============================================================================

  This is a drafting aid for counsel. It is Markdown, it lives outside
  `apps/cms/legal-content/`, and it is NOT in the JSON shape that
  `apps/cms/src/editorial/publish-legal-pages.ts` accepts — that script parses
  its input with `JSON.parse` and `parseLegalPageSource`, so this file cannot
  be published by it under any environment variable.

  Every statement below about platform behaviour was read out of this
  repository on 1 September 2026 and is cited in the accompanying drafting
  report. Every statement that could NOT be established from the repository is
  marked `[OWNER INPUT REQUIRED: …]` or `[LEGAL REVIEW REQUIRED: …]` and is
  left unwritten rather than guessed.

  No legal prose here is approved. `docs/content/site-copy/ENGLISH_WEBSITE_MASTER.md`
  states: "No generated legal prose is approved by this content master."
  ============================================================================
-->

# Privacy Policy — WORKING DRAFT FOR LEGAL REVIEW

**Status:** Draft. Not published, not approved, not in force.

**Revision identifier:** `[OWNER INPUT REQUIRED: the revision identifier this text will carry once approved — for example "v1.0" or a date. It must be set here and in ACTIVE_PRIVACY_POLICY_REVISION in the same gate.]`

**Effective date:** `[OWNER INPUT REQUIRED: effective date, set at approval.]`

**Last reviewed:** `[LEGAL REVIEW REQUIRED: date of counsel's review.]`

---

## 1. Who we are

**SAM Group Iran**
Tehran, Iran

This policy is issued by SAM Group Iran, which is responsible for the personal data described in it.

You can reach us about anything in this policy at **info@Samgp.com**.

> **Drafting note — the three items above are owner-supplied and still need confirming.**
>
> `[OWNER INPUT REQUIRED: confirmation of the exact registered legal entity name. "SAM Group Iran" was supplied as the public-facing name; it has not been confirmed as the name on the company's registration, and a privacy policy normally names the registered entity.]`
>
> `[OWNER INPUT REQUIRED: the complete postal/registered address. "Iran, Tehran, SAM Group" was supplied; it has no street, building or postal code, so it is not yet a usable address for correspondence or for a regulator.]`
>
> `[OWNER INPUT REQUIRED: company registration number, if the company has one that should be published.]`
>
> `[OWNER INPUT REQUIRED: whether a telephone number should be published alongside the email address for privacy enquiries.]`

`[LEGAL REVIEW REQUIRED: whether the entity is a "controller" under the applicable law, and whether that term should be used in this text at all. The correct terminology depends on which law applies — see section 2. The owner has supplied a public-facing name rather than a legal characterisation, and none is asserted here.]`

`[OWNER INPUT REQUIRED: whether a data protection officer, or a privacy representative in any other jurisdiction, has been appointed. Not answered. Do not state that one exists unless one does.]`

---

## 2. Which law applies

We are based in Iran, and this policy is intended to be read under Iranian law.

> **Drafting note — what the owner reported, and what still has to be decided.**
>
> The owner states that the business **currently has no users in the EU or UK and is not targeting the EU or UK market**. That is recorded here as the owner's present understanding of the business, at the date of this draft. It is **not** a conclusion that the EU or UK GDPR, or any other foreign regime, does not apply — that determination has not been made, and this draft does not make it.
>
> Two things make it worth testing rather than assuming. The website is served in three languages and is reachable worldwide; and the project's own documentation has previously described Europe as a served market, which is inconsistent with the statement above. Whether an enquiry actually arrives from an EU or UK visitor is a matter of fact that can change without anyone deciding it should.
>
> `[LEGAL REVIEW REQUIRED: confirmation that Iranian law governs, and identification of the specific Iranian data protection instrument(s) this policy must satisfy.]`
>
> `[LEGAL REVIEW REQUIRED: whether the EU/UK GDPR — or any other foreign privacy regime — nonetheless applies despite the owner's report of no EU/UK users and no EU/UK targeting, and what would have to change for it to begin applying. Please also advise what the company should do if an enquiry is received from an EU or UK visitor.]`
>
> `[LEGAL REVIEW REQUIRED: the earlier "Europe is a served market" statement in the project's security documentation should be reconciled with the owner's report above, so that one of the two stops being relied on.]`
>
> Sections 5, 10, 11, 13, 14 and 16 all depend on these answers and cannot be completed before them.

---

## 3. What this policy covers

This policy covers:

- the public website at `samgp.com`, in every language it is served in;
- the enquiry and request forms on that website;
- the staff-facing administration area at `samgp.com/admin`;
- the content management system at `cms.samgp.com`, which is used only by our own staff.

It does not cover any website you reach by following a link from ours. Our website links out to third-party services — including messaging and social platforms — and those services publish their own privacy notices, which govern what happens after you leave our site.

---

## 4. The personal data we collect

We collect personal data in three situations: when you submit a form, when our security controls check that a submission is genuine, and when a member of our own staff signs in to administer the platform. We do not ask you to create an account, and there is no customer login.

### 4.1 When you send us an enquiry

The enquiry form on our Contact page asks for:

- your first name and last name;
- your company name;
- your country;
- your email address;
- your telephone number (optional);
- your industry;
- the type of enquiry you are making;
- the products you are interested in, and, where you arrived from a product page, which product that was;
- the quantity you require (optional);
- the destination country or port (optional);
- your preferred Incoterm (optional);
- your message to us (optional).

We also record that you ticked the consent box, the date and time of your submission, and an identifier for the version of this policy that was in force when you submitted. That last record cannot be altered afterwards — our database rejects any attempt to change it.

### 4.2 When you request a custom formulation

The custom formulation request form asks for:

- your company name;
- your country;
- your industry;
- your email address;
- your telephone number (optional);
- the product or application concerned;
- the specifications you require;
- the estimated quantity (optional);
- your packaging requirements (optional);
- any additional information you provide (optional);
- the destination country (optional);
- your preferred Incoterm (optional).

We record consent, timestamp and policy version for this form in the same way as for enquiries.

Please note that the specifications and additional information fields are free text. Anything you type into them is stored as you wrote it, so please do not include information you would prefer us not to hold.

### 4.3 File attachments

**We currently accept no file uploads.** The attachment control on the custom formulation form is disabled, and the platform has no upload endpoint, so no document you might wish to attach can reach us through this website today. If that changes, this policy will be updated before the capability is enabled.

### 4.4 When our security check runs

Our forms are protected by Cloudflare Turnstile, a service that distinguishes human visitors from automated ones. It starts working when a page carrying a form loads, not when you press send. Section 7 explains what this involves, which pages it affects, and what happens if the check cannot be completed.

### 4.5 When our staff sign in

For our own employees who administer the platform we hold a work email address, a role, an account status, an account creation date, and a securely hashed password. We never store a staff password in a readable form. We also keep a record of active sign-in sessions, which holds a one-way digest of the session token — never the token itself — together with the times the session was created, expires, and was ended.

Where a member of staff changes the status of an enquiry or reassigns it, we record who made the change and when.

Our content management system holds a separate set of staff accounts, with their own email addresses and passwords, used only for editing website content.

### 4.6 Server logs

Our web server keeps standard access logs. Like almost all web servers, these record the IP address a request came from, the time, the page requested and the browser's user-agent string. These logs exist to operate and secure the service.

`[OWNER INPUT REQUIRED: how long server access logs are kept, and who may read them. No log retention period has been set anywhere in this project.]`

### 4.7 What we deliberately do not collect

- **We use no analytics, and no tracking or advertising technology of any kind.** There is no analytics script, no tag manager, no advertising pixel and no visitor-measurement service anywhere on this website. This was verified against the source code and is a design decision, not an oversight.
- We do not build profiles of visitors.
- We do not take automated decisions that produce legal or similarly significant effects about you.
- We do not knowingly collect any special category data. Please do not include health, biometric, political, religious or similar information in a free-text field.

---

## 5. Why we use your data, and on what legal basis

We use the personal data you submit through our forms in order to:

- read and understand your enquiry or request;
- reply to you and continue the resulting business conversation;
- prepare quotations, samples and technical proposals where you ask for them;
- keep an internal record of the request and how it was handled;
- keep evidence that you consented, and to which version of this policy.

We use security and log data in order to keep the service available, to prevent automated abuse of our forms, and to investigate faults and security incidents.

We use staff account data in order to control who may access the administration area and the content management system.

`[LEGAL REVIEW REQUIRED: the lawful basis for each purpose above. The platform records an explicit consent tick on both public forms and stores it as evidence, but whether consent, contract, legitimate interests or another basis is the correct lawful basis for business correspondence — and for the security processing — is a legal determination. Nothing in this repository decides it, and this draft does not assert one.]`

---

## 6. Business communications

If you send us an enquiry we will use your contact details to reply to it and to carry on the resulting conversation.

**We operate no marketing mailing list and send no newsletter.** No subscription mechanism exists on this website today.

`[LEGAL REVIEW REQUIRED: whether any statement should be made here about future marketing, and what opt-out wording is required. No marketing capability exists yet, and this draft does not promise or reserve one.]`

---

## 7. Cloudflare Turnstile

To stop automated software from abusing our forms, we use **Cloudflare Turnstile**, a bot detection service provided by Cloudflare, Inc.

**This is the only third-party content on our website.** Every other resource — including our fonts — is served from our own servers. We are stating this plainly because it is a change: earlier drafts of this policy said the site embedded no third-party content at all, and that is no longer accurate on any page that carries a form.

**Which pages this affects, and when.** Turnstile runs on every page that carries one of our two forms, and that is wider than our contact pages alone. Our general enquiry form appears on our contact page, on our quote request page, **and in the partnership panel on our home page**. Our custom formulation request form appears on our customized solutions page, including the reduced version of that page shown when its content cannot be loaded.

On each of those pages — the home page included — your browser loads a small script from `challenges.cloudflare.com` **when the page loads**, before you type anything and whether or not you go on to contact us. The check is designed to be invisible and asks you to do something only if it cannot otherwise establish that you are human.

> **Drafting note — internal design preview pages: decided, not yet implemented.**
>
> The owner has approved making the internal design preview routes **development-only**. Once that is in place they will not exist for production visitors, no third-party script will load from them, and no form on them can be reached or submitted — so this section will not need to cover them.
>
> **Until it is implemented, they remain publicly reachable in a production build**, they render the same live forms, and they load the same third-party script. This paragraph therefore still covers them, and may only be narrowed once the change has shipped.
>
> `[OWNER INPUT REQUIRED: confirmation, at publication time, that the development-only change has actually shipped — see the implementation follow-up recorded in the owner questionnaire. If it has not, this section stays as written.]`

As a result of that script loading, Cloudflare receives information about your connection. According to Cloudflare's own published documentation, Turnstile processes signals including your IP address, your browser's TLS fingerprint, its user-agent string, and an identifier for our website. Cloudflare states that the purpose of collecting these signals is to detect and block bots rather than to identify, profile or target individuals, and that it cannot directly identify an individual from them.

Three details of our own implementation are worth stating:

- **We do not send your IP address to Cloudflare ourselves.** When our server checks that your form submission carries a valid Turnstile token, it sends Cloudflare only our own secret key and that token. Cloudflare's interface allows a visitor's IP address to be passed as well; we deliberately do not pass it.
- **We do not log the token, your address, or any part of your submission** as part of this check.
- **If the check does not succeed, we do not store your submission at all.** If the security check is refused, we decline the submission. If the check cannot be carried out — because the service is unreachable, or because our own configuration is incomplete — we also decline it, and we tell you that nothing has been stored and invite you to contact us another way. In both cases the refusal happens before your details are written anywhere, so no record of that attempt is kept. This is deliberate: we would rather lose a message than accept one we could not verify.

`[LEGAL REVIEW REQUIRED: the correct characterisation of Cloudflare's role for the Turnstile signals. Cloudflare's published addendum describes itself as acting in more than one capacity depending on the processing. Do not describe Cloudflare as "our processor", or as anything else, until counsel confirms the relationship and whether a data processing agreement is in place.]`

`[OWNER INPUT REQUIRED: confirmation of which Cloudflare account and plan the Turnstile keys belong to, and whether any data localisation option has been selected. This determines where the signals are processed.]`

`[LEGAL REVIEW REQUIRED: whether Turnstile sets any cookie or other storage in the visitor's browser on this deployment, and whether it must be disclosed and/or consented to. Cloudflare documents cookies belonging to its wider challenge platform. This site is not served through Cloudflare's network and has not enabled Turnstile pre-clearance, so those cookies are not expected here — but this has not been measured in a browser, and it must be verified before publication rather than asserted.]`

---

## 8. Cookies and browser storage

**We set no cookie on the public website.** Browsing our pages, reading a product page or submitting a form does not cause us to place a cookie or to store anything in your browser.

`[LEGAL REVIEW REQUIRED: this statement must be re-verified in a browser against a fully configured production build before publication, including the Turnstile question in section 7. It is accurate as to our own code; it is an assertion about third-party behaviour that has not been observed.]`

Two cookies are used **only in the staff administration area**, and only after a member of our staff signs in. They hold sign-in credentials, they are marked so that they cannot be read by scripts in the browser and are not sent to other sites, and they are transmitted only over an encrypted connection. One expires after fifteen minutes and the other after seven days. Our content management system sets its own sign-in cookies on its separate address.

We store nothing in your browser's local or session storage anywhere on the platform.

`[OWNER INPUT REQUIRED: whether a cookie consent banner will be deployed. The website content plan includes wording for one, but no banner is implemented, and none is needed while no non-essential cookie is set. If analytics are ever introduced, both the banner and this section become mandatory.]`

---

## 9. Who we share your data with

We do not sell personal data, and we do not share it for anyone else's marketing.

Your data is handled by:

- **our own staff**, in the roles permitted to see enquiry records;
- **Cloudflare**, in connection with the bot check described in section 7;
- **our email provider**, when a short internal notice is sent to a single internal mailbox to alert our team that a submission has arrived. That notice contains the details you submitted;
- **our hosting and infrastructure provider**, which stores the data on our behalf.

`[OWNER INPUT REQUIRED: the identity of the outbound email provider. The platform's mail settings are unset, so no provider has been chosen.]`

`[OWNER INPUT REQUIRED: the identity and country of the hosting provider. No server has been acquired and no provider has been selected.]`

`[OWNER INPUT REQUIRED: the internal mailbox address that receives lead notifications, and who has access to it.]`

`[LEGAL REVIEW REQUIRED: whether each recipient above is a processor, and whether the required contracts are in place. This draft does not assert a processor relationship with any named company.]`

---

## 10. International transfers

We are based in Iran. Some of the services described in section 9 may process data outside Iran — Cloudflare in particular operates a global network — and our hosting and email providers have not yet been chosen.

`[LEGAL REVIEW REQUIRED: whether any transfer of personal data outside Iran takes place, what Iranian law requires for it, and on what legal mechanism it relies. This cannot be drafted until the governing law (section 2), the hosting location, the email provider and Cloudflare's processing location are all known. No transfer mechanism is named here, because naming one that is not actually in place would be a false statement.]`

`[LEGAL REVIEW REQUIRED: whether any transfer rule of a foreign regime applies in addition, which depends on the second question in section 2.]`

---

## 11. How long we keep your data

`[OWNER INPUT REQUIRED and LEGAL REVIEW REQUIRED: retention periods.]`

**No retention period exists for any category of data on this platform.** This is recorded in the project's own security documentation as an approved requirement that remains blocked on legal input, and it is one of the reasons this policy cannot be published in its present state. Periods are needed for at least:

- enquiry records;
- custom formulation request records;
- consent evidence, which may need to outlive the record it relates to;
- staff account and session records;
- lead workflow history, which identifies members of staff;
- server access logs;
- database backups.

Deletion must also be implemented as a real capability rather than a manual database operation, because a deletion request carries a response deadline. That capability does not exist yet.

---

## 12. How we protect your data

- Staff passwords are stored using a modern password hashing algorithm and are never recoverable in readable form.
- Sign-in sessions are stored as one-way digests, so a stolen database does not yield a usable session token.
- Sign-in credentials are held in cookies that scripts cannot read, are marked not to travel to other sites, and require an encrypted connection.
- Access to enquiry records is restricted by role, and a member of staff who is disabled loses every existing session immediately.
- Website content and operational data are kept in two separate databases with separate credentials, so neither can read the other.
- Any confidential file storage we operate is closed to anonymous access and reachable only through a short-lived signed link issued after an access check.
- Content submitted by editors is sanitised before it is served, so that it cannot execute code in a visitor's browser.
- Our forms are rate limited, in addition to the bot check in section 7.
- Database backups are taken automatically and encrypted.

`[LEGAL REVIEW REQUIRED: how much security detail should be published. The list above is accurate but detailed; counsel may prefer a shorter statement.]`

`[OWNER INPUT REQUIRED: confirmation that encrypted nightly backups are actually configured in production, and who holds the encryption keys. This is currently a documented intention; no production server exists.]`

No method of transmission or storage is completely secure, and we cannot guarantee absolute security.

---

## 13. Your rights

If you want to ask us about the personal data we hold about you, write to us at **info@Samgp.com**.

`[LEGAL REVIEW REQUIRED: the complete list of rights, their conditions and the response deadline. These follow directly from the governing law identified in section 2 and must not be drafted before it. Do not copy a standard GDPR rights list into this section unless counsel confirms a regime requiring it applies.]`

`[OWNER INPUT REQUIRED: who inside the company is responsible for answering a rights request within the legal deadline, and whether info@Samgp.com is monitored well enough to meet it. The email address is answered; the ownership of the obligation is not.]`

We note for counsel's attention that one record is deliberately immutable: the identifier of the policy version a person consented to cannot be altered once written, by design, so that consent evidence cannot be rewritten after the fact.

`[LEGAL REVIEW REQUIRED: how this interacts with a rectification or erasure request, and whether the policy must say so.]`

---

## 14. Children

This website is a business-to-business service. It is intended for professional buyers and is not directed at children, and we do not knowingly collect personal data from children.

`[LEGAL REVIEW REQUIRED: the applicable age threshold and the exact wording required in the governing jurisdiction.]`

---

## 15. Changes to this policy

We may update this policy. Each version carries a revision identifier and an effective date, both shown at the top of the page.

When we change this policy we record the new revision alongside the consents given under it, so that we can always tell which version of this text a person agreed to.

`[LEGAL REVIEW REQUIRED: whether, and how, individuals must be notified of a material change, and whether a further consent is required for changes affecting existing records.]`

---

## 16. Complaints

If you are not satisfied with how we have handled your personal data, please contact us first at **info@Samgp.com**.

`[LEGAL REVIEW REQUIRED: whether Iranian law provides a competent supervisory authority or regulator for privacy complaints, which one, and how a person complains to it. No regulator is named in this draft, because none has been identified and naming the wrong one would send people to a body that cannot help them.]`

`[LEGAL REVIEW REQUIRED: whether any foreign regulator must also be named, which depends on the second question in section 2.]`

---

## 17. Languages

This draft exists in English only.

**Legally reviewed Persian and Arabic translations are required before this policy is published in those languages.** The platform serves three languages and will show English text under a Persian or Arabic URL if a translation is missing. For editorial content that is acceptable; for a policy a visitor is asked to consent to it is not. The publishing tool refuses a partial document for exactly this reason, and no machine translation of this text may be used.

`[LEGAL REVIEW REQUIRED: Persian and Arabic translations, each reviewed by counsel in that language.]`

---

<!--
  END OF DRAFT. Nothing above is approved. Before any publication:
    1. Every [OWNER INPUT REQUIRED] and [LEGAL REVIEW REQUIRED] marker resolved.
    2. Counsel's review and sign-off recorded.
    3. Retention periods set (section 11) — currently a hard blocker.
    4. Persian and Arabic translations reviewed.
    5. Section 8's cookie statement and section 7's Turnstile storage question
       measured in a real browser against a configured production build.
    6. ADR-021 (revision binding) decided, so that the revision identifier at
       the top of this document and ACTIVE_PRIVACY_POLICY_REVISION cannot drift.
    7. The proof-route gate confirmed shipped in the deployed build. The gate is
       IMPLEMENTED as of 2 September 2026 — `design-proof` pages 307-redirect to
       their canonical default-locale routes in production and `cms-proof`
       answers 404 there, so no production visitor reaches a proof page or a
       proof form (see the questionnaire's implementation follow-up). What is
       still owed is confirmation at publication time that the production build
       actually carries it. Section 7 no longer needs to cover the
       `design-proof` pages, but must keep covering `cms-proof` for as long as
       that route exists in any environment.

  Note: this file still contains bracketed markers, which the legal-content
  validator rejects outright. It is not convertible to a publishable source by
  reformatting alone, and it must not be made so until the list above is done.
-->
