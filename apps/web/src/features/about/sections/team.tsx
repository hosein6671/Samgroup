import { LogoMark } from "@/features/site/logo-mark";

import { ANCHORS } from "../about-anchors";
import { SectionFigure } from "./hero";

import type { AboutUsTeam } from "@sam-group/types";
import type { ReactNode } from "react";

export function AboutTeam({ team }: { readonly team: AboutUsTeam }): ReactNode {
  return (
    <section className="fs-sec ab-team" id={ANCHORS.team} data-surface="midnight">
      <div className="fs-blueprint" aria-hidden="true" />
      <div className="fs-wrap ab-team-grid" data-figure={team.figure === null ? "no" : "yes"}>
        <header className="ab-team-head reveal-fade-rise">
          {team.eyebrow !== null && <p className="fs-eyebrow">{team.eyebrow}</p>}
          {team.heading !== null && <h2 className="fs-d2">{team.heading}</h2>}
          {team.lead !== null && <p className="fs-lead">{team.lead}</p>}
        </header>

        {team.figure !== null && (
          <div className="ab-team-visual reveal-mask-wipe">
            <SectionFigure figure={team.figure} />
            <span className="ab-team-brand" aria-hidden="true">
              <LogoMark height={34} />
            </span>
          </div>
        )}

        {team.functions.length > 0 && (
          <ol className="ab-team-functions reveal-stagger">
            {team.functions.map((item, index) => (
              <li key={item.name}>
                <span className="fs-tnum">{String(index + 1).padStart(2, "0")}</span>
                <div>
                  <h3>{item.name}</h3>
                  <p>{item.note}</p>
                </div>
              </li>
            ))}
          </ol>
        )}
      </div>
    </section>
  );
}
