import { ANCHORS } from "./about-anchors";

import type { AboutUsContent } from "@sam-group/types";
import type { ReactNode } from "react";
import { translator, ordinal } from "@/i18n/translate";

type IndexItem = {
  readonly id: string;
  readonly label: string;
  readonly available: boolean;
};

/**
 * A compact dossier index between the thesis and the supporting evidence.
 *
 * It is navigation, not a decorative stepper: entries only appear when the corresponding CMS
 * section exists, and every item points at the structural anchor already owned by this page.
 */
export function AboutIndex({
  content,
  locale = "en",
}: {
  readonly content: AboutUsContent;
  readonly locale?: string;
}): ReactNode {
  const t = translator(locale);
  const items: readonly IndexItem[] = [
    { id: ANCHORS.whoWeAre, label: t("Company profile"), available: content.whoWeAre !== null },
    { id: ANCHORS.expertise, label: t("Capabilities"), available: content.expertise !== null },
    {
      id: ANCHORS.advantages,
      label: t("Why partner with us"),
      available: content.competitiveAdvantages !== null,
    },
    { id: ANCHORS.team, label: t("How we work"), available: content.team !== null },
    {
      id: ANCHORS.quality,
      label: t("Quality approach"),
      available: content.qualityStandards !== null,
    },
  ];
  const availableItems = items.filter((item) => item.available);

  if (availableItems.length === 0) return null;

  return (
    <nav className="ab-index" aria-label={t("About SAM Group sections")}>
      <div className="fs-wrap ab-index-inner">
        <p className="ab-index-label">{t("Company dossier")}</p>
        <ol>
          {availableItems.map((item, index) => (
            <li key={item.id}>
              <a href={`#${item.id}`}>
                <span className="fs-tnum">{ordinal(locale, index + 1)}</span>
                <span>{item.label}</span>
              </a>
            </li>
          ))}
        </ol>
      </div>
    </nav>
  );
}
