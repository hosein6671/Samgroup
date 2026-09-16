import { FAQ_PAGE_DEFAULTS, getFaqPageContent, faqPageMetadata } from "@/features/faq/page-content";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Answers, FaqSchema } from "@/features/faq/answers";
import { publishedFaq } from "@/features/faq/published-faq";
import { SiteNav } from "@/features/site/site-nav";
import { SiteFooter } from "@/features/site/site-footer";
import { localeHref } from "@/features/site/site-routes";
import { getActiveLocales } from "@/lib/locales";

import "@/features/home/flagship.css";

export const dynamic = "force-dynamic";
const topics = [
  ["company", "About the Company"],
  ["products", "Products & Specifications"],
  ["ordering", "Ordering & Samples"],
  ["export", "Export & Logistics"],
  ["customization", "Customization & Private Label"],
] as const;
type Props = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ topic?: string | string[] }>;
};
export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const [{ locale }, query] = await Promise.all([params, searchParams]);
  // Independent of each other — neither consumes the other's result.
  const [entries, faqContent] = await Promise.all([
    publishedFaq(locale),
    getFaqPageContent(locale),
  ]);
  return faqPageMetadata(locale, faqContent, !!entries?.length, !!query.topic);
}
export default async function FaqPage({ params, searchParams }: Props): Promise<ReactNode> {
  const [{ locale }, query, locales] = await Promise.all([
    params,
    searchParams,
    getActiveLocales(),
  ]);
  const topic = topics.find(([key]) => key === query.topic);
  const href = localeHref(locale, "/faq");
  // Independent of each other — `getFaqPageContent` does not depend on the topic filter.
  const [entries, faqContent] = await Promise.all([
    publishedFaq(locale, topic ? { category: topic[0] } : {}),
    getFaqPageContent(locale),
  ]);
  const copy = { ...FAQ_PAGE_DEFAULTS, ...faqContent?.fields };
  return (
    <div data-brand="flagship">
      <SiteNav locale={locale} locales={locales} />
      <main id="main-content">
        <section className="fq-hero" data-surface="midnight">
          <div className="fs-blueprint" aria-hidden="true" />
          <div className="fs-wrap">
            <p className="fs-eyebrow">{copy.eyebrow}</p>
            <h1 className="fs-d1">{copy.title}</h1>
            <p className="fs-lead">{copy.introduction}</p>
          </div>
        </section>
        <section className="fs-sec" data-surface="light">
          <div className="fs-wrap fq-layout">
            <nav className="fq-topics" aria-label="Question topics">
              <a href={href} aria-current={!topic ? "page" : undefined}>
                All questions
              </a>
              {topics.map(([key, label]) => (
                <a
                  key={key}
                  href={`${href}?topic=${key}`}
                  aria-current={topic?.[0] === key ? "page" : undefined}
                >
                  {label}
                </a>
              ))}
            </nav>
            <div>
              <h2 className="fs-d2">{topic?.[1] ?? copy.questionsHeading}</h2>
              {entries?.length ? (
                <>
                  <Answers entries={entries} />
                  <FaqSchema entries={entries} />
                </>
              ) : (
                <p className="fs-lead">
                  {entries === null
                    ? "Answers are temporarily unavailable. You can still send your question to our team."
                    : "For questions in this section, contact our team with your product and supply requirements."}
                </p>
              )}
              <aside className="fq-help">
                <h3>{copy.contactHeading}</h3>
                <p>{copy.contactText}</p>
                <a className="fs-btn fs-btn--gold" href={localeHref(locale, "/contact-us")}>
                  {copy.contactLabel}
                </a>
              </aside>
            </div>
          </div>
        </section>
      </main>
      <SiteFooter locale={locale} />
    </div>
  );
}
