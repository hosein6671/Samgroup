import { describe, expect, it, vi } from "vitest";

import {
  accessibleName,
  elementsOf,
  findLinks,
  findTags,
  tagOf,
  textOf,
  visibleTextOf,
} from "@test/element-tree";

import { FormulationDetail, FormulationTable } from "./formulation-views";
import {
  InboxEmpty,
  InboxForbidden,
  InboxFrame,
  InboxNotFound,
  InboxPagination,
  InboxUnavailable,
} from "./inbox-frame";
import { InquiryDetail, InquiryFilters, InquiryTable } from "./inquiry-views";
import { INQUIRIES_PATH } from "./lead-routes";

import type { TreeElement } from "@test/element-tree";
import type { ReactNode } from "react";

/**
 * The Admin lead surface against the **WCAG 2.2 AA** target frozen for Admin UI.
 *
 * ## What these tests can and cannot prove
 *
 * They assert **structure and naming** in what the Server Components return: landmarks, the heading
 * hierarchy, table semantics, accessible names, pagination state, `<time>`, and the absence of
 * pointer-only controls. That is the part of WCAG that is decidable from markup, and it is the part
 * that regresses silently.
 *
 * They do **not** prove contrast (that is `admin-contrast.spec.ts`, against the real tokens), and
 * they do not prove focus order or focus visibility — those need a browser, and this gate verified
 * them there. No axe or jsdom dependency was added; adding one would need its own approval, and
 * everything below is decidable without it.
 */

vi.mock("@/features/admin/actions", () => ({ signOut: vi.fn() }));

const ADMIN = { email: "admin@samgp.test", role: "admin" };
const CONTENT_MANAGER = { email: "editor@samgp.test", role: "content_manager" };

const INQUIRY = {
  id: "11111111-1111-4111-8111-111111111111",
  createdAt: "2026-08-19T09:30:00.000Z",
  inquiryType: "sample_request" as const,
  firstName: "Ada",
  lastName: "Lovelace",
  companyName: "Analytical Engines Ltd",
  country: "United Kingdom",
  email: "ada@example.com",
  relatedProductId: null,
  status: "new",
  assigneeId: null,
};

const INQUIRY_DETAIL = {
  ...INQUIRY,
  phone: null,
  industry: "Manufacturing",
  productsOfInterest: ["Base oils"],
  requiredQuantity: "20 t",
  destinationCountryPort: null,
  preferredIncoterm: "FOB",
  message: "Please send a sample.",
  consentGiven: true,
  privacyPolicyVersion: null,
};

const REQUEST = {
  id: "22222222-2222-4222-8222-222222222222",
  createdAt: "2026-08-19T10:00:00.000Z",
  companyName: "Analytical Engines Ltd",
  country: "United Kingdom",
  industry: "Manufacturing",
  email: "ada@example.com",
  productOrApplication: "High-temperature chain oil",
  status: "new",
  assigneeId: null,
};

const REQUEST_DETAIL = {
  ...REQUEST,
  phone: null,
  requiredSpecifications: "ISO VG 220",
  estimatedQuantity: null,
  packagingRequirements: null,
  additionalInformation: null,
  destinationCountry: null,
  preferredIncoterm: null,
  consentGiven: true,
  privacyPolicyVersion: null,
};

/** A full inbox page, frame and all — what a reader actually meets. */
function inboxPage(children: ReactNode = <InquiryTable items={[INQUIRY]} />): ReactNode {
  return (
    <InboxFrame title="Inquiries" user={ADMIN} section="inquiries">
      <InquiryFilters query={{ page: 1, limit: 25 }} />
      {children}
      <InboxPagination
        page={2}
        pages={4}
        total={90}
        unit="inquiries"
        hrefForPage={(page) => `${INQUIRIES_PATH}?page=${String(page)}`}
      />
    </InboxFrame>
  );
}

const HEADING_TAGS = new Set(["h1", "h2", "h3", "h4", "h5", "h6"]);

function headingLevels(node: ReactNode): number[] {
  return elementsOf(node)
    .map((element) => tagOf(element))
    .filter((tag): tag is string => tag !== null && HEADING_TAGS.has(tag))
    .map((tag) => Number(tag.slice(1)));
}

