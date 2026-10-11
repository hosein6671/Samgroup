import {
  structuralImage,
  structuralList,
  structuralSection,
  type StructuralFields,
} from "@/features/content/structural-copy";
import type { ReactNode } from "react";

import { Arrow } from "@/features/site/logo-mark";
import { localeHref, ROUTES } from "@/features/site/site-routes";

import { PhotoFrame } from "../branded-photo";
import { WHO_WE_ARE } from "../home-data";

/**
 * 2 · Who We Are — Concept 03.
 *
 * The statement and its lead side by side, then the three claims, each with a photograph of equal
 * height and its claim captioned underneath, so the three captions start on one line.
 *
 * Editable in /admin: every string (`who-we-are` text slots and the `who_we_are` list) and the
 * three photographs (`who_we_are`, `who_we_are_2`, `who_we_are_3`). The first photograph keeps
 * its descriptive alt as a fallback; the other two are captioned right beneath, so their fallback
 * alt is empty rather than a repeat of the caption.
 */
export function WhoWeAre({
  locale,
  editorial,
}: { readonly locale: string } & { readonly editorial?: StructuralFields }): ReactNode {
  const copy = structuralSection("home", "who-we-are", editorial);
  const claims = structuralList(editorial, "who_we_are", WHO_WE_ARE);

  return (
    <section className="fs-sec fs-who2" id="who-we-are" data-surface="light">
      <div className="fs-wrap">
        <div className="fs-who2-top">
          <div>
            <p className="fs-sr">{copy.text("who_we_are")}</p>
            <h2 className="fs-d1 fs-who2-title">
              {copy.text("a_manufacturer")} {copy.text("not_a_trading_company")}
            </h2>
          </div>
          <div>
            <p className="fs-lead">{copy.text("sam_group_produces_base_oils")}</p>
            <a href={localeHref(locale, ROUTES.aboutUs)} className="fs-textlink">
              {copy.text("learn_more_about_sam_group")}
              <Arrow size={14} />
            </a>
          </div>
        </div>

        {claims.length > 0 && (
          <div className="fs-who2-row" data-count={claims.length}>
            {claims.map((claim, i) => {
              const fallbackAlt =
                claim.photo === "who_we_are"
                  ? copy.text("industrial_lubricant_samples_and_packaging")
                  : "";
              const photo = structuralImage(editorial, claim.photo, fallbackAlt) ?? {
                src: claim.src,
                alt: fallbackAlt,
              };
              return (
                <figure className="fs-who2-cell" key={claim.photo}>
                  <PhotoFrame
                    src={photo.src}
                    alt={photo.alt}
                    className="fs-who2-photo"
                    sizes={
                      i === 0
                        ? "(max-width: 960px) calc(100vw - 40px), 50vw"
                        : "(max-width: 960px) calc(100vw - 40px), 25vw"
                    }
                  />
                  <figcaption>
                    <h3>{claim.term}</h3>
                    <p>{claim.detail}</p>
                  </figcaption>
                </figure>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
