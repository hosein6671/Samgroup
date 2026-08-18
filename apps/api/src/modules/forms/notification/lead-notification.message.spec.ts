import { INQUIRY_TYPES } from "../dto/create-inquiry.dto";

import {
  LABELLED_INQUIRY_TYPES,
  buildCustomFormulationNotification,
  buildInquiryNotification,
  inquiryTypeLabel,
} from "./lead-notification.message";

import type {
  CustomFormulationNotificationInput,
  InquiryNotificationInput,
} from "./lead-notification.message";

const ID = "11111111-1111-4111-8111-111111111111";
const CREATED_AT = "2026-08-15T09:30:00.000Z";
const PRODUCT_ID = "22222222-2222-4222-8222-222222222222";

/** Exactly the fields a minimal General Inquiry persists. */
const MINIMAL_INQUIRY: InquiryNotificationInput = {
  id: ID,
  createdAt: CREATED_AT,
  privacyPolicyVersion: null,
  inquiryType: "general_inquiry",
  firstName: "Ada",
  lastName: "Lovelace",
  companyName: "Analytical Engines Ltd",
  country: "United Kingdom",
  email: "ada@example.com",
  industry: "Manufacturing",
};

const MINIMAL_FORMULATION: CustomFormulationNotificationInput = {
  id: ID,
  createdAt: CREATED_AT,
  privacyPolicyVersion: null,
  companyName: "Analytical Engines Ltd",
  country: "United Kingdom",
  industry: "Manufacturing",
  email: "ada@example.com",
  productOrApplication: "Hydraulic fluid for a high-pressure test rig",
  requiredSpecifications: "ISO VG 46, low pour point, zinc-free",
};

/** The label half of a rendered line, so a test can assert presence without matching a value. */
function labelsOf(text: string): string[] {
  return text
    .split("\n")
    .filter((line) => !line.startsWith("  "))
    .map((line) => line.slice(0, line.indexOf(":")));
}

describe("inquiry subject", () => {
  it("labels every wire value, so no subject can read as an enum label", () => {
    for (const value of LABELLED_INQUIRY_TYPES) {
      expect(inquiryTypeLabel(value)).not.toBe(value);
    }

    expect(LABELLED_INQUIRY_TYPES).toEqual([...INQUIRY_TYPES]);
  });

  it.each([
    ["general_inquiry", "New SAM Group inquiry — General inquiry"],
    ["request_a_quote", "New SAM Group inquiry — Request a quote"],
    ["sample_request", "New SAM Group inquiry — Sample request"],
  ])("names the flow factually for %s", (inquiryType, subject) => {
    const notification = buildInquiryNotification({
      ...MINIMAL_INQUIRY,
      inquiryType: inquiryType as InquiryNotificationInput["inquiryType"],
    });

    expect(notification.subject).toBe(subject);
  });

  /**
   * The subject is a header, and headers are the one place a submitted value could do structural
   * damage. It is built from a closed label map, so no submitted value can reach it — asserted
   * here against the fields most likely to carry hostile content.
   */
  it("carries no submitted content, however hostile", () => {
    const notification = buildInquiryNotification({
      ...MINIMAL_INQUIRY,
      companyName: "ACME\r\nBcc: attacker@example.invalid",
      message: "confidential pricing question",
    });

    expect(notification.subject).toBe("New SAM Group inquiry — General inquiry");
  });

  it("uses one fixed subject for a custom formulation request", () => {
    expect(buildCustomFormulationNotification(MINIMAL_FORMULATION).subject).toBe(
      "New SAM Group custom formulation request",
    );
  });
});

