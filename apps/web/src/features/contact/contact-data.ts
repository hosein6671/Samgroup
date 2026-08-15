/**
 * Contact Us page copy.
 *
 * ── What is deliberately absent, and why it is the whole story here ─────────
 *
 * SITE_STRUCTURE §10 specifies seven sections for this page. **Two are built: the hero and the
 * inquiry form.** The other five are Contact Options (4 cards), Contact Information, Direct Contact
 * CTA, Global Inquiries and a Contact FAQ — and every one of them is a list of contact details the
 * project does not have. §10 says so in its own table ("All contact details currently placeholders")
 * and the Outstanding Confirmations list names them as a launch blocker: head office and factory
 * addresses, three email addresses, a phone number, a WhatsApp Business number, working hours, a map.
 *
 * Publishing an invented address or a plausible-looking phone number is publishing a way to fail to
 * reach a real company. CLAUDE.md §4 forbids seeding a `[TO CONFIRM]` marker into a page, and this
 * is the page with the most of them. So the sections are absent rather than filled with placeholders
 * — the same position `solutions-data.ts` takes for its three unsourced sections, and the same one
 * the category contract takes for `industries`.
 *
 * The consequence is honest: the one route on this page that works is the one that actually
 * reaches someone, and it is the form.
 *
 * ── There is no Contact FAQ, and none is invented ───────────────────────────
 *
 * §10 specifies it as deflecting "the 4 most common first-email questions (MOQ, samples, markets,
 * response time)". Three of those four are on the Outstanding Confirmations list — MOQ, the final
 * market list, and response time are all unconfirmed — so an FAQ here would be four answers, three
 * of them made up, presented as company policy.
 */

/* ---------------------------------------------------------------- anchors */

export const ANCHORS = {
  form: "inquiry-form",
} as const;

/* ------------------------------------------------------------------- hero */

export type ContactIntro = {
  readonly eyebrow: string;
  readonly heading: string;
  readonly lead: string;
};

/**
 * Restrained by the same instruction as every other page's hero: no capacity, market, lead-time,
 * certification or response-time claim appears here, because none is approved. It states what the
 * page is for.
 */
export const INTRO: ContactIntro = {
  eyebrow: "Contact",
  heading: "Start the conversation.",
  lead: "Product questions, quotations, and sample requests all arrive through one form. The more of a requirement it carries, the fewer rounds it takes to answer.",
};

/**
 * The heading above the form, which changes with the flow that opened it.
 *
 * Three variants for three entry points — the general page, the Request a Quote route, and a
 * product CTA that preselects a sample request. They differ in the sentence, not in the form: the
 * submission is one `Inquiry` either way.
 */
export const FORM_HEADINGS = {
  general: {
    eyebrow: "Inquiry",
    heading: "Tell us what you need.",
    lead: "One form for every kind of inquiry. Choose the type that fits and give as much of the requirement as you have.",
  },
  quote: {
    eyebrow: "Request a quote",
    heading: "Ask for a price.",
    lead: "A quotation needs a grade, a quantity and a destination. Anything you can add beyond that shortens the exchange.",
  },
  sample: {
    eyebrow: "Request a sample",
    heading: "Ask for a sample.",
    lead: "A sample is issued before commitment, so your own testing decides. Tell us where it should go.",
  },
} as const;

export type FormHeading = (typeof FORM_HEADINGS)[keyof typeof FORM_HEADINGS];
