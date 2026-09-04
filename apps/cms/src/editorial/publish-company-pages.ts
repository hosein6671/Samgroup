import config from "@payload-config";
import { getPayload } from "payload";
import { readFileSync } from "node:fs";

function apiServiceKey(): string | undefined {
  const env = readFileSync(new URL("../../../api/.env", import.meta.url), "utf8");
  const line = env.split(/\r?\n/u).find((entry) => entry.startsWith("PAYLOAD_API_KEY="));
  const value = line
    ?.slice("PAYLOAD_API_KEY=".length)
    .trim()
    .replace(/^["']|["']$/g, "");
  return value === "" ? undefined : value;
}

const paragraphs = (...texts: string[]): Record<string, unknown> => ({
  root: {
    type: "root",
    format: "",
    indent: 0,
    version: 1,
    direction: "ltr",
    children: texts.map((text) => ({
      type: "paragraph",
      format: "",
      indent: 0,
      version: 1,
      direction: "ltr",
      textFormat: 0,
      textStyle: "",
      children: [
        { type: "text", detail: 0, format: 0, mode: "normal", style: "", text, version: 1 },
      ],
    })),
  },
});

if (process.env.SAM_ALLOW_COMPANY_CONTENT_PUBLISH !== "true") {
  throw new Error("Set SAM_ALLOW_COMPANY_CONTENT_PUBLISH=true for this approved editorial run.");
}

const payload = await getPayload({ config });
const serviceApiKey = process.env.PAYLOAD_API_KEY ?? apiServiceKey();

const serviceUsers = await payload.find({
  collection: "users",
  overrideAccess: true,
  where: { roles: { contains: "service" } },
  limit: 2,
});

if (serviceUsers.totalDocs !== 1 || serviceUsers.docs[0] === undefined) {
  throw new Error(
    `Expected exactly one Payload service identity; found ${serviceUsers.totalDocs}.`,
  );
}

if (serviceApiKey) {
  await payload.update({
    collection: "users",
    id: serviceUsers.docs[0].id,
    overrideAccess: true,
    data: { enableAPIKey: true, apiKey: serviceApiKey },
  });
} else {
  console.warn(
    "PAYLOAD_API_KEY is empty; company content will publish without rotating the existing service key.",
  );
}

const teamImageFilename = "sam-group-team-collaboration.webp";
const existingTeamImage = await payload.find({
  collection: "media",
  overrideAccess: true,
  where: { filename: { equals: teamImageFilename } },
  limit: 1,
});
const teamImage =
  existingTeamImage.docs[0] ??
  (await payload.create({
    collection: "media",
    locale: "en",
    overrideAccess: true,
    data: {
      alt: "A cross-functional team reviewing petroleum product specifications and supply documents.",
    },
    file: {
      data: readFileSync(
        new URL("../../../web/public/images/about-team-collaboration.webp", import.meta.url),
      ),
      mimetype: "image/webp",
      name: teamImageFilename,
      size: readFileSync(
        new URL("../../../web/public/images/about-team-collaboration.webp", import.meta.url),
      ).length,
    },
  }));

const solutionImageFilename = "sam-group-customized-solutions-requirement-review.webp";
const existingSolutionImage = await payload.find({
  collection: "media",
  overrideAccess: true,
  where: { filename: { equals: solutionImageFilename } },
  limit: 1,
});
const solutionImagePath = new URL(
  "../../../web/public/images/customized-solutions-requirement-review.webp",
  import.meta.url,
);
const solutionImageData = readFileSync(solutionImagePath);
const solutionImage =
  existingSolutionImage.docs[0] ??
  (await payload.create({
    collection: "media",
    locale: "en",
    overrideAccess: true,
    data: {
      alt: "A technical and commercial team reviewing a lubricant requirement and product sample.",
    },
    file: {
      data: solutionImageData,
      mimetype: "image/webp",
      name: solutionImageFilename,
      size: solutionImageData.length,
    },
  }));

const whoWeAreImageFilename = "sam-group-products-portfolio-review.webp";
const existingWhoWeAreImage = await payload.find({
  collection: "media",
  overrideAccess: true,
  where: { filename: { equals: whoWeAreImageFilename } },
  limit: 1,
});
const whoWeAreImagePath = new URL(
  "../../../web/public/images/products-portfolio-review.webp",
  import.meta.url,
);
const whoWeAreImageData = readFileSync(whoWeAreImagePath);
const whoWeAreImage =
  existingWhoWeAreImage.docs[0] ??
  (await payload.create({
    collection: "media",
    locale: "en",
    overrideAccess: true,
    data: {
      // Reused verbatim from `features/products/sections/hero.tsx`, the image's existing usage —
      // one description for one photograph, not a second answer to what it shows.
      alt: "Industrial lubricant containers and oil samples arranged for product review.",
    },
    file: {
      data: whoWeAreImageData,
      mimetype: "image/webp",
      name: whoWeAreImageFilename,
      size: whoWeAreImageData.length,
    },
  }));

await payload.updateGlobal({
  slug: "about-us",
  locale: "en",
  overrideAccess: true,
  data: {
    _status: "published",
    /*
     * Sourced from `Sam Group Website Structure_v2.xlsx`'s `About Us` sheet, segment "Hero
     * Section". The sheet's own button label, "Explore Our Products", is used as given. Its title
     * and supporting text named "Global Industries" and customers "worldwide" — a geographic reach
     * this repository cannot verify (the Notes sheet supports Türkiye, Africa and the countries
     * around India, not "global" or "worldwide"). Reworded to what the company does rather than
     * where it reaches, the same treatment `home/home-data.ts`'s hero applies to the identical
     * question.
     */
    hero: {
      eyebrow: "About SAM Group",
      title: "Petroleum products and lubricant solutions, from the producer.",
      supportingText:
        "SAM Group produces and supplies base oils, engine oils, lubricant additives and coolants, developing products to the specification and supply terms each customer needs.",
      primaryCta: { label: "Explore Our Products", route: "products" },
      secondaryCta: { label: "Talk to our team", route: "contact-us" },
    },
    /*
     * Segment "Who We Are". The sheet asks for 2–3 paragraphs covering six things: what SAM Group
     * does, where it operates, its core product categories, who its customers are, its role as a
     * direct producer, and its focus on long-term B2B partnerships. All six are here — the first
     * paragraph covers what/categories/producer role, the second covers where it operates and who
     * it supplies, the third covers the direct-producer point again from the buyer's side and
     * long-term partnerships.
     *
     * "Where it operates" is two owner-confirmed facts (About Us editorial review, 2026-09-04), not
     * the sheet's own "global markets": manufacturing and blending are based in Iran, and the
     * confirmed export markets remain the Notes sheet's Türkiye, Africa and the countries around
     * India — the same correction the hero makes to the sheet's "worldwide" phrasing. Both are
     * owner-confirmed business statements, stated once each, without a capacity, certification or
     * customer-count claim riding along with them.
     */
    whoWeAre: {
      heading: "Who We Are",
      body: paragraphs(
        "SAM Group is a petroleum products manufacturer and supplier, producing base oils, engine oils, lubricant additives and coolants for businesses that buy on specification.",
        "SAM Group's manufacturing and blending operations are based in Iran, and the company supplies engine oil, industrial and marine lubricant manufacturers, blenders and industrial buyers, with an export operation currently serving Türkiye, Africa and the countries around India.",
        "Dealing directly with the producer means the formulation, the packaging and the supply terms are agreed in the same conversation — the basis for the long-term B2B relationships SAM Group works to build with its customers.",
      ),
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
      image: whoWeAreImage.id,
      imageCaption: "SAM Group products, prepared for portfolio review.",
    },
    /*
     * Segment "Our Expertise". The sheet gives four named areas and a one-sentence description
     * for each; both the names and the descriptions are used close to verbatim. One rename: the
     * sheet's fourth area, "Global Supply" / "Supporting international customers with reliable
     * sourcing and logistics", is renamed "Supply & Logistics" and reworded to the capability
     * itself — the same "global"/"international" correction the hero and Who We Are apply.
     *
     * A fifth item, Base Oil Processing, is an owner-approved addition (About Us editorial review,
     * 2026-09-04) — not from the sheet's own four, and not the sheet's separate, unconfirmed
     * "Quality Laboratory" or "Base Oil Processing" additions either (the sheet's own version of
     * the latter names no process). This one names a real, independently describable process —
     * thin-film vacuum distillation — and is bounded by explicit owner limits: it never says who
     * owns or operates the equipment (no "we operate", no "our plant", no named partner), and it
     * never claims the output is finished, Group II, or fully purified base oil, that every
     * contaminant is removed, or that this step alone replaces downstream finishing, treatment or
     * quality control. It is also never generalised to engine oils, additives, coolants or
     * lubricant formulation — those stay the other four items' territory.
     */
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
    /*
     * Sourced from `Sam Group Website Structure_v2.xlsx`'s `About Us` sheet, segment "Our
     * Competitive Advantages" — the sheet's own title and its six name/reason pairs, stated as the
     * sheet states them. One adjustment: the sheet's sixth pair, "Global Partnerships" / "Building
     * lasting relationships with customers and distributors worldwide", asserted a geographic reach
     * this repository cannot verify. Retitled and reworded to the relationship itself, dropping
     * "Global" and "worldwide" — the same correction `home-data.ts` ADVANTAGES[5] already applies
     * to the identical claim on the homepage ("Built for repeat supply with distributors, blenders
     * and industrial manufacturers.", not "worldwide").
     */
    competitiveAdvantages: {
      heading: "Why partner with SAM Group?",
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
          /* Company claim, from the sheet. `home-data.ts` ADVANTAGES[2] carries the identical claim
             marked unverified; this one is owner-confirmed (About Us editorial review, 2026-09-04)
             — "controlled production and testing" is approved as an owner-confirmed business
             statement, not merely stated as the workbook states it. */
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
      image: teamImage.id,
      imageCaption:
        "Product, commercial, and supply details are reviewed as parts of the same buyer requirement.",
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
    },
    /*
     * Segment "Final CTA". Heading, lead and button are the sheet's own wording. `routes` is not
     * part of the sheet — it is the page's existing secondary-navigation affordance, kept but
     * trimmed from three entries to two: "Talk to technical sales" pointed at the same
     * `contact-us` route the primary "Contact Us" button now does, which made two of the section's
     * three actions identical.
     */
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
      metaTitle: "About SAM Group | Petroleum Products & Lubricants",
      metaDescription:
        "Discover how SAM Group connects petroleum and lubricant product discovery, technical information, documentation, and supply requirements for B2B buyers.",
      socialImage: teamImage.id,
      twitterImage: teamImage.id,
    },
  } as never,
});

await payload.updateGlobal({
  slug: "customized-solutions",
  locale: "en",
  overrideAccess: true,
  data: {
    _status: "published",
    hero: {
      eyebrow: "Customized solutions",
      title: "Turn a specific requirement into a structured technical brief.",
      supportingText:
        "Tell us about the application, required specifications, quantity, packaging, and destination. We will have the context needed to assess the request and define the next step.",
      requestCta: { label: "Start a custom-product request" },
      routeCta: { label: "Browse standard products", route: "products" },
    },
    introduction: {
      heading: "Use this route when the catalogue is only part of the answer.",
      body: paragraphs(
        "A custom request may begin with a target specification, an operating problem, a reference product, or a packaging requirement. The form captures what is known without forcing assumptions about what is not.",
      ),
    },
    whatCanWeCustomize: [
      {
        title: "Specification and property targets",
        description:
          "State the grade, standard, reference values, or decision criteria that the review must address.",
      },
      {
        title: "Application-led product selection",
        description:
          "Describe the equipment, operating context, and problem the selected product needs to support.",
      },
      {
        title: "Component or additive requirement",
        description:
          "Identify a known component requirement or leave it open for technical clarification where the target is not yet defined.",
      },
      {
        title: "Packaging and presentation",
        description:
          "Record the required pack format, label context, and handling constraints without assuming availability.",
      },
      {
        title: "Destination and supply configuration",
        description:
          "Add quantity, destination, and trade context so technical review and supply planning use the same brief.",
      },
    ],
    process: {
      heading: "A requirement-led process.",
      lead: "Each stage reduces ambiguity before technical evaluation and commercial confirmation.",
      steps: [
        {
          name: "Define the brief",
          description:
            "Capture the application, specification, operating context, and constraints.",
        },
        {
          name: "Review the requirement",
          description:
            "Check whether the technical and commercial inputs are complete enough to assess.",
        },
        {
          name: "Clarify the target",
          description: "Resolve open questions and agree which criteria will guide the review.",
        },
        {
          name: "Evaluate the option",
          description: "Compare an available product or proposed route against the stated brief.",
        },
        {
          name: "Sample and validate",
          description: "Where applicable, use a sample to support evaluation before commitment.",
        },
        {
          name: "Confirm supply",
          description:
            "Document the agreed specification, quantity, packaging, destination, and terms.",
        },
      ],
    },
    seo: {
      metaTitle: "Customized Lubricant Solutions | SAM Group",
      metaDescription:
        "Submit a structured petroleum or lubricant requirement covering application, specification, quantity, packaging, destination, and trade context.",
      socialImage: solutionImage.id,
      twitterImage: solutionImage.id,
    },
  } as never,
});

await payload.updateGlobal({
  slug: "quality-certifications",
  locale: "en",
  overrideAccess: true,
  data: {
    _status: "published",
    hero: {
      eyebrow: "Quality and documentation",
      title: "Quality information should be specific, traceable, and reviewable.",
      supportingText:
        "This page explains how product information, review stages, samples, and supporting documents are presented. Certificates appear only after their scope and validity have been verified.",
      indexLabel: "Review path",
      primaryCta: { label: "Request documentation", route: "contact-us" },
      secondaryCta: { label: "Explore products", route: "products" },
    },
    approach: {
      eyebrow: "Quality approach",
      heading: "Review quality at the points that matter.",
      lead: "The published framework separates incoming review, in-process context, and finished-batch release information without inventing procedures that have not been documented.",
      stages: [
        { name: "Incoming review", when: "Before processing or blending" },
        { name: "In-process review", when: "During the production path" },
        { name: "Outgoing review", when: "Before batch release" },
      ],
      footnote:
        "Stage names describe the information path; they do not publish test methods, limits, accreditation, or operating procedures.",
    },
    laboratory: {
      eyebrow: "Technical review",
      heading: "Capability is published only with method and scope.",
      lead: "No laboratory test capability is claimed here until the responsible method, execution scope, and reporting basis have been verified.",
      registerLabel: "Publication requirements",
      orderNote: "Evidence required before publication",
      properties: [
        { name: "Property name" },
        { name: "Applicable method" },
        { name: "Execution scope" },
        { name: "Reporting basis" },
      ],
      unpublishedHeading: "Not implied by this page",
      unpublished: [
        {
          name: "In-house execution",
          why: "No in-house or external laboratory split is published until verified.",
        },
        {
          name: "Accreditation",
          why: "No accreditation is claimed without an approved certificate and scope.",
        },
        {
          name: "Equipment ownership",
          why: "A property name does not establish ownership of a particular instrument.",
        },
        {
          name: "Numeric capability",
          why: "No measurable range or result is published without its approved method and conditions.",
        },
      ],
    },
    certifications: {
      eyebrow: "Certifications",
      heading: "Verified certificates only.",
      status: "Records under verification",
      statement:
        "No certification is listed until its issuing body, certificate number, scope, issue date, expiry date, and public document have been checked.",
      note: "Product and shipment documentation can still be requested through the relevant product or enquiry route.",
    },
    documentation: {
      eyebrow: "Documentation",
      heading: "Documents for technical and commercial review.",
      lead: "Document availability depends on the selected product, batch, order, and shipment context.",
      registerLabel: "Document types",
      documents: [
        { name: "Technical Data Sheet", scope: "Product or grade" },
        { name: "Safety Data Sheet", scope: "Product or grade" },
        { name: "Certificate of Analysis", scope: "Applicable batch" },
        { name: "Certificate of Origin", scope: "Applicable shipment" },
        { name: "Commercial documents", scope: "Confirmed order" },
        { name: "Packing documents", scope: "Confirmed order" },
      ],
      note: "This register describes document types; it is not a download list. Request the current document for the specific product and context.",
    },
    sampling: {
      eyebrow: "Sampling",
      statement:
        "Evaluate selected base oils and lubricant components before commitment where sampling applies.",
      familiesLabel: "Confirmed scope",
      families: ["base-oils", "lubricant-additives"],
      limit:
        "Availability, quantity, dispatch conditions, and evaluation purpose are confirmed for each request; this statement does not extend to other product families.",
    },
    closing: {
      eyebrow: "Technical review",
      heading: "Need a document for product evaluation?",
      lead: "Name the product, grade, and document required so the request reaches the right context.",
      primaryCta: { label: "Request documentation", route: "contact-us" },
      routes: [
        { label: "Explore products", route: "products" },
        { label: "Request a sample", route: "contact-us" },
        { label: "Request a quote", route: "request-a-quote" },
      ],
    },
    seo: {
      metaTitle: "Quality & Product Documentation | SAM Group",
      metaDescription:
        "Review how SAM Group presents product information, verification stages, technical documents, sampling scope, and certification status.",
    },
  } as never,
});

for (const slug of ["about-us", "customized-solutions", "quality-certifications"] as const) {
  const published = await payload.findGlobal({ slug, locale: "en", overrideAccess: true });
  if (published._status !== "published") {
    throw new Error(`Editorial verification failed for ${slug}.`);
  }
}

console.log("Published and verified English content for all three company Globals.");
process.exit(0);