describe("inquiry body", () => {
  it("carries every approved field when the submission carries them all", () => {
    const notification = buildInquiryNotification({
      ...MINIMAL_INQUIRY,
      inquiryType: "request_a_quote",
      privacyPolicyVersion: "v1.0",
      phone: "+44 20 7946 0000",
      relatedProductId: PRODUCT_ID,
      productsOfInterest: ["Base oils", "Greases"],
      requiredQuantity: "20 MT",
      destinationCountryPort: "Jebel Ali",
      preferredIncoterm: "FOB",
      message: "Please quote for quarterly shipments.",
    });

    expect(notification.text).toBe(
      [
        `Submission ID: ${ID}`,
        `Received: ${CREATED_AT}`,
        "Inquiry type: Request a quote",
        "First name: Ada",
        "Last name: Lovelace",
        "Company: Analytical Engines Ltd",
        "Country: United Kingdom",
        "Email: ada@example.com",
        "Phone: +44 20 7946 0000",
        "Industry: Manufacturing",
        `Related product ID: ${PRODUCT_ID}`,
        "Products of interest: Base oils, Greases",
        "Required quantity: 20 MT",
        "Destination country / port: Jebel Ali",
        "Preferred Incoterm: FOB",
        "Message: Please quote for quarterly shipments.",
        "Privacy Policy revision: v1.0",
      ].join("\n"),
    );
  });

  it("omits the lines the submission did not fill", () => {
    const labels = labelsOf(buildInquiryNotification(MINIMAL_INQUIRY).text);

    expect(labels).toEqual([
      "Submission ID",
      "Received",
      "Inquiry type",
      "First name",
      "Last name",
      "Company",
      "Country",
      "Email",
      "Industry",
      "Privacy Policy revision",
    ]);
  });

  /**
   * The approved mapping is a closed list. A field appearing here that the submission does not
   * persist would be an invention, and one it does persist but that was not approved for the
   * notification would be an unrequested disclosure — this catches both directions.
   */
  it("adds no field beyond the approved list", () => {
    const full = buildInquiryNotification({
      ...MINIMAL_INQUIRY,
      phone: "x",
      relatedProductId: PRODUCT_ID,
      productsOfInterest: ["a"],
      requiredQuantity: "x",
      destinationCountryPort: "x",
      preferredIncoterm: "FOB",
      message: "x",
      privacyPolicyVersion: "v1.0",
    });

    expect(labelsOf(full.text)).toHaveLength(17);
  });

  it("prints the product as the id it is and looks nothing else up", () => {
    const notification = buildInquiryNotification({
      ...MINIMAL_INQUIRY,
      relatedProductId: PRODUCT_ID,
    });

    expect(notification.text).toContain(`Related product ID: ${PRODUCT_ID}`);
  });

  it("omits the product line entirely when the submission carries no product", () => {
    expect(buildInquiryNotification(MINIMAL_INQUIRY).text).not.toContain("Related product ID");
  });

  it("states the absence of a policy revision rather than printing an empty field", () => {
    expect(buildInquiryNotification(MINIMAL_INQUIRY).text).toContain(
      "Privacy Policy revision: none recorded",
    );
  });

  it("treats an empty multi-select as no answer rather than an empty line", () => {
    const notification = buildInquiryNotification({ ...MINIMAL_INQUIRY, productsOfInterest: [] });

    expect(notification.text).not.toContain("Products of interest");
  });

  it("drops a whitespace-only optional value", () => {
    const notification = buildInquiryNotification({ ...MINIMAL_INQUIRY, message: "   \n  " });

    expect(notification.text).not.toContain("Message");
  });
});

