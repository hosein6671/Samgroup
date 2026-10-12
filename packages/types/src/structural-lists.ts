/* ── Editorial links ──────────────────────────────────────────────────────────────────────────
 * Kept in this module rather than its own file: the API loads these sources directly through
 * Node's TypeScript support, where a relative import between two files would need a file
 * extension that the other consumers' compilers reject. One module, no relative imports. */

/**
 * The one rule for an address an editor types into /admin — a card link today, a link inside text
 * once the editor supports it. Shared by the CMS (which refuses to save anything else), the API
 * projection (which refuses to serve it) and `web` (which decides how each kind opens).
 *
 * Allowed, and nothing else:
 * - a path on this site: `/en/products/engine-oils`, optionally with `?query` and `#hash`. Used
 *   exactly as typed; the editor includes the language segment, because the field is per locale.
 * - an anchor on the same page: `#contact`
 * - a page elsewhere over HTTPS: `https://example.com/…`
 * - `mailto:name@example.com` and `tel:+98…`
 *
 * Refused: `javascript:`, `data:`, plain `http://`, protocol-relative `//host`, backslashes, spaces
 * and control characters, and anything over 2000 characters.
 */

export type EditorialHrefKind = "internal" | "anchor" | "external" | "mailto" | "tel";

const MAX_LENGTH = 2000;

