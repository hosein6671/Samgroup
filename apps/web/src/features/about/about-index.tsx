import { ANCHORS } from "./about-anchors";

import type { AboutUsContent } from "@sam-group/types";
import type { ReactNode } from "react";

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
export function AboutIndex({ content }: { readonly content: AboutUsContent }): ReactNode {
  const items: readonly IndexItem[] = [
    { id: ANCHORS.whoWeAre, label: "Company profile", available: content.whoWeAre !== null },
    { id: ANCHORS.expertise, label: "Capabilities", available: content.expertise !== null },
    { id: ANCHORS.team, label: "How we work", available: content.team !== null },
    {
      id: ANCHORS.quality,
      label: "Quality approach",
      available: content.qualityStandards !== null,
    },
  ];
  const availableItems = items.filter((item) => item.available);

  if (availableItems.length === 0) return null;

  return (
    <nav className="ab-index" aria-label="About SAM Group sections">
      <div className="fs-wrap ab-index-inner">
        <p className="ab-index-label">Company dossier</p>
        <ol>
          {availableItems.map((item, index) => (
            <li key={item.id}>
              <a href={`#${item.id}`}>
                <span className="fs-tnum">{String(index + 1).padStart(2, "0")}</span>
                <span>{item.label}</span>
              </a>
            </li>
          ))}
        </ol>
      </div>
    </nav>
  );
}
