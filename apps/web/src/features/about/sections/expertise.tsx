import { ANCHORS } from "../about-anchors";

import type { AboutUsExpertise } from "@sam-group/types";
import type { ReactNode } from "react";

/**
 * Our Expertise — a numbered register of named areas.
 *
 * An ordered list, because the numbers beside each row are its position rather than decoration: a
 * screen reader announces the same sequence a sighted reader sees, and the register's own count
 * comes from the list rather than from a second field that could disagree with it.
 *
 * The whole section is absent when the CMS holds nothing for it; the heading, the lead and the list
 * are each optional within it.
 */
export function AboutExpertise({ expertise }: { readonly expertise: AboutUsExpertise }): ReactNode {
  return (
    <section className="fs-sec ab-expertise" id={ANCHORS.expertise} data-surface="midnight">
      <div className="fs-blueprint" aria-hidden="true" />
      <div className="fs-wrap ab-expertise-inner">
        <header className="ab-expertise-head reveal-fade-rise">
          <div>
            <p className="fs-eyebrow">Our expertise</p>
            {expertise.heading !== null && <h2 className="fs-d2">{expertise.heading}</h2>}
          </div>
          {expertise.lead !== null && <p className="fs-lead">{expertise.lead}</p>}
        </header>

        {expertise.items.length > 0 && (
          <div className="ab-register reveal-fade-rise">
            <p className="ab-register-head">
              <span>Named areas</span>
              <span className="fs-tnum">{String(expertise.items.length).padStart(2, "0")}</span>
            </p>
            <ol className="ab-register-list">
              {expertise.items.map((item, index) => (
                <li className="ab-register-row" key={item.name}>
                  <span className="ab-register-num fs-tnum">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <span className="ab-register-name">{item.name}</span>
                </li>
              ))}
            </ol>
          </div>
        )}
      </div>
    </section>
  );
}
