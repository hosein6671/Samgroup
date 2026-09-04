import type { ReactNode } from "react";

import { JsonLd, type JsonLdObject } from "@/features/seo/json-ld";
import { ORGANIZATION_NAME, organizationId, siteOrigin } from "@/features/seo/site";
import { getContactUsContent } from "@/lib/content";

import { ContactDirectory } from "./contact-directory";

/**
 * The Contact Us directory, with its own data dependency — the boundary between a page that renders
 * immediately and a CMS read that may not.
 *
 * ── Why the fetch moved down here ───────────────────────────────────────────
 *
 * The route awaited `getContactUsContent` before rendering anything, so a slow or stopped CMS
 * delayed the hero, the pathways and — the part that matters — the enquiry form, which is the one
 * thing on this page that reaches a person and which needs no CMS at all. Wrapping this component
 * in `Suspense` (see the route) lets the rest of the page stream first and the channels arrive when
 * they arrive, with `ContactDirectorySkeleton` standing in meanwhile.
 *
 * The `Organization` structured data comes with it, because it is assembled from the same values.
 * Its position in the document is irrelevant to a consumer — JSON-LD is collected from the whole
 * page — and keeping it here means nothing outside this boundary blocks on the CMS.
 *
 * ── Four outcomes, and none of them invents a channel ───────────────────────
 *
 * | Condition                                            | Rendered                              |
 * | ---------------------------------------------------- | ------------------------------------- |
 * | The Global holds at least one confirmed channel       | the directory, plus `Organization`     |
 * | The Global is published but every field is empty      | nothing — the API reports it unavailable, and an empty contact block is worse than none |
 * | Only a draft exists, or nothing is published          | nothing — drafts are not public        |
 * | The API or the CMS did not answer                     | the unavailable notice, no JSON-LD     |
 *
 * The last row is the one that must not be silent. "We have no phone number" and "the CMS is down"
 * are different facts, and a reader who came here for a phone number deserves the second one rather
 * than a page that quietly omits the section. It carries no channel and makes no claim; it points
 * at the form, which still works.
 *
 * `Organization` is emitted only alongside real values. Structured data asserting a company exists
 * while listing no way to contact it is not worth publishing, and a partially-failed read must not
 * become a partially-true claim.
 */
export async function ContactDirectorySection({
  locale,
}: {
  readonly locale: string;
}): Promise<ReactNode> {
  const result = await getContactUsContent(locale);

  if (!result.ok) {
    if (result.reason === "not-configured") {
      // Published and empty, draft-only, or never published. All three are "no confirmed channel
      // exists", which is exactly what an absent section says.
      return null;
    }

    /*
     * Reported server-side, and specific about which service failed — the same distinction the
     * Privacy Policy route logs, for the same operational reason: a 503 means NestJS did not get an
     * answer from Payload, while `unreachable` means NestJS itself did not answer.
     */
    console.warn(
      `[contact-us] rendering the directory's unavailable state — ` +
        (result.reason === "unreachable"
          ? "the platform API did not respond (down, refused, timed out, or API_INTERNAL_URL unset)"
          : result.status === 503
            ? "the platform API answered 503 — the CMS did not respond to it"
            : `the platform API answered, but not with contact channels (HTTP ${String(result.status)})`),
    );

    return <ContactDirectory content={null} unavailable />;
  }

  const content = result.content;

  /*
   * `sameAs` is for profiles that identify the organization, so WhatsApp is deliberately not in it:
   * a `wa.me` deep link is a contact action, not a profile page. The list is built before the
   * object so an empty one omits the key entirely rather than emitting `sameAs: []`.
   */
  const profiles = [content.linkedinUrl, content.instagramUrl, content.telegramUrl].filter(
    (value): value is string => value !== null,
  );

  const organization: JsonLdObject = {
    "@context": "https://schema.org",
    "@type": "Organization",
    /*
     * The SAME `@id` the locale layout emits. Consumers merge nodes that share one, so this adds
     * the confirmed contact channels to the organization the layout already identified rather than
     * describing a second entity — which is exactly why the identifier lives in one module.
     */
    "@id": organizationId(),
    name: ORGANIZATION_NAME,
    url: `${siteOrigin()}/`,
    ...(content.mainPhone !== null && { telephone: content.mainPhone }),
    ...(content.generalEmail !== null && { email: content.generalEmail }),
    ...(content.address !== null && { address: content.address }),
    ...(profiles.length > 0 && { sameAs: profiles }),
  };

  return (
    <>
      <JsonLd data={organization} />
      <ContactDirectory content={content} />
    </>
  );
}

/**
 * What stands in the directory's place while the CMS read is in flight.
 *
 * It reproduces the section's heading and the shape of its grid, and **states nothing**: no channel,
 * no label, no count. `aria-busy` and a polite live region are what tell assistive technology that
 * this region is still resolving, so the announcement happens once the real content replaces it
 * rather than on every skeleton cell.
 *
 * A skeleton that guessed at how many channels exist would flash a layout the real answer then
 * contradicts, so the placeholder rows are a fixed, neutral two.
 */
export function ContactDirectorySkeleton(): ReactNode {
  return (
    <section
      className="ct-directory ct-directory--pending"
      aria-labelledby="contact-directory-title"
      aria-busy="true"
    >
      <div className="fs-wrap ct-directory-inner">
        <header className="ct-directory-head">
          <p className="fs-eyebrow">Direct contact</p>
          <h2 id="contact-directory-title" className="fs-d3">
            Reach the right team.
          </h2>
          <p className="fs-lead" role="status">
            Loading contact channels…
          </p>
        </header>

        <div className="ct-directory-list" aria-hidden="true">
          <div className="ct-directory-item">
            <span className="ct-skeleton ct-skeleton--label" />
            <span className="ct-skeleton ct-skeleton--value" />
          </div>
          <div className="ct-directory-item">
            <span className="ct-skeleton ct-skeleton--label" />
            <span className="ct-skeleton ct-skeleton--value" />
          </div>
        </div>
      </div>
    </section>
  );
}
