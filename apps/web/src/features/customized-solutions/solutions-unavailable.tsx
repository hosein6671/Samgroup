import "../home/flagship.css";
import "../products/products.css";
import "../forms/forms.css";
import "./solutions.css";

import { SiteFooter } from "@/features/site/site-footer";
import { SiteNav, type SiteNavProps } from "@/features/site/site-nav";
import { ROUTES } from "@/features/site/site-routes";

import { CustomRequestForm } from "./sections/custom-request-form";

import type { ReactNode } from "react";

/**
 * What `/customized-solutions` renders when it has no editorial copy to render.
 *
 * ── Why this is not a 404, ever ─────────────────────────────────────────────
 *
 * `/customized-solutions` is a structural route: it is in the header, in the footer, in the sitemap,
 * and it is where the request form lives. A 404 on it states that the page does not exist, to a
 * visitor and to a crawler that will act on it. Neither cause of an empty render is that statement:
 *
 * - **`not-configured`** — the CMS answered and holds no published document. Editorial work is
 *   outstanding, which is a fact about a schedule, not about the URL.
 * - **`service`** — the API or the CMS behind it did not answer. Infrastructure failure must never
 *   become a canonical 404 (ADR-010 §7, held for every canonical route).
 *
 * ── The form stays, and that is the deliberate difference from About Us ─────
 *
 * About Us has nothing to offer when its Global is empty, so its unavailable state is a message and
 * a way out. This page does: the Custom Product Request form is Prisma's and the API's, it takes no
 * CMS input, and it works whether or not an editor has published a word. Removing it here would
 * take a working lead-capture path off the site because *editorial* content was missing — turning a
 * copy problem into a commercial one.
 *
 * So the state is stated plainly at the top, and the form below it is the same component, with the
 * same fields, the same validation and the same submission as on the published page.
 */
export function SolutionsUnavailable({
  locale,
  locales,
  reason,
}: {
  readonly locale: string;
  readonly locales: SiteNavProps["locales"];
  readonly reason: "not-configured" | "service";
}): ReactNode {
  return (
    <div data-brand="flagship">
      <SiteNav locale={locale} locales={locales} />

      <main id="main-content">
        <section className="fs-sec cs-unavailable" data-surface="midnight">
          <div className="fs-blueprint" aria-hidden="true" />
          <div className="fs-wrap cs-unavailable-inner">
            <p className="fs-eyebrow">
              {reason === "service" ? "Description unavailable" : "Not published yet"}
            </p>
            <h1 className="fs-d2">
              {reason === "service"
                ? "This page's description cannot be shown right now."
                : "This page's description has not been published yet."}
            </h1>
            <p className="fs-lead">
              {reason === "service"
                ? "The service that holds this page's copy did not answer. This is a temporary service condition, not a statement that the service does not exist — please try again shortly."
                : "The description of the custom formulation service is being prepared and has not been published."}{" "}
              The request form below is unaffected, and a request sent through it reaches us as
              normal.
            </p>
            <p className="cs-unavailable-actions">
              <a className="fs-btn fs-btn--glass" href={`/${locale}${ROUTES.products}`}>
                See the standard range
              </a>
            </p>
          </div>
        </section>

        {/*
         * The same component the published page renders, taking no props and no CMS input. It is
         * here because it still works — see the note above.
         */}
        <CustomRequestForm />
      </main>

      <SiteFooter locale={locale} />
    </div>
  );
}
