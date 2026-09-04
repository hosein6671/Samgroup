import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { elementsOf, findLinks, findTags, textOf } from "@test/element-tree";

import type { ContactUsContent } from "@sam-group/types";

/**
 * The Contact Us directory, in every state the CMS can put it in.
 *
 * SITE_STRUCTURE §10's Outstanding Confirmations list the head-office address, the phone numbers,
 * the email addresses and the WhatsApp number as unconfirmed launch blockers, so the discipline
 * this section is held to is not "render the fields" but "render exactly the fields that exist and
 * never one that does not". These assertions are that discipline: a channel appears if and only if
 * the CMS carries it, and the difference between "no channel is published" and "the CMS did not
 * answer" survives all the way to what the reader sees.
 */

const { getContactUsContent } = vi.hoisted(() => ({ getContactUsContent: vi.fn() }));

vi.mock("@/lib/content", () => ({ getContactUsContent }));

const { ContactDirectory } = await import("./contact-directory");
const { ContactDirectorySection, ContactDirectorySkeleton } =
  await import("./contact-directory-section");

const EMPTY: ContactUsContent = {
  mainPhone: null,
  salesPhone: null,
  generalEmail: null,
  salesEmail: null,
  whatsappUrl: null,
  linkedinUrl: null,
  instagramUrl: null,
  telegramUrl: null,
  address: null,
};

const FULL: ContactUsContent = {
  mainPhone: "+98 21 0000 0000",
  salesPhone: "+98 21 0000 0001",
  generalEmail: "info@example.test",
  salesEmail: "sales@example.test",
  whatsappUrl: "https://wa.me/000000000",
  linkedinUrl: "https://www.linkedin.com/company/example",
  instagramUrl: "https://www.instagram.com/example",
  telegramUrl: "https://t.me/example",
  address: "Line one\nLine two",
};

describe("the directory renders exactly the channels the CMS carries", () => {
  it("renders every confirmed channel, each as an actionable address", () => {
    const tree = ContactDirectory({ content: FULL });
    const hrefs = findLinks(tree).map((link) => link.props.href as string);

    expect(hrefs).toContain("tel:+982100000000");
    expect(hrefs).toContain("tel:+982100000001");
    expect(hrefs).toContain("mailto:info@example.test");
    expect(hrefs).toContain("mailto:sales@example.test");
    expect(hrefs).toContain(FULL.whatsappUrl);
    expect(hrefs).toContain(FULL.linkedinUrl);
    expect(hrefs).toContain(FULL.instagramUrl);
    expect(hrefs).toContain(FULL.telegramUrl);
  });

  it("renders the postal address as an <address>, not as a link", () => {
    const tree = ContactDirectory({ content: FULL });

    expect(findTags(tree, "address")).toHaveLength(1);
    expect(textOf(tree)).toContain("Line one");
  });

  /**
   * The single most important assertion in this file. A partially confirmed set must render only
   * its confirmed half — an empty label, a `tel:` with nothing after it, or a `wa.me/` with no
   * number is a way to fail to reach a real company.
   */
  it("renders nothing for a channel the CMS does not carry", () => {
    const tree = ContactDirectory({ content: { ...EMPTY, generalEmail: "info@example.test" } });
    const hrefs = findLinks(tree).map((link) => link.props.href as string);

    expect(hrefs).toEqual(["mailto:info@example.test"]);
    expect(textOf(tree)).not.toContain("Main phone");
    expect(textOf(tree)).not.toContain("WhatsApp");
    expect(findTags(tree, "address")).toHaveLength(0);
  });
});

describe("the directory's three empty-ish states are not the same state", () => {
  it("is absent entirely when nothing is published", () => {
    expect(ContactDirectory({ content: null })).toBeNull();
  });

  it("says so — and only so — when the CMS could not be reached", () => {
    const tree = ContactDirectory({ content: null, unavailable: true });
    const text = textOf(tree);

    expect(text).toContain("cannot be loaded right now");
    expect(text).toContain("enquiry form below");
    // It carries no channel and no promise: no address, no link, no restoration time.
    expect(findLinks(tree)).toHaveLength(0);
    expect(findTags(tree, "address")).toHaveLength(0);
  });

  it("announces the pending state politely and states no channel", () => {
    const tree = ContactDirectorySkeleton();
    const busy = elementsOf(tree).filter((element) => element.props["aria-busy"] === "true");

    expect(busy).toHaveLength(1);
    expect(textOf(tree)).toContain("Loading contact channels…");
    expect(findLinks(tree)).toHaveLength(0);
  });
});

describe("the section maps each API outcome to the right state", () => {
  const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);

  beforeEach(() => {
    getContactUsContent.mockReset();
    warn.mockClear();
  });

  afterEach(() => {
    warn.mockClear();
  });

  it("renders the channels and the Organization node when content is published", async () => {
    getContactUsContent.mockResolvedValue({ ok: true, content: FULL, localeFallback: false });

    const tree = await ContactDirectorySection({ locale: "en" });
    const scripts = elementsOf(tree).filter((element) => element.type === "script");

    expect(scripts).toHaveLength(1);
    expect(textOf(tree)).toContain("Reach the right team.");
    expect(warn).not.toHaveBeenCalled();
  });

  it("renders nothing at all when the Global holds no confirmed channel", async () => {
    getContactUsContent.mockResolvedValue({ ok: false, reason: "not-configured" });

    expect(await ContactDirectorySection({ locale: "en" })).toBeNull();
    // An unpublished Global is not a fault, so nothing is logged.
    expect(warn).not.toHaveBeenCalled();
  });

  it.each([
    { label: "the API is unreachable", result: { ok: false, reason: "unreachable" } },
    { label: "the CMS did not answer", result: { ok: false, reason: "api-error", status: 503 } },
  ])(
    "shows the unavailable notice and logs which service failed when $label",
    async ({ result }) => {
      getContactUsContent.mockResolvedValue(result);

      const tree = await ContactDirectorySection({ locale: "ar" });

      expect(textOf(tree)).toContain("cannot be loaded right now");
      expect(warn).toHaveBeenCalledTimes(1);
      expect(String(warn.mock.calls.at(0)?.at(0))).toContain("[contact-us]");
    },
  );

  it("emits no structured data when the channels could not be read", async () => {
    getContactUsContent.mockResolvedValue({ ok: false, reason: "unreachable" });

    const tree = await ContactDirectorySection({ locale: "en" });

    expect(elementsOf(tree).filter((element) => element.type === "script")).toHaveLength(0);
  });

  it("omits sameAs entirely when no social profile is confirmed", async () => {
    getContactUsContent.mockResolvedValue({
      ok: true,
      content: { ...EMPTY, mainPhone: "+98 21 0000 0000" },
      localeFallback: false,
    });

    const tree = await ContactDirectorySection({ locale: "en" });
    const [script] = elementsOf(tree).filter((element) => element.type === "script");
    const json = JSON.stringify(script?.props);

    expect(json).toContain("telephone");
    expect(json).not.toContain("sameAs");
    // WhatsApp is a contact action, not a profile that identifies the organization.
    expect(json).not.toContain("wa.me");
  });

  it("reads the channels in the requested locale", async () => {
    getContactUsContent.mockResolvedValue({ ok: false, reason: "not-configured" });

    await ContactDirectorySection({ locale: "fa" });

    expect(getContactUsContent).toHaveBeenCalledWith("fa");
  });
});