describe("landmarks", () => {
  it("has exactly one main, and it is the skip link's target", () => {
    const mains = findTags(inboxPage(), "main");

    expect(mains).toHaveLength(1);
    // The root layout's "Skip to content" link points at #main-content; a page without that id
    // would leave the skip link pointing at nothing.
    expect(mains[0]?.props.id).toBe("main-content");
  });

  /** Native `<main>` and `<nav>` already carry their roles; restating them would be noise. */
  it("adds no redundant ARIA role to a native landmark", () => {
    for (const element of elementsOf(inboxPage())) {
      const tag = tagOf(element);

      if (tag === "main") expect(element.props.role).toBeUndefined();
      if (tag === "nav") expect(element.props.role).toBeUndefined();
    }
  });

  it("names every nav, so a reader can tell three of them apart", () => {
    const navs = findTags(inboxPage(), "nav");

    expect(navs.length).toBeGreaterThanOrEqual(3);

    for (const nav of navs) {
      expect(nav.props["aria-label"]).toEqual(expect.any(String));
      expect(nav.props["aria-label"]).not.toBe("");
    }
  });

  it("labels the pagination landmark 'Pagination'", () => {
    const labels = findTags(inboxPage(), "nav").map((nav) => nav.props["aria-label"]);

    expect(labels).toContain("Pagination");
  });
});

describe("headings", () => {
  it("has exactly one h1, and it names the screen", () => {
    const h1s = findTags(inboxPage(), "h1");

    expect(h1s).toHaveLength(1);
    expect(visibleTextOf(h1s[0]?.props.children as ReactNode)).toBe("Inquiries");
  });

  /** The product wordmark is a paragraph. A heading there would leave the page untitled. */
  it("does not use a heading for the wordmark", () => {
    expect(textOf(inboxPage())).toContain("SAM Group Admin");
    expect(findTags(inboxPage(), "h1")).toHaveLength(1);
  });

  it.each([
    ["a list page", inboxPage()],
    ["an empty state", inboxPage(<InboxEmpty heading="No inquiries yet">Nothing yet.</InboxEmpty>)],
    ["a forbidden state", inboxPage(<InboxForbidden />)],
    ["an unavailable state", inboxPage(<InboxUnavailable />)],
    [
      "a not-found state",
      inboxPage(<InboxNotFound label="Gone." backHref={INQUIRIES_PATH} backLabel="Back" />),
    ],
    ["an inquiry detail", inboxPage(<InquiryDetail inquiry={INQUIRY_DETAIL} />)],
    ["a formulation detail", inboxPage(<FormulationDetail request={REQUEST_DETAIL} />)],
  ])("skips no heading level on %s", (_name, tree) => {
    const levels = headingLevels(tree);

    expect(levels[0]).toBe(1);

    for (const [index, level] of levels.entries()) {
      const previous = levels[index - 1];

      if (previous !== undefined) expect(level).toBeLessThanOrEqual(previous + 1);
    }
  });

  it("gives every state a heading, so no panel is a bare paragraph", () => {
    for (const state of [
      <InboxEmpty heading="No inquiries yet" key="e">
        Nothing yet.
      </InboxEmpty>,
      <InboxForbidden key="f" />,
      <InboxUnavailable key="u" />,
      <InboxNotFound label="Gone." backHref={INQUIRIES_PATH} backLabel="Back" key="n" />,
    ]) {
      expect(findTags(state, "h2")).toHaveLength(1);
    }
  });

  it("gives each detail group a real section heading", () => {
    const groups = findTags(<InquiryDetail inquiry={INQUIRY_DETAIL} />, "h2").map((heading) =>
      visibleTextOf(heading.props.children as ReactNode),
    );

    expect(groups).toEqual(["Submission", "Contact", "Company", "Request", "Consent"]);
  });

  it("associates each detail section with its own heading", () => {
    for (const section of findTags(<InquiryDetail inquiry={INQUIRY_DETAIL} />, "section")) {
      expect(section.props["aria-labelledby"]).toEqual(expect.any(String));
    }
  });
});

