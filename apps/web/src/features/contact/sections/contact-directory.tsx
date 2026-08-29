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

export function ContactDirectory({ content }: { content: ContactUsContent | null }): ReactNode {
  if (content === null) return null;

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
          <p className="fs-kicker">Direct contact</p>
          <h2 id="contact-directory-title" className="fs-h2">
            Reach the right team.
          </h2>
          <p className="fs-body">
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
