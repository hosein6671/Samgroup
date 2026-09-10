import type { ReactNode } from "react";
import type { FaqEntry } from "../products/category/category-contract";
import { JsonLd } from "../seo/json-ld";
import { localeHref } from "../site/site-routes";
import { publishedFaq } from "./published-faq";
import "./faq.css";

export function Answers({ entries }: { entries: FaqEntry[] }): ReactNode {
  return (
    <div className="fq-answers">
      {entries.map((entry) => (
        <details key={entry.id}>
          <summary>{entry.question}</summary>
          <div>
            {entry.answer.split(/\n\s*\n/).map((text, index) => (
              <p key={index}>{text}</p>
            ))}
          </div>
        </details>
      ))}
    </div>
  );
}

export function FaqSchema({ entries }: { entries: FaqEntry[] }): ReactNode {
  if (!entries.length) return null;
  return (
    <JsonLd
      data={{
        "@context": "https://schema.org",
        "@type": "FAQPage",
        mainEntity: entries.map((entry) => ({
          "@type": "Question",
          name: entry.question,
          acceptedAnswer: { "@type": "Answer", text: entry.answer },
        })),
      }}
    />
  );
}

export async function ContactFaq({ locale }: { locale: string }): Promise<ReactNode> {
  const entries = await publishedFaq(locale, { contact: "true" });
  if (!entries?.length) return null;
  return (
    <section className="fs-sec fq-contact" data-surface="light" id="faq">
      <div className="fs-wrap">
        <p className="fs-eyebrow">Before you enquire</p>
        <h2 className="fs-d2">A few useful answers.</h2>
        <Answers entries={entries} />
        <FaqSchema entries={entries} />
        <a className="fs-btn" href={localeHref(locale, "/faq")}>
          Browse all questions →
        </a>
      </div>
    </section>
  );
}