describe("the inbox table", () => {
  const table = <InquiryTable items={[INQUIRY]} />;

  it("is a real table with an accessible caption", () => {
    expect(findTags(table, "table")).toHaveLength(1);
    expect(findTags(table, "caption")).toHaveLength(1);
    expect(visibleTextOf(findTags(table, "caption")[0]?.props.children as ReactNode)).toContain(
      "Inquiries",
    );
  });

  it("scopes every header cell", () => {
    const headers = findTags(table, "th");

    expect(headers.length).toBeGreaterThan(0);

    for (const header of headers) {
      expect(["col", "row"]).toContain(header.props.scope);
    }
  });

  it("gives every column a meaningful label", () => {
    const columns = findTags(table, "th")
      .filter((header) => header.props.scope === "col")
      .map((header) => visibleTextOf(header.props.children as ReactNode));

    expect(columns).toEqual([
      "Submitted",
      "Type",
      "Name",
      "Company",
      "Country",
      "Email",
      "Status",
      "Assigned",
    ]);
  });

  it("makes the name cell the row header, so cells are announced with their row", () => {
    const rowHeaders = findTags(table, "th").filter((header) => header.props.scope === "row");

    expect(rowHeaders).toHaveLength(1);
  });

  /**
   * The record is opened by a real link. A row-level click handler would be unreachable by
   * keyboard and invisible to assistive technology — §2.1.1 and §4.1.2 both.
   */
  it("opens a record through a link, never through a clickable row or cell", () => {
    const links = findLinks(table);

    expect(links).toHaveLength(1);
    expect(links[0]?.props.href).toBe(`${INQUIRIES_PATH}/${INQUIRY.id}`);

    for (const element of elementsOf(table)) {
      expect(element.props.onClick).toBeUndefined();
    }
  });

  it("names the record link by the record it opens", () => {
    const [link] = findLinks(table);

    // The visible text is still the person's name, so the accessible name contains the label
    // (§2.5.3) while saying what activating it does (§2.4.4).
    expect(accessibleName(link as TreeElement)).toBe("View inquiry from Ada Lovelace");
  });

  it("renders each timestamp as a real time element carrying the machine value", () => {
    const times = findTags(table, "time");

    expect(times).toHaveLength(1);
    expect(times[0]?.props.dateTime).toBe(INQUIRY.createdAt);
    expect(visibleTextOf(times[0]?.props.children as ReactNode)).toBe("2026-08-19 09:30 UTC");
  });

  /**
   * A scrollable region that cannot be focused cannot be scrolled without a pointer. It is named
   * too, so a reader arriving on it knows what they have landed in.
   */
  it("makes the horizontal scroll container reachable by keyboard", () => {
    const container = elementsOf(table).find(
      (element) => element.props.className === "ad-table-scroll",
    );

    expect(container?.props.tabIndex).toBe(0);
    expect(container?.props["aria-label"]).toEqual(expect.any(String));
  });

  it("keeps the status readable as text rather than as a colour or an icon", () => {
    expect(visibleTextOf(table)).toContain("new");
  });

  it("applies the same rules to the formulation table", () => {
    const other = <FormulationTable items={[REQUEST]} />;

    expect(findTags(other, "caption")).toHaveLength(1);
    expect(findTags(other, "time")[0]?.props.dateTime).toBe(REQUEST.createdAt);
    expect(accessibleName(findLinks(other)[0] as TreeElement)).toBe(
      "View request from Analytical Engines Ltd",
    );

    for (const header of findTags(other, "th")) {
      expect(["col", "row"]).toContain(header.props.scope);
    }
  });
});

