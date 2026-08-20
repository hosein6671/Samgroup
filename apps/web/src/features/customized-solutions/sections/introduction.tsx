import type { CustomizedSolutionsIntroduction } from "@sam-group/types";
import type { ReactNode } from "react";

/**
 * The introduction — the page's positioning, as prose.
 *
 * `bodyHtml` arrives allow-list-sanitized from NestJS: the boundary is the API so that every
 * consumer inherits one policy (API_CONTRACT_FINAL §2.4a). Sanitizing again here would add a second
 * policy to keep in step with the first, not a second layer of safety.
 *
 * The "three sections are not on this page yet" aside that stood here until the CMS cutover is
 * gone. It described the fixture's incompleteness, which is scaffolding rather than editorial
 * content; what the page publishes now is whatever an editor has written, and a section nobody has
 * written simply does not appear.
 */
export function SolutionsIntroduction({
  introduction,
}: {
  readonly introduction: CustomizedSolutionsIntroduction;
}): ReactNode {
  return (
    <section className="fs-sec cs-intro" data-surface="light">
      <div className="fs-wrap cs-intro-grid">
        <header className="cs-intro-head reveal-fade-rise">
          <p className="fs-eyebrow">Introduction</p>
          {introduction.heading !== null && <h2 className="fs-d2">{introduction.heading}</h2>}
        </header>
        {introduction.bodyHtml !== "" && (
          <div
            className="cs-intro-body cs-intro-prose reveal-fade-rise"
            dangerouslySetInnerHTML={{ __html: introduction.bodyHtml }}
          />
        )}
      </div>
    </section>
  );
}
