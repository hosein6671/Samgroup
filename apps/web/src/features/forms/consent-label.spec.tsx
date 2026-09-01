import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { accessibleName, findLinks, textOf } from "@test/element-tree";

import { CONSENT_LEAD } from "@/features/customized-solutions/solutions-form";

import { ConsentLabel, PRIVACY_POLICY_PHRASE } from "./consent-label";

/**
 * The consent sentence, in both of its states.
 *
 * The checkbox beside it is the lawful basis for holding everything else a visitor typed, so the
 * sentence has to name the policy in both states and may link it in only one — the canonical
 * Privacy Policy route answers 404 until an editor publishes one, and a link to a 404 beside a
 * consent checkbox is worse than plain text. ROADMAP.md's ratified ordering makes that a decision
 * rather than a preference; these assertions are that decision, mechanically.
 */

const INQUIRY_LEAD = "I agree to be contacted about this enquiry and accept the";

describe("the consent sentence with no published policy", () => {
  it("reads exactly as it did before the link existed", () => {
    const tree = ConsentLabel({ lead: INQUIRY_LEAD, privacyPolicyHref: null });

    expect(textOf(tree)).toBe(
      "I agree to be contacted about this enquiry and accept the privacy policy.",
    );
  });

  it("renders no link at all", () => {
    expect(findLinks(ConsentLabel({ lead: INQUIRY_LEAD, privacyPolicyHref: null }))).toHaveLength(
      0,
    );
  });

  it("carries the Customized Solutions wording just as faithfully", () => {
    const tree = ConsentLabel({ lead: CONSENT_LEAD, privacyPolicyHref: null });

    expect(textOf(tree)).toBe(
      "I agree to be contacted about this request and accept the privacy policy.",
    );
  });
});

describe("the consent sentence with a published policy", () => {
  const tree = ConsentLabel({ lead: INQUIRY_LEAD, privacyPolicyHref: "/fa/privacy-policy" });

  it("links the policy at the address it was given, and only that", () => {
    const links = findLinks(tree);

    expect(links).toHaveLength(1);
    expect(links.at(0)?.props.href).toBe("/fa/privacy-policy");
  });

  it("keeps the sentence intact around the link", () => {
    expect(textOf(tree)).toContain("I agree to be contacted about this enquiry and accept the");
    expect(textOf(tree)).toContain(PRIVACY_POLICY_PHRASE);
  });

  /**
   * Following the link mid-form would otherwise discard everything typed into it. The new tab is
   * announced rather than silent — WCAG 3.2.5 — which is what the visually hidden suffix is for.
   */
  it("opens in a new tab, safely, and says so in the accessible name", () => {
    const link = findLinks(tree).at(0);

    expect(link?.props.target).toBe("_blank");
    expect(link?.props.rel).toBe("noopener noreferrer");
    expect(link === undefined ? "" : accessibleName(link)).toContain("opens in a new tab");
  });
});

/**
 * Both forms must go through this component. A second copy of the sentence is a second place for
 * the link rule to be forgotten — the same reasoning `consent-target.spec.ts` applies to the
 * control's target size.
 */
describe("every consent label on the platform is this one", () => {
  const FORMS = [
    join(__dirname, "inquiry-form.tsx"),
    join(__dirname, "..", "customized-solutions", "sections", "custom-request-form.tsx"),
  ];

  it.each(FORMS)("%s renders ConsentLabel rather than its own sentence", (file) => {
    const source = readFileSync(file, "utf8");

    expect(source).toContain("<ConsentLabel");
    expect(source).toContain("privacyPolicyHref={privacyPolicyHref}");
    // The full sentence must not be re-hardcoded anywhere; the lead stops before the policy name.
    expect(source).not.toContain("accept the privacy policy.");
  });
});