describe("pagination", () => {
  const pager = (
    <InboxPagination
      page={2}
      pages={4}
      total={90}
      unit="inquiries"
      hrefForPage={(page) => `${INQUIRIES_PATH}?page=${String(page)}`}
    />
  );

  it("marks exactly one control as the current page", () => {
    const current = elementsOf(pager).filter((element) => element.props["aria-current"] === "page");

    expect(current).toHaveLength(1);
    expect(current[0]?.props.href).toBe(`${INQUIRIES_PATH}?page=2`);
  });

  it("names every page link rather than leaving a bare digit", () => {
    const numbered = findLinks(pager).filter((link) =>
      String(link.props["aria-label"] ?? "").startsWith("Page "),
    );

    expect(numbered.map((link) => link.props["aria-label"])).toEqual([
      "Page 1",
      "Page 2",
      "Page 3",
      "Page 4",
    ]);
  });

  it("names previous and next without reading the arrow glyphs", () => {
    const names = findLinks(pager).map((link) => accessibleName(link));

    expect(names).toContain("Previous");
    expect(names).toContain("Next");
  });

  it("hides the decorative arrows from assistive technology", () => {
    const arrows = elementsOf(pager).filter((element) => {
      const text = visibleTextOf(element.props.children as ReactNode);

      return tagOf(element) === "span" && (text === "←" || text === "→");
    });

    expect(arrows.length).toBeGreaterThan(0);

    for (const arrow of arrows) {
      expect(String(arrow.props["aria-hidden"])).toBe("true");
    }
  });

  /**
   * On a boundary the control is a `<span>`, not a link without an href. An `<a>` has no disabled
   * state; a keyboard user must never land on something that does nothing when activated.
   */
  it("renders an unavailable Previous as inert markup, never as a fake link", () => {
    const first = (
      <InboxPagination
        page={1}
        pages={3}
        total={60}
        unit="inquiries"
        hrefForPage={(page) => `${INQUIRIES_PATH}?page=${String(page)}`}
      />
    );

    const names = findLinks(first).map((link) => accessibleName(link));

    expect(names).not.toContain("Previous");
    expect(visibleTextOf(first)).toContain("Previous");
  });

  it("renders an unavailable Next as inert markup on the last page", () => {
    const last = (
      <InboxPagination
        page={3}
        pages={3}
        total={60}
        unit="inquiries"
        hrefForPage={(page) => `${INQUIRIES_PATH}?page=${String(page)}`}
      />
    );

    expect(findLinks(last).map((link) => accessibleName(link))).not.toContain("Next");
    expect(visibleTextOf(last)).toContain("Next");
  });

  it("hides the windowing ellipsis from assistive technology", () => {
    const wide = (
      <InboxPagination
        page={9}
        pages={20}
        total={500}
        unit="inquiries"
        hrefForPage={(page) => `${INQUIRIES_PATH}?page=${String(page)}`}
      />
    );

    const gaps = elementsOf(wide).filter((element) => element.props.className === "ad-pager-gap");

    expect(gaps.length).toBeGreaterThan(0);

    for (const gap of gaps) {
      expect(String(gap.props["aria-hidden"])).toBe("true");
    }
  });

  it("says how many records there are in words", () => {
    expect(visibleTextOf(pager)).toContain("90 inquiries in total");
  });
});

describe("the filter strip", () => {
  it("is a named navigation of links, not a mouse-only control set", () => {
    const filters = <InquiryFilters query={{ page: 1, limit: 25 }} />;

    expect(findTags(filters, "nav")[0]?.props["aria-label"]).toBe("Filter inquiries by type");
    expect(findLinks(filters)).toHaveLength(8);

    for (const element of elementsOf(filters)) {
      expect(element.props.onClick).toBeUndefined();
    }
  });

  it("marks exactly one filter as current", () => {
    const filters = (
      <InquiryFilters query={{ page: 1, limit: 25, inquiryType: "sample_request" }} />
    );
    const current = findLinks(filters).filter((link) => link.props["aria-current"] === true);

    expect(current).toHaveLength(1);
    expect(accessibleName(current[0] as TreeElement)).toBe("Sample request");
  });

  it("marks 'All types' as current when nothing is filtered", () => {
    const filters = <InquiryFilters query={{ page: 1, limit: 25 }} />;
    const current = findLinks(filters).filter((link) => link.props["aria-current"] === true);

    expect(accessibleName(current[0] as TreeElement)).toBe("All types");
  });
});

