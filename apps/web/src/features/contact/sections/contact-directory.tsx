import type { ReactNode } from "react";
import type { ContactUsContent } from "@sam-group/types";

function phoneHref(value: string): string {
  return `tel:${value.replace(/[^+\d]/g, "")}`;
}

function ContactItem({
  label,
  value,
  href,
}: {
  label: string;
  value: string;
  href?: string;
}): ReactNode {
  return (
    <div className="ct-directory-item">
      <dt>{label}</dt>
      <dd>{href ? <a href={href}>{value}</a> : <address>{value}</address>}</dd>
    </div>
  );
}

/**
 * The confirmed contact channels, exactly as the CMS holds them.
 *
 * Every field is optional and every one is rendered only when it carries a value, so this component
 * publishes no channel the company has not confirmed — the same discipline the footer and the
 * Quality page keep. It invents no label, no working hours and no map.
 *
 * `content === null` means one of two different things, and `unavailable` is what separates them:
 * without it, no confirmed channel exists and the section is absent; with it, the API or the CMS
 * did not answer and the section says so. Reporting "unknown" as "none" is the mistake ADR-010 §7
 * names on the Privacy Policy route, and it is the same mistake here — a reader who cannot see a
 * phone number should be told the list could not be loaded, not left to conclude there is none.
 */
export function ContactDirectory({
  content,
  unavailable = false,
}: {
  readonly content: ContactUsContent | null;
  /** True only when the API or the CMS failed to answer. Never true for an unpublished Global. */
  readonly unavailable?: boolean;
}): ReactNode {
  if (content === null) {
    if (!unavailable) return null;

    return (
      <section className="ct-directory" aria-labelledby="contact-directory-title">
        <div className="fs-wrap ct-directory-inner">
          <header className="ct-directory-head">
            <p className="fs-eyebrow">Direct contact</p>
            <h2 id="contact-directory-title" className="fs-d3">
              Reach the right team.
            </h2>
            {/*
             * States the condition and nothing else. It names no channel, promises no restoration
             * time, and points at the enquiry form below, which does not depend on the CMS.
             */}
            <p className="fs-lead" role="status">
              Direct contact channels cannot be loaded right now. The enquiry form below still
              reaches the team.
            </p>
          </header>
        </div>
      </section>
    );
  }

  const social = [
    ["WhatsApp", content.whatsappUrl],
    ["LinkedIn", content.linkedinUrl],
    ["Instagram", content.instagramUrl],
    ["Telegram", content.telegramUrl],
  ] as const;

  return (
    <section className="ct-directory" aria-labelledby="contact-directory-title">
      <div className="fs-wrap ct-directory-inner">
        <header className="ct-directory-head">
          <p className="fs-eyebrow">Direct contact</p>
          <h2 id="contact-directory-title" className="fs-d3">
            Reach the right team.
          </h2>
          <p className="fs-lead">
            Use a direct channel for general or sales enquiries, or send the structured form below.
          </p>
        </header>

        <dl className="ct-directory-list">
          {content.mainPhone && (
            <ContactItem
              label="Main phone"
              value={content.mainPhone}
              href={phoneHref(content.mainPhone)}
            />
          )}
          {content.salesPhone && (
            <ContactItem
              label="Sales phone"
              value={content.salesPhone}
              href={phoneHref(content.salesPhone)}
            />
          )}
          {content.generalEmail && (
            <ContactItem
              label="General email"
              value={content.generalEmail}
              href={`mailto:${content.generalEmail}`}
            />
          )}
          {content.salesEmail && (
            <ContactItem
              label="Sales email"
              value={content.salesEmail}
              href={`mailto:${content.salesEmail}`}
            />
          )}
          {social.map(
            ([label, href]) =>
              href && <ContactItem key={label} label={label} value={`Open ${label}`} href={href} />,
          )}
          {content.address && <ContactItem label="Address" value={content.address} />}
        </dl>
      </div>
    </section>
  );
}
