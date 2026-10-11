import {
  structuralImage,
  structuralList,
  structuralSection,
  type StructuralFields,
} from "@/features/content/structural-copy";
import type { ReactNode } from "react";

import { Arrow } from "@/features/site/logo-mark";
import { localeHref, ROUTES } from "@/features/site/site-routes";

import { HERO_SHOTS, HERO_SPEC } from "../home-data";
import { HeroReel } from "./hero-reel";

/**
 * 1 · Hero — Concept 03's cinematic reel.
 *
 * Everything a reader sees is editable in /admin: the eyebrow, the three headline lines, the lead
 * and both actions (`hero` text slots), the facts in the player bar (`hero_facts`), the shot names
 * (`hero_shots`) and the four photographs (`hero_shot_1` to `hero_shot_4`). An empty photograph
 * slot keeps the built-in lab photograph; a removed shot leaves the reel, and a reel of one shot
 * simply holds still.
 *
 * The shots are decorative (`alt=""`): the headline and lead carry the meaning, and four rotating
 * descriptions would only be noise to a screen reader.
 */
export function Hero({
  locale,
  editorial,
}: { readonly locale: string } & { readonly editorial?: StructuralFields }): ReactNode {
  const copy = structuralSection("home", "hero", editorial);
  const facts = structuralList(editorial, "hero_facts", HERO_SPEC).map(({ value, label }) => ({
    value,
    label,
  }));
  const shots = structuralList(editorial, "hero_shots", HERO_SHOTS).map((shot) => ({
    name: shot.name,
    src: structuralImage(editorial, shot.slot, "")?.src ?? shot.src,
    focus: shot.focus,
    drift: shot.drift,
  }));

  return (
    <HeroReel
      shots={shots}
      facts={facts}
      barTitle={copy.text("portfolio_at_a_glance")}
      exploreLabel={copy.text("explore_the_sam_group_portfolio")}
      exploreHref="#who-we-are"
    >
      <div className="fs-cine-copy">
        <p className="fs-eyebrow fs-cine-eyebrow">
          {copy.text("petroleum_products_for_professional_buyers")}
        </p>
        <h1 className="fs-cine-title">
          <span className="fs-cine-line">{copy.text("base_oils_and_lubricants")}</span>
          <span className="fs-cine-line">{copy.text("produced_not_traded")}</span>
          <span className="fs-cine-line">{copy.text("specified_with_you")}</span>
        </h1>
        <p className="fs-cine-lead">{copy.text("sam_group_produces_and_supplies")}</p>
        <div className="fs-cine-cta">
          <a href={localeHref(locale, ROUTES.products)} className="fs-btn fs-btn--gold">
            {copy.text("explore_our_products")}
            <Arrow />
          </a>
          <a href={localeHref(locale, ROUTES.requestQuote)} className="fs-btn fs-btn--glass">
            {copy.text("request_a_quotation")}
          </a>
        </div>
      </div>
    </HeroReel>
  );
}