export function editorialHrefKind(value: string): EditorialHrefKind | null {
  if (typeof value !== "string" || value.length === 0 || value.length > MAX_LENGTH) return null;

  if (/[\s\\\u0000-\u001f\u007f]/.test(value)) return null;

  if (value.startsWith("/")) return value.startsWith("//") ? null : "internal";
  if (value.startsWith("#")) return /^#[A-Za-z0-9_-]+$/.test(value) ? "anchor" : null;
  if (/^mailto:[^@]+@[^@]+\.[^@]+$/i.test(value)) return "mailto";
  if (/^tel:\+?[0-9()-]{3,32}$/i.test(value)) return "tel";
  // Parsed by pattern rather than `new URL`: this package is compiled with no DOM or Node types,
  // so the global is not available to it. The authority must be a dotted hostname (letters,
  // digits, hyphens), optionally with a port, and carry no `user:password@` part.
  const https = /^https:\/\/([^/?#]+)(?:[/?#]|$)/i.exec(value);
  if (https) {
    const authority = https[1] ?? "";
    return /^(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z][a-z0-9-]*[a-z0-9](?::\d{1,5})?$/i.test(
      authority,
    )
      ? "external"
      : null;
  }
  return null;
}

/** True for an address the rule above accepts. */
export function validEditorialHref(value: string): boolean {
  return editorialHrefKind(value) !== null;
}

/** What /admin shows beside a link field, and in the error when an address is refused. */
export const EDITORIAL_HREF_HINT =
  "A page on this site (/en/products/engine-oils), an https:// address, mailto: or tel:. Leave empty for no link.";

/* ── Inline formatting in editorial text ──────────────────────────────────────────────────────
 * The /admin editor saves a page's text as a small, fixed subset of Markdown — the same strings
 * as before, so nothing stored changes shape — and only this subset is ever given meaning:
 *   **bold**   *italic* (or _italic_)   ***both***   [label](address)
 * plus `\` to keep one of `\ * _ [ ] ( )` literal. Anything else is text, shown as typed; there is
 * no HTML at any point. A link's address must pass `validEditorialHref`, or the label is kept and
 * the link is dropped. `web` renders the tree below; `inlinePlainText` is the same text with the
 * markup removed, for places that cannot hold formatting (meta tags, alt text, buttons). */

export type InlineNode =
  | { readonly type: "text"; readonly text: string }
  | { readonly type: "strong" | "em"; readonly children: readonly InlineNode[] }
  | { readonly type: "link"; readonly href: string; readonly children: readonly InlineNode[] };

const ESCAPABLE = new Set(["\\", "*", "_", "[", "]", "(", ")"]);

/** Parse editorial text into the inline tree. Never throws; unmatched markers stay text. */
export function parseInline(source: string): InlineNode[] {
  return parseRange(typeof source === "string" ? source : "", 0);
}

function parseRange(text: string, depth: number): InlineNode[] {
  const out: InlineNode[] = [];
  let buffer = "";
  const flush = (): void => {
    if (buffer) out.push({ type: "text", text: buffer });
    buffer = "";
  };
  let i = 0;
  while (i < text.length) {
    const ch = text[i]!;
    if (ch === "\\" && i + 1 < text.length && ESCAPABLE.has(text[i + 1]!)) {
      buffer += text[i + 1];
      i += 2;
      continue;
    }
    if (depth < 4 && ch === "[") {
      const link = matchLink(text, i);
      if (link) {
        flush();
        const children = parseRange(link.label, depth + 1);
        if (validEditorialHref(link.href)) out.push({ type: "link", href: link.href, children });
        else out.push(...children);
        i = link.end;
        continue;
      }
    }
    if (depth < 4 && (ch === "*" || ch === "_")) {
      const span = matchEmphasis(text, i);
      if (span) {
        flush();
        const inner = parseRange(span.inner, depth + 1);
        if (span.strength === 3)
          out.push({ type: "strong", children: [{ type: "em", children: inner }] });
        else out.push({ type: span.strength === 2 ? "strong" : "em", children: inner });
        i = span.end;
        continue;
      }
    }
    buffer += ch;
    i += 1;
  }
  flush();
  return out;
}

/** `[label](href)` starting at `start`; the label may not span a nested `[`, the href no spaces. */
function matchLink(
  text: string,
  start: number,
): { label: string; href: string; end: number } | null {
  let i = start + 1;
  let label = "";
  while (i < text.length && text[i] !== "]") {
    if (text[i] === "[") return null;
    if (text[i] === "\\" && i + 1 < text.length) {
      label += text[i]! + text[i + 1]!;
      i += 2;
      continue;
    }
    label += text[i];
    i += 1;
  }
  if (text[i] !== "]" || text[i + 1] !== "(" || !label) return null;
  const close = text.indexOf(")", i + 2);
  if (close < 0) return null;
  const href = text.slice(i + 2, close);
  if (!href || /\s/.test(href)) return null;
  return { label, href, end: close + 1 };
}

/**
 * `*x*`, `**x**`, `***x***` (or with `_`) starting at `start`. The run must open before a
 * non-space and close after one, and an `_` run must sit at word edges, so `snake_case_words`
 * and `2 * 3 * 4` stay text.
 */
function matchEmphasis(
  text: string,
  start: number,
): { strength: 1 | 2 | 3; inner: string; end: number } | null {
  const marker = text[start]!;
  let strength = 0;
  while (strength < 3 && text[start + strength] === marker) strength += 1;
  const open = start + strength;
  if (open >= text.length || /\s/.test(text[open]!)) return null;
  if (marker === "_" && start > 0 && /[\p{L}\p{N}]/u.test(text[start - 1]!)) return null;
  const closer = marker.repeat(strength);
  let j = open;
  while (j < text.length) {
    if (text[j] === "\\") {
      j += 2;
      continue;
    }
    if (text.startsWith(closer, j) && !/\s/.test(text[j - 1]!) && text[j + strength] !== marker) {
      const after = text[j + strength];
      if (marker === "_" && after !== undefined && /[\p{L}\p{N}]/u.test(after)) {
        j += 1;
        continue;
      }
      return { strength: strength as 1 | 2 | 3, inner: text.slice(open, j), end: j + strength };
    }
    j += 1;
  }
  return null;
}

/** The text of an inline tree, without any markup. */
export function inlineNodesText(nodes: readonly InlineNode[]): string {
  return nodes
    .map((node) => (node.type === "text" ? node.text : inlineNodesText(node.children)))
    .join("");
}

/** Editorial text with its formatting removed — for meta tags, alt text, labels and buttons. */
export function inlinePlainText(source: string): string {
  return inlineNodesText(parseInline(source));
}

/**
 * Every `[label](address)` in the text has an address `validEditorialHref` accepts. The CMS refuses
 * to save text that fails this, so a refused link is reported to the editor instead of quietly
 * becoming plain text on the page.
 */
export function inlineLinksValid(source: string): boolean {
  if (typeof source !== "string") return false;
  for (let i = source.indexOf("["); i >= 0; i = source.indexOf("[", i + 1)) {
    if (i > 0 && source[i - 1] === "\\") continue;
    const link = matchLink(source, i);
    if (link && !validEditorialHref(link.href)) return false;
  }
  return true;
}

/**
 * The body-copy fields that take inline formatting — the ones /admin edits with the formatting
 * toolbar and the site renders with `RichText`. Everything else (eyebrows, headings, labels,
 * buttons, alt text, captions, sentence fragments) stays plain text, and any markup in it is
 * removed on the page. `rich-text-coverage.spec.ts` holds the site to this list.
 */
export const STRUCTURAL_RICH_TEXT: Record<
  string,
  { readonly slots: readonly string[]; readonly lists: Record<string, readonly string[]> }
> = {
  home: {
    slots: [
      "hero.sam_group_produces_and_supplies",
      "who_we_are.sam_group_produces_base_oils",
      "trust.four_things_that_follow_from",
      "ecosystem.a_range_built_for_lubricant",
      "advantages.the_practical_differences_between_buying",
      "industries.the_same_catalogue_reaches_five",
      "custom_formulation.where_a_standard_product_does",
      "network.bring_the_grade_required_quantity",
      "insights.read_clear_guidance_on_product",
    ],
    lists: {
      who_we_are: ["detail"],
      trust_indicators: ["body"],
      advantages: ["body"],
      industries: ["body"],
      custom_steps: ["body"],
      families: ["body"],
    },
  },
  "products-landing": {
    slots: [
      "hero.browse_base_oils_additives_automotive",
      "register.each_family_brings_its_published",
      "closing_cta.the_range_above_is_what",
    ],
    lists: { document_tiers: ["note"] },
  },
  "export-logistics": {
    slots: [
      "page.a_useful_export_enquiry_combines",
      "page.share_what_is_already_known",
      "page.the_sequence_keeps_technical_commercial",
      "page.available_formats_depend_on_the",
      "page.indicate_exw_fob_cfr_cif",
    ],
    lists: {
      delivery_steps: ["description"],
      packaging: ["description"],
      incoterms: ["description"],
    },
  },
  footer: { slots: ["brand.description"], lists: {} },
};

/** Whether the text slot `section.key` of `scope` takes inline formatting. */
export function structuralSlotIsRich(scope: string, section: string, key: string): boolean {
  return STRUCTURAL_RICH_TEXT[scope]?.slots.includes(`${section}.${key}`) ?? false;
}

/** Whether `field` on the rows of list `list` in `scope` takes inline formatting. */
export function structuralListFieldIsRich(scope: string, list: string, field: string): boolean {
  return STRUCTURAL_RICH_TEXT[scope]?.lists[list]?.includes(field) ?? false;
}

/** Editorial rows retain code-owned illustration and route identities. */
export const STRUCTURAL_LISTS = {
  header: {
    navigation: [
      {
        source: "0",
        label: "Home Page",
      },
      {
        source: "1",
        label: "About Us",
      },
      {
        source: "2",
        label: "Products",
      },
      {
        source: "3",
        label: "Customized Solutions",
      },
      {
        source: "4",
        label: "Export & Logistics",
      },
      {
        source: "5",
        label: "Contact Us",
      },
    ],
  },
  footer: {
    columns: [
      {
        source: "0",
        heading: "Products",
      },
      {
        source: "1",
        heading: "Company",
      },
    ],
    company_links: [
      {
        source: "0",
        label: "About Us",
      },
      {
        source: "1",
        label: "Quality & Certifications",
      },
      {
        source: "2",
        label: "Insights",
      },
      {
        source: "3",
        label: "FAQ",
      },
    ],
  },
  home: {
    who_we_are: [
      {
        source: "0",
        term: "We produce",
        detail:
          "Base oils, engine oils, lubricants and additives — made, not bought in and resold.",
      },
      {
        source: "1",
        term: "We formulate",
        detail: "Products developed against a stated technical and commercial requirement.",
      },
      {
        source: "2",
        term: "We supply",
        detail: "Packaging and volumes arranged around the product and the route it travels.",
      },
    ],
    trust_indicators: [
      {
        source: "0",
        title: "Direct manufacturer",
        body: "Your specification reaches the people who produce the product, without an intermediary in between.",
      },
      {
        source: "1",
        title: "Sample before commitment",
        body: "Engine oil and base oil enquiries begin with a sample, so the product is evaluated before anything is agreed.",
      },
      {
        source: "2",
        title: "Formulation to requirement",
        body: "Where the catalogue does not answer the need, the product is developed against the requirement instead.",
      },
      {
        source: "3",
        title: "Supply built around the order",
        body: "Bulk, flexitank, IBC and drum, selected for the volume and the route rather than offered as a fixed list.",
      },
    ],
    advantages: [
      {
        source: "0",
        title: "Direct manufacturer",
        body: "Buying from the producer keeps pricing, supply and quality in one accountable place.",
      },
      {
        source: "1",
        title: "Customized solutions",
        body: "Technical capability to develop a product against a customer's own requirement.",
      },
      {
        source: "2",
        title: "Quality control",
        body: "Products are tested and evaluated for performance before they are released.",
      },
      {
        source: "3",
        title: "Flexible supply",
        body: "Order volumes, packaging formats and delivery arrangements handled case by case.",
      },
      {
        source: "4",
        title: "Technical expertise",
        body: "Support with product selection and formulation development, not just order taking.",
      },
      {
        source: "5",
        title: "Long-term partnership",
        body: "Built for repeat supply with distributors, blenders and industrial manufacturers.",
      },
    ],
    industries: [
      {
        source: "0",
        name: "Automotive & Transportation",
        body: "Engine, transmission and driveline lubricants for vehicle fleets and workshops.",
      },
      {
        source: "1",
        name: "Industrial Manufacturing",
        body: "Hydraulic, gear and process fluids specified against plant duty cycles.",
      },
      {
        source: "2",
        name: "Lubricant Manufacturers",
        body: "Base oils and additive components supplied as blending inputs.",
      },
      {
        source: "3",
        name: "Petrochemical Industry",
        body: "Petroleum-based products supplied into downstream processing and formulation.",
      },
      {
        source: "4",
        name: "Packaging & Specialty Industries",
        body: "Specialty grades and packaging formats for lower-volume, specific applications.",
      },
    ],
    custom_steps: [
      {
        source: "0",
        n: "01",
        title: "Understand",
        body: "We start from the technical, commercial and application requirements behind the request — what the product has to do, where it has to do it, and on what terms.",
        input: "Application and duty",
        output: "Stated requirement",
      },
      {
        source: "1",
        n: "02",
        title: "Develop",
        body: "The technical team evaluates the requirement and either adapts an existing formulation or develops a new one to meet it.",
        input: "Stated requirement",
        output: "Candidate formulation",
      },
      {
        source: "2",
        n: "03",
        title: "Test",
        body: "The candidate product is tested and evaluated against the specification and performance criteria the requirement set out.",
        input: "Candidate formulation",
        output: "Measured result",
      },
      {
        source: "3",
        n: "04",
        title: "Approve",
        body: "Samples are reviewed and approved against the customer's own requirements before anything moves into production.",
        input: "Sample and result",
        output: "Customer approval",
      },
      {
        source: "4",
        n: "05",
        title: "Produce",
        body: "The approved product moves into controlled production, made to the formulation that was signed off rather than to a near equivalent.",
        input: "Approved formulation",
        output: "Produced batch",
      },
      {
        source: "5",
        n: "06",
        title: "Deliver",
        body: "The finished product is packaged and delivered on the supply and logistics terms agreed with the requirement.",
        input: "Produced batch",
        output: "Delivered order",
      },
    ],
    hero_shots: [
      { source: "0", name: "Base Oils" },
      { source: "1", name: "Engine Oils" },
      { source: "2", name: "Industrial" },
      { source: "3", name: "Marine" },
    ],
    hero_facts: [
      {
        source: "0",
        label: "Product families",
        value: "6",
      },
      {
        source: "1",
        label: "Customization steps",
        value: "6",
      },
      {
        source: "2",
        label: "Structured enquiry route",
        value: "1",
      },
    ],
    families: [
      {
        source: "0",
        name: "Base Oils",
        short: "Base Oils",
        sub: "Blending base stock",
        body: "Refined base fractions supplied to lubricant manufacturers and blenders, and used as the starting point for the formulations below.",
        supplied: "Bulk and flexitank",
        enquiry: "Grade, volume, destination",
      },
      {
        source: "1",
        name: "Lubricant Additives & Components",
        short: "Additives",
        sub: "Performance components",
        body: "Additive components and packages for blenders formulating their own products, selected against the performance the finished lubricant has to reach.",
        supplied: "Drum and IBC",
        enquiry: "Application and target property",
      },
      {
        source: "2",
        name: "Engine Oils & Automotive Lubricants",
        short: "Engine Oils",
        sub: "Engine, transmission and driveline",
        body: "Finished lubricants for road transport and vehicle fleets, covering engine, transmission and driveline applications across viscosity grades.",
        supplied: "1 L to 208 L, and bulk",
        enquiry: "Equipment and operating conditions",
      },
      {
        source: "3",
        name: "Industrial Oils & Lubricants",
        short: "Industrial",
        sub: "Plant, hydraulics and gearing",
        body: "Hydraulic, gear, compressor and process fluids for manufacturing plant, chosen against the duty the equipment runs at rather than by name alone.",
        supplied: "Drum, IBC and bulk",
        enquiry: "Equipment, duty and volume",
      },
      {
        source: "4",
        name: "Marine Oils & Lubricants",
        short: "Marine",
        sub: "Vessel engines and systems",
        body: "Lubricants for marine engines and onboard systems, supplied against the vessel's requirement and the port the delivery has to reach.",
        supplied: "Drum and bulk",
        enquiry: "Vessel, system and port",
      },
      {
        source: "5",
        name: "Antifreeze & Coolants",
        short: "Coolants",
        sub: "Thermal management",
        body: "Antifreeze and coolant products for automotive and industrial cooling systems, supplied as concentrate or ready-to-use according to the requirement.",
        supplied: "Concentrate or ready-to-use",
        enquiry: "System, climate and volume",
      },
    ],
    network_hubs: [
      {
        source: "0",
        n: "Türkiye",
      },
      {
        source: "1",
        n: "Countries around India",
      },
      {
        source: "2",
        n: "North Africa",
      },
      {
        source: "3",
        n: "West Africa",
      },
      {
        source: "4",
        n: "East Africa",
      },
      {
        source: "5",
        n: "Southern Africa",
      },
    ],
    network_stats: [
      {
        source: "0",
        label: "Named Incoterms",
        value: "4",
      },
      {
        source: "1",
        label: "Packaging formats",
        value: "6",
      },
      {
        source: "2",
        label: "Export enquiry path",
        value: "1",
      },
    ],
  },
  "products-landing": {
    finder_facets: [
      {
        source: "0",
        name: "Product family",
        sample: "Base Oils\nIndustrial\nMarine",
      },
      {
        source: "1",
        name: "Buyer segment",
        sample: "Passenger Cars\nIndustry\nMarine",
      },
    ],
    document_tiers: [
      {
        source: "0",
        heading: "Technical data lives on the product page",
        note: "Every approved property is reviewed and published as structured data directly on its grade's product page — the same six fields every time, no separate public PDF workflow.",
      },
      {
        source: "1",
        heading: "Catalogue",
        note: "The full catalogue is released against a short qualifying form.",
      },
    ],
    closing_routes: [
      {
        source: "0",
        label: "View Product Finder",
        qualifier: "Narrow the range by parameter, or search a grade by name.",
      },
      {
        source: "1",
        label: "Request a sample",
        qualifier: "Opens an enquiry — tell us the grade and the application.",
      },
      {
        source: "2",
        label: "Request a quote",
        qualifier: "Volumes, packaging and Incoterms against a specific grade.",
      },
    ],
  },
  "export-logistics": {
    brief_fields: [
      {
        source: "0",
        title: "Product",
        description: "Product family, grade, or application",
      },
      {
        source: "1",
        title: "Quantity",
        description: "Required volume or order estimate",
      },
      {
        source: "2",
        title: "Packaging",
        description: "Preferred format or handling constraint",
      },
      {
        source: "3",
        title: "Destination",
        description: "Country and named port or place",
      },
      {
        source: "4",
        title: "Trade term",
        description: "EXW, FOB, CFR, CIF, or not sure",
      },
    ],
    delivery_steps: [
      {
        source: "0",
        title: "Identify",
        description: "Confirm the product family, grade, and intended application.",
      },
      {
        source: "1",
        title: "Review",
        description: "Check the available technical information and required documents.",
      },
      {
        source: "2",
        title: "Define",
        description: "Record quantity, packaging, destination, and handling requirements.",
      },
      {
        source: "3",
        title: "Align",
        description: "State the preferred Incoterm and named place or port.",
      },
      {
        source: "4",
        title: "Confirm",
        description: "Document the commercial scope returned for review.",
      },
      {
        source: "5",
        title: "Prepare",
        description: "Coordinate order information and applicable shipment documents.",
      },
      {
        source: "6",
        title: "Dispatch",
        description: "Align loading and dispatch details against the confirmed brief.",
      },
      {
        source: "7",
        title: "Handover",
        description: "Provide the applicable shipment-document set.",
      },
    ],
    packaging: [
      {
        source: "0",
        title: "Bulk",
        description: "For requirements assessed around tank and route compatibility.",
      },
      {
        source: "1",
        title: "Flexitank",
        description: "A containerised bulk option, subject to product and route review.",
      },
      {
        source: "2",
        title: "Drums",
        description: "A defined industrial format for palletised or container loading.",
      },
      {
        source: "3",
        title: "IBC",
        description: "Intermediate bulk format where product and destination allow.",
      },
      {
        source: "4",
        title: "Pails",
        description: "Smaller industrial packs for selected product requirements.",
      },
      {
        source: "5",
        title: "Retail packs",
        description: "Pack configuration assessed against product and market brief.",
      },
    ],
    incoterms: [
      {
        source: "0",
        title: "EXW",
        description:
          "Buyer arranges collection from the named place after the goods are made available.",
      },
      {
        source: "1",
        title: "FOB",
        description: "Seller delivers the goods on board at the named port of shipment.",
      },
      {
        source: "2",
        title: "CFR",
        description:
          "Seller arranges cost and freight to the named destination port; risk transfers earlier.",
      },
      {
        source: "3",
        title: "CIF",
        description:
          "CFR scope with the contractually applicable cargo insurance arranged by the seller.",
      },
    ],
  },
} as const;
export type StructuralListBlueprint = Record<string, readonly Record<string, string>[]>;

/**
 * Lists whose rows may also carry an editor-supplied link (`href`). Optional on every row — an
 * empty link means the item is not a link — and checked by `validEditorialHref` (editorial-links.ts),
 * so a row can only ever point at this site, an https:// page, mailto: or tel:. Every other list
 * keeps the rule above: no route identities from the editor.
 */
export const STRUCTURAL_LIST_LINKS: Record<string, readonly string[]> = {
  home: ["industries"],
};

/** Whether `list` in `scope` takes the optional `href` field. */
export function structuralListTakesLink(scope: string, list: string): boolean {
  return STRUCTURAL_LIST_LINKS[scope]?.includes(list) ?? false;
}
export function structuralLists(scope: string): StructuralListBlueprint {
  return (STRUCTURAL_LISTS as Record<string, StructuralListBlueprint>)[scope] ?? {};
}
/**
 * Project only known editorial fields; never accept routes, icons or arbitrary attributes — except
 * the validated, optional `href` on the lists `STRUCTURAL_LIST_LINKS` names.
 */
export function projectStructuralLists(
  scope: string,
  value: unknown,
): Record<string, Record<string, string>[]> | null {
  const blueprint = structuralLists(scope);
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const data = value as Record<string, unknown>,
    result: Record<string, Record<string, string>[]> = {};
  if (Object.keys(data).some((key) => !(key in blueprint))) return null;
  for (const [key, defaults] of Object.entries(blueprint)) {
    const rows = data[key];
    if (!Array.isArray(rows) || rows.length > defaults.length) return null;
    const seen = new Set<string>();
    result[key] = [];
    for (const row of rows) {
      if (!row || typeof row !== "object" || Array.isArray(row)) return null;
      const source = row.source;
      const original = defaults.find((item) => item.source === source);
      if (!original || seen.has(source)) return null;
      seen.add(source);
      const linked = structuralListTakesLink(scope, key);
      if (
        Object.keys(row).some(
          (field) => field !== "id" && !(field in original) && !(linked && field === "href"),
        )
      )
        return null;
      const projected: Record<string, string> = {};
      if (linked && row.href !== undefined && row.href !== null) {
        if (typeof row.href !== "string") return null;
        const href = row.href.trim();
        if (href && !validEditorialHref(href)) return null;
        if (href) projected.href = href;
      }
      for (const field of Object.keys(original)) {
        if (
          typeof row[field] !== "string" ||
          !row[field].trim() ||
          row[field].length > 4000 ||
          !inlineLinksValid(row[field])
        )
          return null;
        projected[field] = row[field];
      }
      result[key].push(projected);
    }
  }
  return result;
}