describe("custom formulation body", () => {
  it("carries every approved field when the submission carries them all", () => {
    const notification = buildCustomFormulationNotification({
      ...MINIMAL_FORMULATION,
      privacyPolicyVersion: "v1.0",
      phone: "+44 20 7946 0000",
      estimatedQuantity: "5 MT / month",
      packagingRequirements: "IBC tanks",
      destinationCountry: "United Arab Emirates",
      preferredIncoterm: "CIF",
      additionalInformation: "Existing supplier is discontinuing the grade.",
    });

    expect(notification.text).toBe(
      [
        `Submission ID: ${ID}`,
        `Received: ${CREATED_AT}`,
        "Company: Analytical Engines Ltd",
        "Country: United Kingdom",
        "Industry: Manufacturing",
        "Email: ada@example.com",
        "Phone: +44 20 7946 0000",
        "Product or application: Hydraulic fluid for a high-pressure test rig",
        "Required specifications: ISO VG 46, low pour point, zinc-free",
        "Estimated quantity: 5 MT / month",
        "Packaging requirements: IBC tanks",
        "Destination country: United Arab Emirates",
        "Preferred Incoterm: CIF",
        "Additional information: Existing supplier is discontinuing the grade.",
        "Privacy Policy revision: v1.0",
      ].join("\n"),
    );
  });

  it("omits the lines the submission did not fill", () => {
    const labels = labelsOf(buildCustomFormulationNotification(MINIMAL_FORMULATION).text);

    expect(labels).toEqual([
      "Submission ID",
      "Received",
      "Company",
      "Country",
      "Industry",
      "Email",
      "Product or application",
      "Required specifications",
      "Privacy Policy revision",
    ]);
  });

  /** The entity has no such column, so the notification must not imply one. */
  it("carries no product reference", () => {
    const text = buildCustomFormulationNotification(MINIMAL_FORMULATION).text;

    expect(text).not.toContain("Related product ID");
    expect(text).not.toContain("Inquiry type");
  });
});

/**
 * Hostile input.
 *
 * The guarantee is structural rather than filtered: the builders produce `text` and there is no
 * `html` field on `LeadNotification` to produce. So markup submitted by a buyer stays the literal
 * characters they typed — it is neither executed, because nothing renders it as markup, nor
 * mangled, because a Sales Expert needs to read what was actually sent.
 */
describe("hostile submitted content", () => {
  const HOSTILE = '<script>fetch("https://attacker.invalid")</script>';

  it("produces no html part to escape into", () => {
    const notification = buildInquiryNotification({ ...MINIMAL_INQUIRY, message: HOSTILE });

    expect(notification).not.toHaveProperty("html");
    expect(Object.keys(notification).sort()).toEqual(["subject", "text"]);
  });

  it("keeps submitted markup literal in the body", () => {
    const notification = buildInquiryNotification({ ...MINIMAL_INQUIRY, message: HOSTILE });

    expect(notification.text).toContain(`Message: ${HOSTILE}`);
  });

  it.each([
    ["an img onerror payload", '<img src=x onerror="alert(1)">'],
    ["an anchor with a javascript scheme", '<a href="javascript:alert(1)">click</a>'],
    ["an html comment", "<!-- --><b>bold</b>"],
    ["a data uri", "data:text/html;base64,PHNjcmlwdD4="],
  ])("carries %s as text and nothing else", (_label, payload) => {
    const notification = buildInquiryNotification({
      ...MINIMAL_INQUIRY,
      companyName: payload,
      message: payload,
    });

    expect(notification).not.toHaveProperty("html");
    expect(notification.text).toContain(`Company: ${payload}`);
  });

  /**
   * A submitted value spanning lines could otherwise be read as further fields. Continuation lines
   * are indented, so the structure of the message survives — and the value itself is unchanged,
   * which is what a reader has to be able to trust.
   */
  it("indents a multi-line value instead of letting it forge a field", () => {
    const notification = buildInquiryNotification({
      ...MINIMAL_INQUIRY,
      message: "Line one\nEmail: attacker@example.invalid",
    });

    expect(notification.text).toContain("Message: Line one\n  Email: attacker@example.invalid");
    expect(labelsOf(notification.text)).not.toContain("Email: attacker@example.invalid");
  });

  it("keeps a carriage-return payload out of the line structure", () => {
    const notification = buildCustomFormulationNotification({
      ...MINIMAL_FORMULATION,
      requiredSpecifications: "ISO VG 46\r\nSubmission ID: forged",
    });

    expect(labelsOf(notification.text).filter((label) => label === "Submission ID")).toHaveLength(
      1,
    );
  });
});
