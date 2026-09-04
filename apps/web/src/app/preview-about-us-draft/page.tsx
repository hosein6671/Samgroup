/**
 * PERSISTENT DEV-ONLY VISUAL-VERIFICATION HARNESS FOR THE PROPOSED ABOUT US REFINEMENT.
 *
 * ── What this is, and is not ─────────────────────────────────────────────────
 *
 * This route renders `AboutExperience` — the real About Us component tree, unmodified — with the
 * copy proposed in `apps/cms/src/editorial/publish-company-pages.ts`, so the redesigned page can be
 * reviewed in a real browser without writing anything to local `sam_cms`. It calls no API, no
 * Payload client, nothing outside this file and `AboutExperience` itself. The fixture below is a
 * transcription of that script's `about-us` `updateGlobal` payload — nothing here is invented, and
 * nothing here is the source of truth: if the two ever disagree, the editorial script is right and
 * this file is stale.
 *
 * ── Why it 404s outside development ──────────────────────────────────────────
 *
 * Proposed, unapproved company copy must never be reachable on a deployed build. `NODE_ENV` is
 * `"production"` for both `next build`/`next start` and any hosting platform's production run;
 * it is `"development"` only under `next dev`. The gate below is the whole of that contract — no
 * flag to forget, no route to unlink, because the route answers `notFound()` the moment this stops
 * being a local dev server.
 *
 * ── Why it is not linked from anywhere ───────────────────────────────────────
 *
 * Not in `site-routes.ts`, not in any `<nav>`, not in `sitemap.ts` (`STRUCTURAL_ROUTES` there is a
 * hand-maintained list — a new route file does not appear in it by existing). Reached only by
 * typing the URL directly.
 *
 * ── Images ────────────────────────────────────────────────────────────────────
 *
 * Public asset paths (`/images/...`), not `/media/cms/...`: the proposed Who We Are photograph is
 * not uploaded to Payload, and uploading it to preview this page would be the CMS write this
 * harness exists to avoid. The real page always serves CMS-hosted images; this preview borrows the
 * same files from the public directory instead.
 *
 * ── Lifetime ──────────────────────────────────────────────────────────────────
 *
 * Persistent for this review, unlike the throwaway version used earlier in this session. Delete
 * this directory (`layout.tsx` and `page.tsx`) once the owner has finished reviewing and either
 * approves the copy for publishing or asks for changes.
 */
import { notFound } from "next/navigation";

import { AboutExperience } from "@/features/about/about-experience";

import type { AboutUsContent } from "@sam-group/types";
import type { ReactNode } from "react";

const LOCALES = [
  {
    code: "en",
    name: "English",
    nativeName: "English",
    direction: "ltr" as const,
    isDefault: true,
  },
  { code: "fa", name: "Persian", nativeName: "فارسی", direction: "rtl" as const, isDefault: false },
  {
    code: "ar",
    name: "Arabic",
    nativeName: "العربية",
    direction: "rtl" as const,
    isDefault: false,
  },
];