describe("navigation and controls", () => {
  it("gives every link a non-empty accessible name", () => {
    for (const link of findLinks(inboxPage())) {
      expect(accessibleName(link).length).toBeGreaterThan(0);
    }
  });

  it("offers sign-out as a real button in a form, operable before hydration", () => {
    const buttons = findTags(inboxPage(), "button");

    expect(buttons).toHaveLength(1);
    expect(buttons[0]?.props.type).toBe("submit");
    expect(visibleTextOf(buttons[0]?.props.children as ReactNode)).toBe("Sign out");
  });

  it("has no clickable non-interactive element anywhere on the page", () => {
    for (const element of elementsOf(inboxPage())) {
      expect(element.props.onClick).toBeUndefined();
      expect(element.props.onKeyDown).toBeUndefined();
    }
  });

  /**
   * A Content Manager may not enter `/admin`, so offering them a link to it would be an affordance
   * that leads to a refusal. The two inbox links stay.
   */
  it("hides the Admin-shell link from a role that may not enter the shell", () => {
    const page = (
      <InboxFrame title="Inquiries" user={CONTENT_MANAGER} section="inquiries">
        <InboxEmpty heading="No inquiries yet">Nothing yet.</InboxEmpty>
      </InboxFrame>
    );

    const hrefs = findLinks(page).map((link) => link.props.href);

    expect(hrefs).not.toContain("/admin");
    expect(hrefs).toContain("/admin/leads/inquiries");
    expect(hrefs).toContain("/admin/leads/custom-formulation-requests");
  });

  it("offers the Admin-shell link to a role that may enter it", () => {
    expect(findLinks(inboxPage()).map((link) => link.props.href)).toContain("/admin");
  });

  /**
   * A Customer reaches this frame: the lead route renders its refusal *inside* it. Offering them a
   * menu of two pages that both refuse them would be an affordance pointing at nothing, so the
   * navigation is omitted entirely rather than rendered empty — an unlabelled empty landmark is
   * noise in the landmark list. Found in a browser, not in review.
   */
  it("renders no navigation at all for a role no area admits", () => {
    const page = (
      <InboxFrame
        title="Inquiries"
        user={{ email: "buyer@example.test", role: "customer" }}
        section="inquiries"
      >
        <InboxForbidden />
      </InboxFrame>
    );

    expect(findTags(page, "nav")).toHaveLength(0);
    expect(findLinks(page)).toHaveLength(0);

    // The refusal and the way out are still there — the page is not a dead end.
    expect(visibleTextOf(page)).toContain("Access denied");
    expect(findTags(page, "button")).toHaveLength(1);
  });

  it("marks the inbox being viewed as the current page in the navigation", () => {
    const current = findLinks(inboxPage()).filter((link) => link.props["aria-current"] === "page");

    expect(current.map((link) => link.props.href)).toEqual([
      "/admin/leads/inquiries",
      `${INQUIRIES_PATH}?page=2`,
    ]);
  });
});

describe("the states read without colour, icon or position", () => {
  it.each([
    [
      "empty",
      <InboxEmpty heading="No inquiries yet" key="e">
        Nothing has been submitted.
      </InboxEmpty>,
      "No inquiries yet",
    ],
    ["forbidden", <InboxForbidden key="f" />, "Access denied"],
    ["unavailable", <InboxUnavailable key="u" />, "Temporarily unavailable"],
    [
      "not found",
      <InboxNotFound label="No such inquiry." backHref={INQUIRIES_PATH} backLabel="Back" key="n" />,
      "Not found",
    ],
  ])("%s carries a heading and a sentence", (_name, state, heading) => {
    const text = visibleTextOf(state);

    expect(text).toContain(heading);
    expect(text.length).toBeGreaterThan(heading.length + 10);
  });

  it("offers a way back from not-found", () => {
    const state = (
      <InboxNotFound
        label="No such inquiry."
        backHref={INQUIRIES_PATH}
        backLabel="Back to inquiries"
      />
    );

    expect(findLinks(state)[0]?.props.href).toBe(INQUIRIES_PATH);
  });

  /** Nothing about an outage is an authentication claim, so nothing may read like one. */
  it("does not word an outage as a sign-in problem", () => {
    const text = visibleTextOf(<InboxUnavailable />).toLowerCase();

    expect(text).not.toContain("sign in");
    expect(text).not.toContain("password");
    expect(text).not.toContain("denied");
  });

  it("does not word a refusal as a sign-in problem either", () => {
    const text = visibleTextOf(<InboxForbidden />).toLowerCase();

    expect(text).not.toContain("sign in");
    expect(text).not.toContain("password");
  });
});

describe("no credential reaches the markup", () => {
  it("emits no token, cookie name, scheme or API origin", () => {
    const serialized = `${textOf(inboxPage())} ${JSON.stringify(elementsOf(inboxPage()).map((element) => element.props.className))}`;

    for (const secret of ["bearer", "authorization", "sam_admin_access", "sam_admin_refresh"]) {
      expect(serialized.toLowerCase()).not.toContain(secret);
    }

    expect(serialized).not.toContain("/api/v1");
    expect(serialized).not.toMatch(/https?:\/\//);
  });
});
