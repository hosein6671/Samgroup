import Link from "next/link";

import { VisuallyHidden } from "@sam-group/ui";

import type { ReactNode } from "react";

/**
 * The consent checkbox's label — one sentence, with the policy named and, when there is one to
 * name, linked.
 *
 * ── Why the two forms share this ────────────────────────────────────────────
 *
 * The Contact Us inquiry form and the Customized Solutions request form each collect personal data
 * under the same lawful basis, and each carried its own copy of the sentence. They now carry the
 * same *lead* and share this component for the part that varies, so a policy that is linked on one
 * form cannot be plain text on the other — the divergence `consent-target.spec.ts` already guards
 * against for the control itself.
 *
 * ── The link is conditional, and that is the whole design ───────────────────
 *
 * `privacyPolicyHref` is `null` unless the CMS is serving a published Privacy Policy — see
 * `features/legal/privacy-policy.ts`, which resolves it once per request. With no policy published
 * the sentence is exactly the wording both forms carried before: the policy is named, and nothing
 * links to a 404 beside a consent checkbox. ROADMAP.md's ratified ordering is enforced by that
 * condition rather than by a flag, and its other precondition — policy-version persistence in
 * `sam_platform` — closed on 18 August 2026.
 *
 * ── Two details that are not decoration ─────────────────────────────────────
 *
 * **It opens in a new tab.** Navigating away mid-form discards everything typed into it; a consent
 * link is the one link a visitor is most likely to follow while a form is half-filled. The
 * departure from the platform's same-tab default is announced rather than silent — `VisuallyHidden`
 * carries "(opens in a new tab)" into the accessible name, which is what WCAG 3.2.5 asks for when a
 * link changes context.
 *
 * **An anchor inside a `<label>` is safe here.** HTML defines a label's activation behaviour as
 * doing nothing when the event target is an interactive descendant, so following this link does not
 * also toggle the consent checkbox. The alternative — hoisting the link out of the label — would
 * break the sentence in two and leave the policy unnamed inside the statement being agreed to.
 */
export function ConsentLabel({
  lead,
  privacyPolicyHref,
}: {
  /**
   * The form-specific opening of the sentence, ending immediately before the policy is named and
   * without trailing punctuation — e.g. "I agree to be contacted about this enquiry and accept
   * the".
   */
  readonly lead: string;
  /** The published policy's address in this locale, or `null` when there is no published policy. */
  readonly privacyPolicyHref: string | null;
}): ReactNode {
  if (privacyPolicyHref === null) {
    return <>{`${lead} ${PRIVACY_POLICY_PHRASE}.`}</>;
  }

  return (
    <>
      {`${lead} `}
      <Link
        className="fm-consent-policy"
        href={privacyPolicyHref}
        target="_blank"
        rel="noopener noreferrer"
      >
        {PRIVACY_POLICY_PHRASE}
        <VisuallyHidden as="span"> (opens in a new tab)</VisuallyHidden>
      </Link>
      .
    </>
  );
}

/**
 * How both forms name the document, in the middle of a sentence.
 *
 * Lower case because it sits mid-sentence, and identical in both places so the linked and unlinked
 * renderings read the same. Exported so specs can assert the sentence rather than restate it.
 */
export const PRIVACY_POLICY_PHRASE = "privacy policy";