const PROPOSED_CONTENT: AboutUsContent = {
  hero: {
    eyebrow: "About SAM Group",
    title: "Petroleum products and lubricant solutions, from the producer.",
    supportingText:
      "SAM Group produces and supplies base oils, engine oils, lubricant additives and coolants, developing products to the specification and supply terms each customer needs.",
    primaryCta: { label: "Explore Our Products", route: "products" },
    secondaryCta: { label: "Talk to our team", route: "contact-us" },
    figure: null,
  },
  whoWeAre: {
    heading: "Who We Are",
    bodyHtml:
      "<p>SAM Group is a petroleum products manufacturer and supplier, producing base oils, engine oils, lubricant additives and coolants for businesses that buy on specification.</p>" +
      "<p>SAM Group's manufacturing and blending operations are based in Iran, and the company supplies engine oil, industrial and marine lubricant manufacturers, blenders and industrial buyers, with an export operation currently serving Türkiye, Africa and the countries around India.</p>" +
      "<p>Dealing directly with the producer means the formulation, the packaging and the supply terms are agreed in the same conversation — the basis for the long-term B2B relationships SAM Group works to build with its customers.</p>",
    positions: [
      {
        term: "Direct producer",
        note: "Formulation, packaging and supply terms are agreed directly with the company that makes the product.",
      },
      {
        term: "Product range",
        note: "Base oils, engine oils, industrial and marine lubricants, additives and coolants.",
      },
      {
        term: "Long-term partnerships",
        note: "Built for repeat supply with distributors, blenders and industrial manufacturers.",
      },
    ],
    figure: {
      image: {
        url: "/images/products-portfolio-review.webp",
        alt: "Industrial lubricant containers and oil samples arranged for product review.",
        width: 1800,
        height: 1200,
      },
      caption: "SAM Group products, prepared for portfolio review.",
    },
  },
  expertise: {
    heading: "Our Expertise",
    lead: "Five areas of technical and commercial capability sit behind every order SAM Group supplies.",
    items: [
      {
        name: "Petroleum Products",
        note: "Production and supply of petroleum-based products, including base oils and finished lubricants.",
        icon: "product",
      },
      {
        name: "Lubricant Solutions",
        note: "Automotive and industrial lubricant formulations, developed to the application's performance requirement.",
        icon: "application",
      },
      {
        name: "Custom Formulation",
        note: "Products developed against a customer's own technical and commercial requirement.",
        icon: "formulation",
      },
      {
        name: "Supply & Logistics",
        note: "Packaging, documentation and export planning for the destinations SAM Group currently serves.",
        icon: "supply",
      },
      {
        name: "Base Oil Processing",
        note: "Thin-film vacuum distillation separates recoverable base-oil fractions from used lubricating oil, water, lighter components and heavy residues while limiting thermal exposure.",
        icon: "processing",
      },
    ],
  },
  competitiveAdvantages: {
    heading: "Why partner with SAM Group?",
    lead: null,
    items: [
      {
        name: "Direct manufacturer",
        note: "Work directly with the producer for greater supply transparency.",
        icon: "manufacturer",
      },
      {
        name: "Product customization",
        note: "Solutions tailored to specific technical and commercial requirements.",
        icon: "customization",
      },
      {
        name: "Quality commitment",
        note: "Consistent quality through controlled production and testing.",
        icon: "quality",
      },
      {
        name: "Reliable supply",
        note: "Stable supply solutions designed for long-term business relationships.",
        icon: "supply",
      },
      {
        name: "Industry expertise",
        note: "Knowledge of petroleum products and their industrial applications.",
        icon: "expertise",
      },
      {
        name: "Long-term partnerships",
        note: "Building lasting relationships with customers and distributors.",
        icon: "partnership",
      },
    ],
  },
  team: {
    eyebrow: "A coordinated B2B response",
    heading: "One requirement, reviewed from four operational angles.",
    lead: "A useful answer depends on more than product availability. Technical fit, commercial scope, documentation, packaging, and destination need to be considered together.",
    functions: [
      {
        name: "Product & technical",
        note: "Clarifies the application, target grade, relevant specification, and technical information needed for evaluation.",
      },
      {
        name: "Commercial",
        note: "Builds the quotation scope around the selected product, required quantity, and confirmed commercial context.",
      },
      {
        name: "Supply & logistics",
        note: "Connects packaging, destination, shipment requirements, and Incoterm to the proposed supply route.",
      },
      {
        name: "Customer coordination",
        note: "Maintains one line of context across questions, documents, decisions, and agreed next actions.",
      },
    ],
    figure: {
      image: {
        url: "/images/about-team-collaboration.webp",
        alt: "A cross-functional team reviewing petroleum product specifications and supply documents.",
        width: 1672,
        height: 941,
      },
      caption:
        "Product, commercial, and supply details are reviewed as parts of the same buyer requirement.",
    },
  },
  qualityStandards: {
    heading: "Clear information before commercial commitment.",
    lead: "We separate product descriptions from technical values, state where confirmation is required, and keep document context visible throughout the enquiry.",
    items: [
      {
        name: "Product-specific detail",
        note: "Descriptions, applications, specifications, and document references are kept distinct and readable.",
      },
      {
        name: "Traceable context",
        note: "Technical and batch information is tied to the relevant product, grade, or order context.",
      },
      {
        name: "Clear qualification",
        note: "Typical values and pending confirmations are identified instead of being presented as contractual guarantees.",
      },
    ],
    footnote:
      "See how verification status, technical documents, sampling, and certification records are handled.",
    footnoteCta: { label: "View quality and documentation", route: "quality-certifications" },
    figure: null,
  },
  closing: {
    eyebrow: "Let's talk",
    heading: "Let's build a long-term partnership.",
    lead: "Whether you need a reliable petroleum products supplier, a customized formulation, or a long-term manufacturing partner, SAM Group is ready to work with you.",
    primaryCta: { label: "Contact Us", route: "contact-us" },
    routes: [
      { label: "Browse the product range", route: "products" },
      { label: "Define a customized requirement", route: "customized-solutions" },
    ],
  },
  seo: {
    locale: "en",
    metaTitle: null,
    metaDescription: null,
    canonicalUrl: null,
    ogTitle: null,
    ogDescription: null,
    socialImage: null,
    twitterCardType: "summary_large_image",
    twitterTitle: null,
    twitterDescription: null,
    twitterImage: null,
    robotsIndex: false,
    robotsFollow: false,
    keywords: [],
    structuredDataOverride: null,
    alternates: [],
  },
};

export default function PreviewAboutUsDraftPage(): ReactNode {
  if (process.env.NODE_ENV !== "development") {
    notFound();
  }

  return <AboutExperience content={PROPOSED_CONTENT} locale="en" locales={LOCALES} />;
}
