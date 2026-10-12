"use client";
import {
  structuralImage,
  structuralList,
  structuralSection,
  type StructuralFields,
} from "@/features/content/structural-copy";

import { useEffect, useRef, type ReactNode } from "react";

import {
  FormulationIcon,
  ManufacturerIcon,
  QualityIcon,
  SampleIcon,
  SearchIcon,
  SupplyIcon,
  type IconProps,
} from "@/features/site/icons";
import { Arrow } from "@/features/site/logo-mark";
import { localeHref } from "@/features/site/site-routes";

import { PhotoFrame } from "../branded-photo";
import { RichText } from "@/features/site/rich-text";
import { CUSTOM_CTA, CUSTOM_STEPS, type Stage } from "../home-data";

const GLYPHS: Record<Stage["icon"], (props: IconProps) => ReactNode> = {
  search: SearchIcon,
  formulation: FormulationIcon,
  sample: SampleIcon,
  quality: QualityIcon,
  manufacturer: ManufacturerIcon,
  supply: SupplyIcon,
};

/** Pinned mode needs room for a horizontal track; below this width the track is a native swipe. */
const PIN_MIN_WIDTH = 961;

/**
 * 7 · Customized Solutions — Concept 03's pinned horizontal track.
 *
 * The head (statement, lead and both actions) sits above a track that holds the photograph and the
 * six step cards. On a wide screen the track pins and vertical scroll drives it sideways; it stops
 * when the last card reaches the page's right gutter, the same line every other section ends on.
 * Each step lights as it crosses the reading line, and the progress line and step dots follow.
 * Narrow screens and reduced motion get a native swipe track instead, with every step lit.
 *
 * Editable in /admin: the head (`custom-formulation` text slots), each step's title, body, input
 * and output (`custom_steps`) and the photograph (`custom_formulation`).
 */
