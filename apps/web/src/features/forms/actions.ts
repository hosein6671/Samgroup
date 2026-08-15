"use server";

import { buildBody, checked, submitTo, text, textList } from "./submit";

import type { SubmissionState } from "./submission-state";

/**
 * The platform's public form submissions, as Server Actions.
 *
 * ── Why a Server Action and not a client `fetch` ────────────────────────────
 *
 * FRONTEND_ARCHITECTURE §11 decides it: writes go through Server Actions, "keeping the mutation
 * server-side". It is not a preference here — `apps/api` runs with `cors: false` because
 * API_CONTRACT_FINAL §1 states that no browser-originated call ever reaches NestJS, so a
 * client-side POST to the API could not succeed and would leak the internal origin trying.
 *
 * The browser therefore posts to Next, Next posts to NestJS, and NestJS is the only thing that
 * speaks to Prisma. No page in this feature imports `@prisma/client`, a database URL, or Payload.
 *
 * ── Both actions read `FormData`, never a typed object ──────────────────────
 *
 * That is what lets the `<form>` submit before hydration: React posts the same `FormData` the
 * platform would have posted on its own, so the form works with JavaScript disabled and the client
 * component's only job is rendering the result.
 *
 * ── Neither action validates ────────────────────────────────────────────────
 *
 * Field names are whitelisted here — nothing reaches the API that these lists do not name — but no
 * rule about a value is stated on this side. The DTOs are the authority (`whitelist` +
 * `forbidNonWhitelisted`, required fields, lengths, enum membership, `consentGiven === true`), and
 * a second copy of those rules in the browser would be a second thing to keep in step. What comes
 * back is `details: [{field, issue}]`, keyed by the same names the inputs carry.
 */

/**
 * `POST /inquiries` — General Contact, Request a Quote and Request a Sample alike.
 *
 * `inquiryType` is submitted as a field like any other. It is a real `<select>` on the Contact Us
 * form and a hidden input on the pre-filtered routes; either way the API validates it against the
 * seven-value enum, so a tampered hidden field is a 400 rather than a mis-filed lead.
 *
 * `relatedProductId` is likewise just a hidden field, and likewise not trusted: the API verifies it
 * resolves to a real `Product` before writing and answers 400 naming the field if it does not.
 */
export async function submitInquiry(
  previous: SubmissionState,
  form: FormData,
): Promise<SubmissionState> {
  return submitTo(
    "/inquiries",
    buildBody({
      firstName: text(form, "firstName"),
      lastName: text(form, "lastName"),
      companyName: text(form, "companyName"),
      country: text(form, "country"),
      email: text(form, "email"),
      phone: text(form, "phone"),
      industry: text(form, "industry"),
      inquiryType: text(form, "inquiryType"),
      productsOfInterest: textList(form, "productsOfInterest"),
      relatedProductId: text(form, "relatedProductId"),
      requiredQuantity: text(form, "requiredQuantity"),
      destinationCountryPort: text(form, "destinationCountryPort"),
      preferredIncoterm: text(form, "preferredIncoterm"),
      message: text(form, "message"),
      consentGiven: checked(form, "consentGiven"),
    }),
    previous,
  );
}

/**
 * `POST /custom-formulation-requests` — the Custom Product Request form on Customized Solutions.
 *
 * **The file input is not read.** The form still renders "Upload technical specifications" because
 * SITE_STRUCTURE §5 specifies it, but `POST /media/upload` is contracted and unbuilt and
 * `attachmentMediaId` is not a field either DTO accepts. Reading the file here would mean
 * discarding it silently; the control is disabled instead and the form says why.
 */
export async function submitCustomFormulationRequest(
  previous: SubmissionState,
  form: FormData,
): Promise<SubmissionState> {
  return submitTo(
    "/custom-formulation-requests",
    buildBody({
      companyName: text(form, "companyName"),
      country: text(form, "country"),
      industry: text(form, "industry"),
      email: text(form, "email"),
      phone: text(form, "phone"),
      productOrApplication: text(form, "productOrApplication"),
      requiredSpecifications: text(form, "requiredSpecifications"),
      estimatedQuantity: text(form, "estimatedQuantity"),
      packagingRequirements: text(form, "packagingRequirements"),
      destinationCountry: text(form, "destinationCountry"),
      preferredIncoterm: text(form, "preferredIncoterm"),
      additionalInformation: text(form, "additionalInformation"),
      consentGiven: checked(form, "consentGiven"),
    }),
    previous,
  );
}
