import type { CustomizedSolutionsCapability } from "@sam-group/types";
import type { ReactNode } from "react";
import { RichText } from "@/features/site/rich-text";
import { translator, ordinal } from "@/i18n/translate";

export function CustomizationScope({
  capabilities,
  locale = "en",
}: {
  readonly capabilities: readonly CustomizedSolutionsCapability[];
  readonly locale?: string;
}): ReactNode {
  const t = translator(locale);
  return (
    <section className="fs-sec cs-scope" data-surface="light">
      <div className="fs-wrap cs-scope-grid">
        <header className="cs-scope-head reveal-fade-rise">
          <p className="fs-eyebrow">{t("Requirement scope")}</p>
          <h2 className="fs-d2">{t("Define what needs to change—and what must stay fixed.")}</h2>
          <p className="fs-lead">
            {t(
              "Start with the dimensions that matter to your application. Availability and the review route are confirmed against the complete brief.",
            )}
          </p>
        </header>
        <ol className="cs-scope-list reveal-stagger">
          {capabilities.map((capability, index) => (
            <li key={capability.title}>
              <span>{ordinal(locale, index + 1)}</span>
              <div>
                <h3>{capability.title}</h3>
                {capability.description !== null && (
                  <p>
                    <RichText text={capability.description} />
                  </p>
                )}
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