export function CustomFormulation({
  locale,
  editorial,
}: { readonly locale: string } & { readonly editorial?: StructuralFields }): ReactNode {
  const copy = structuralSection("home", "custom-formulation", editorial);
  const steps = structuralList(editorial, "custom_steps", CUSTOM_STEPS, { rich: ["body"] });
  const photo = structuralImage(
    editorial,
    "custom_formulation",
    copy.text("oil_sample_review_beside_packaged"),
  ) ?? {
    src: "/images/customized-solutions-requirement-review.webp",
    alt: copy.text("oil_sample_review_beside_packaged"),
  };

  const pinRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const fillRef = useRef<HTMLElement>(null);
  const dotsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const pin = pinRef.current;
    const track = trackRef.current;
    if (!pin || !track) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    const cards = (): HTMLElement[] => [...track.querySelectorAll<HTMLElement>(".fs-hstep")];
    const dots = (): HTMLElement[] => [...(dotsRef.current?.children ?? [])] as HTMLElement[];
    const pinned = (): boolean => window.innerWidth >= PIN_MIN_WIDTH && !reduced.matches;
    // Right-to-left pages lay the cards out leftwards, so the track travels the other way and
    // ends on the left gutter.
    const rtl = (): boolean => getComputedStyle(track).direction === "rtl";

    let dist = 0;
    let mode: boolean | null = null;

    const light = (p: number): void => {
      const line = window.innerWidth * (0.62 + 0.38 * p);
      const ds = dots();
      const backwards = rtl();
      cards().forEach((card, i) => {
        const r = card.getBoundingClientRect();
        const crossed = backwards ? r.right > window.innerWidth - line : r.left < line;
        const on = !pinned() && reduced.matches ? true : crossed;
        card.dataset.lit = on ? "true" : "";
        ds[i]?.toggleAttribute("data-on", on);
      });
    };

    const measure = (): void => {
      mode = pinned();
      track.style.transform = "";
      if (!mode) {
        pin.style.height = "";
        dist = 0;
        return;
      }
      const last = cards().at(-1)?.getBoundingClientRect();
      const gutter = parseFloat(getComputedStyle(track).paddingInlineStart) || 0;
      if (!last) dist = 0;
      else if (rtl()) dist = Math.max(0, Math.ceil(gutter - last.left));
      else
        dist = Math.max(0, Math.ceil(last.right - (document.documentElement.clientWidth - gutter)));
      pin.style.height = `${window.innerHeight + dist}px`;
    };

    // Called straight from the scroll event: browsers already deliver scroll at most once per
    // frame, and an extra requestAnimationFrame hop only lags (or stalls, in a throttled tab).
    const update = (): void => {
      if (pinned() !== mode) measure();
      if (!mode) {
        light(0);
        return;
      }
      const top = pin.getBoundingClientRect().top;
      const p = Math.min(1, Math.max(0, -top / Math.max(1, dist)));
      const shift = (rtl() ? p : -p) * dist;
      track.style.transform = `translate3d(${shift.toFixed(1)}px,0,0)`;
      if (fillRef.current) fillRef.current.style.width = `${p * 100}%`;
      light(p);
    };
    const onSwipe = (): void => {
      if (pinned()) return;
      // scrollLeft runs negative on a right-to-left track; the distance travelled is what counts.
      const p = Math.abs(track.scrollLeft) / Math.max(1, track.scrollWidth - track.clientWidth);
      if (fillRef.current) fillRef.current.style.width = `${p * 100}%`;
      light(p);
    };
    const relayout = (): void => {
      measure();
      update();
    };

    relayout();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", relayout, { passive: true });
    track.addEventListener("scroll", onSwipe, { passive: true });
    reduced.addEventListener("change", relayout);
    void document.fonts?.ready.then(relayout);
    return () => {
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", relayout);
      track.removeEventListener("scroll", onSwipe);
      reduced.removeEventListener("change", relayout);
      pin.style.height = "";
      track.style.transform = "";
    };
  }, [steps.length]);

  if (steps.length === 0) return null;

  return (
    <section className="fs-cf" id="custom-formulation" data-surface="light">
      <div className="fs-wrap fs-cf-head">
        <div>
          <p className="fs-sr">{copy.text("customized_solutions")}</p>
          <h2 className="fs-d2">{copy.text("when_the_catalogue_is_only")}</h2>
          <p className="fs-lead">{copy.rich("where_a_standard_product_does")}</p>
        </div>
        <div className="fs-cf-cta">
          <a href={localeHref(locale, CUSTOM_CTA.primary.href)} className="fs-btn fs-btn--gold">
            {copy.text("primary_cta")}
            <Arrow />
          </a>
          <a
            href={localeHref(locale, CUSTOM_CTA.secondary.href)}
            className="fs-btn fs-btn--outline"
          >
            {copy.text("secondary_cta")}
          </a>
        </div>
      </div>

      <div className="fs-hpin" ref={pinRef}>
        <div className="fs-hstage">
          <div
            className="fs-htrack"
            ref={trackRef}
            tabIndex={0}
            aria-label={copy.text("from_requirement_to_finished_product")}
          >
            <PhotoFrame
              src={photo.src}
              alt={photo.alt}
              className="fs-hphoto"
              sizes="(max-width: 960px) 84vw, 46vw"
            />
            {steps.map((step) => {
              const Glyph = GLYPHS[step.icon];
              return (
                <article className="fs-hstep" key={step.n}>
                  <span className="fs-hstep-glyph" aria-hidden="true">
                    <Glyph size="xl" />
                  </span>
                  <span className="fs-hstep-n fs-tnum" aria-hidden="true">
                    {step.n}
                  </span>
                  <h3>{step.title}</h3>
                  <p>
                    <RichText text={step.body} />
                  </p>
                  <dl>
                    <div>
                      <dt>{copy.text("input_label")}</dt>
                      <dd>{step.input}</dd>
                    </div>
                    <div>
                      <dt>{copy.text("output_label")}</dt>
                      <dd>{step.output}</dd>
                    </div>
                  </dl>
                </article>
              );
            })}
          </div>
          <div className="fs-wrap fs-hprog" aria-hidden="true">
            <span className="fs-hprog-meta">
              {copy.text("from_requirement_to_finished_product")}
            </span>
            <div className="fs-hprog-line">
              <i ref={fillRef} />
            </div>
            <div className="fs-hprog-dots" ref={dotsRef}>
              {steps.map((step) => (
                <span key={step.n}>{step.n}</span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
