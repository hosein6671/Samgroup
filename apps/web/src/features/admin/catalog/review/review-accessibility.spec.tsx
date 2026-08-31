import { describe, expect, it, vi } from "vitest";

import {
  accessibleName,
  elementsOf,
  findLinks,
  findTags,
  textOf,
  visibleTextOf,
} from "@test/element-tree";

import { AdminNav } from "../../admin-nav";
import {
  ActiveFilterSummary,
  ReviewFilters,
  ReviewFrame,
  ReviewPagination,
  ReviewQueueOverview,
  ReviewQueueTable,
  StatusBadge,
  StatusLegend,
} from "./queue-views";
import { activeFilters, DEFAULT_LIMIT, DEFAULT_SORT } from "./review-query";
import { DESCRIBE_FILTER } from "./review-vocabulary";

import type { ReviewQueueQuery } from "./review-query";
import type { ReviewQueueItemResponse } from "@sam-group/types";
import type { ReactNode } from "react";

/**
 * The review queue against the **WCAG 2.2 AA** target frozen for Admin UI.
 *
 * ## What these tests can and cannot prove
 *
 * They assert **structure and naming** in what the Server Components return: landmarks, the heading
 * hierarchy, table semantics and header scopes, accessible names, the focusable scroll region,
 * pagination state, `<time>`, and the absence of pointer-only controls. That is the part of WCAG
 * that is decidable from markup, and it is the part that regresses silently.
 *
 * They do **not** prove contrast — that is `admin-contrast.spec.ts`, against the real tokens — and
 * they do not prove focus order or focus visibility, which need a browser. No axe, jsdom or
 * testing-library dependency was added; everything below is decidable without one.
 */

vi.mock("@/features/admin/actions", () => ({ signOut: vi.fn() }));

const ADMIN = { email: "admin@samgp.com", role: "admin" };
const QUERY: ReviewQueueQuery = { page: 1, limit: DEFAULT_LIMIT, sort: DEFAULT_SORT };

const SPECIFICATION: ReviewQueueItemResponse = {
  subjectType: "specification",
  id: "11111111-1111-4111-8111-111111111111",
  reviewStatus: "source_recorded",
  createdAt: "2026-08-24T09:00:00.000Z",
  product: {
    slug: "hsb-2000",
    name: "HSB 2000",
    sourceRef: "HSB-001",
    family: "industrial-oils-lubricants",
    productType: null,
  },
  grade: null,
  propertyKey: "kinematic_viscosity_100c",
  claimKind: null,
  locale: null,
  summary: "kinematic_viscosity_100c 11.5 mm2/s",
  evidenceCount: 1,
  hasUnresolvedFindings: false,
  reviewCount: 0,
};

const CLAIM: ReviewQueueItemResponse = {
  ...SPECIFICATION,
  subjectType: "product_claim",
  id: "22222222-2222-4222-8222-222222222222",
  reviewStatus: "needs_review",
  propertyKey: null,
  claimKind: "reference_only",
  locale: null,
  grade: { id: "g1", label: "SAE 40", gradeSystem: "sae" },
  hasUnresolvedFindings: true,
  summary: "reference_only API CK-4",
};

function queuePage(): ReactNode {
  const filters = activeFilters(QUERY, DESCRIBE_FILTER);
  return (
    <ReviewFrame user={ADMIN}>
      <ReviewQueueOverview items={[SPECIFICATION, CLAIM]} total={1546} page={1} pages={62} />
      <StatusLegend total={1546} />
      <ReviewFilters query={QUERY} />
      <ActiveFilterSummary query={QUERY} filters={filters} total={1546} />
      <ReviewQueueTable
        items={[SPECIFICATION, CLAIM]}
        total={1546}
        page={1}
        pages={62}
        query={QUERY}
      />
      <ReviewPagination query={QUERY} page={1} pages={62} total={1546} />
    </ReviewFrame>
  );
}

/* ========================================================================== */

describe("landmarks and headings", () => {
  it("has exactly one main landmark, and it is the skip-link target", () => {
    const mains = findTags(queuePage(), "main");

    expect(mains).toHaveLength(1);
    expect(mains[0]?.props.id).toBe("main-content");
  });

  it("has exactly one h1", () => {
    expect(findTags(queuePage(), "h1")).toHaveLength(1);
  });

  it("puts every other heading at h2, so the hierarchy has no gap", () => {
    for (const level of ["h3", "h4", "h5", "h6"]) {
      expect(findTags(queuePage(), level)).toHaveLength(0);
    }
    expect(findTags(queuePage(), "h2").length).toBeGreaterThan(0);
  });

  it("summarises the current work without presenting page counts as queue totals", () => {
    const text = visibleTextOf(
      <ReviewQueueOverview items={[SPECIFICATION, CLAIM]} total={1546} page={1} pages={62} />,
    );

    expect(text).toContain("Matching queue 1546");
    expect(text).toContain("Needs review on this page 1");
    expect(text).toContain("Findings on this page 1");
    expect(text).toContain("Current page 1 / 62");
  });

  it("names every navigation, so a reader can tell them apart", () => {
    const navs = findTags(queuePage(), "nav");

    expect(navs.length).toBeGreaterThanOrEqual(3);
    for (const nav of navs) {
      const named =
        typeof nav.props["aria-label"] === "string" ||
        typeof nav.props["aria-labelledby"] === "string";
      expect(named).toBe(true);
    }
  });

  it("gives every section an accessible name", () => {
    for (const section of findTags(queuePage(), "section")) {
      const named =
        typeof section.props["aria-label"] === "string" ||
        typeof section.props["aria-labelledby"] === "string";
      expect(named).toBe(true);
    }
  });

  /** Native elements already carry their roles; restating them would be noise. */
  it("does not restate a native role", () => {
    for (const element of elementsOf(queuePage())) {
      const tag = typeof element.type === "string" ? element.type : null;
      if (tag === "nav" || tag === "main" || tag === "table") {
        expect(element.props.role).toBeUndefined();
      }
    }
  });
});

/* ========================================================================== */

describe("table semantics", () => {
  it("is a real table with a caption that says what it holds and where you are", () => {
    const table = findTags(queuePage(), "table")[0];
    const caption = findTags(queuePage(), "caption")[0];

    expect(table).toBeDefined();
    expect(caption).toBeDefined();
    const text = textOf(caption?.props.children as ReactNode);
    expect(text).toContain("Unapproved review subjects");
    expect(text).toContain("Page 1 of 62");
    expect(text).toContain("1546");
  });

  it("scopes every column header", () => {
    const headers = findTags(queuePage(), "th").filter((header) => header.props.scope === "col");

    // Ten: Phase B added the Review column, and the responsive work merged Status and Findings
    // into one "Status & findings" column so the narrowest tier can be three columns wide.
    expect(headers).toHaveLength(10);
  });

  it("makes the product cell the row header, so each row is identified", () => {
    const rowHeaders = findTags(queuePage(), "th").filter((header) => header.props.scope === "row");

    expect(rowHeaders).toHaveLength(2);
  });

  /**
   * The triage columns lead and the action ends the row.
   *
   * These are the columns the narrowest tier keeps, so their position is what makes a
   * three-column table possible: everything hidden at that width sits between them.
   */
  it("puts the triage columns first and the action last", () => {
    const headers = findTags(queuePage(), "th")
      .filter((header) => header.props.scope === "col")
      .map((header) => textOf(header.props.children as ReactNode));

    expect(headers.slice(0, 2)).toEqual(["Product", "Status & findings"]);
    expect(headers.at(-1)).toBe("Review");
  });

  /**
   * A hidden column must take its header with it.
   *
   * Columns are dropped at narrow widths with `display: none` on the `th` and its `td`s together.
   * If a class were ever put on one and not the other, the header row and the body rows would
   * describe different columns at that width — which is the one way this responsive approach can
   * corrupt the table's semantics, and it is invisible in a screenshot.
   */
  it("marks each optional column on its header and its cells alike", () => {
    const OPTIONAL = [
      "ad-col-type",
      "ad-col-subject",
      "ad-col-summary",
      "ad-col-grade",
      "ad-col-evidence",
      "ad-col-decisions",
      "ad-col-recorded",
    ];

    const page = queuePage();
    const headers = findTags(page, "th").filter((cell) => cell.props.scope === "col");
    const bodyCells = findTags(page, "td");
    const rows = findTags(page, "th").filter((cell) => cell.props.scope === "row").length;

    for (const column of OPTIONAL) {
      const marked = (cell: { props: { className?: unknown } }): boolean =>
        typeof cell.props.className === "string" &&
        cell.props.className.split(" ").includes(column);

      expect(headers.filter(marked), column).toHaveLength(1);
      expect(bodyCells.filter(marked), column).toHaveLength(rows);
    }
  });

  /**
   * WCAG 2.2 §2.1.1. A horizontally scrollable box that only a pointer can scroll is operable only
   * by pointer; `tabindex="0"` plus a name makes it a real stop in the tab order.
   *
   * The region still exists now that narrow widths hide columns instead of scrolling them: the
   * widest tier can still exceed its container by a few pixels on a long product name, and the
   * region is what makes those pixels reachable by keyboard rather than by pointer alone.
   */
  it("makes the scroll region a named, keyboard-reachable stop", () => {
    const region = findTags(queuePage(), "div").find((element) => element.props.role === "region");

    expect(region).toBeDefined();
    expect(region?.props.tabIndex).toBe(0);
    expect(region?.props["aria-label"]).toBe("Review queue, scrollable");
  });

  it("renders a machine-readable date alongside the human one", () => {
    const times = findTags(queuePage(), "time");

    expect(times).toHaveLength(2);
    expect(times[0]?.props.dateTime).toBe("2026-08-24T09:00:00.000Z");
  });
});

/* ========================================================================== */

describe("status and findings read without colour", () => {
  it("renders every status as its own words", () => {
    expect(visibleTextOf(<StatusBadge status="source_recorded" />)).toBe("Source recorded");
    expect(visibleTextOf(<StatusBadge status="needs_review" />)).toBe("Needs review");
    expect(visibleTextOf(<StatusBadge status="approved" />)).toBe("Approved");
    expect(visibleTextOf(<StatusBadge status="rejected" />)).toBe("Rejected");
    expect(visibleTextOf(<StatusBadge status="superseded" />)).toBe("Superseded");
  });

  it("states both findings outcomes, so absence is not conveyed by an empty cell", () => {
    const text = textOf(queuePage());

    expect(text).toContain("Unresolved finding");
    expect(text).toContain("No unresolved finding");
  });

  it("explains both catalogue statuses on the page rather than by convention", () => {
    const text = textOf(<StatusLegend total={1546} />);

    expect(text).toContain("Nobody has reviewed it yet");
    expect(text).toContain("importer detected a reason");
    expect(text).toContain("unapproved");
  });
});

/* ========================================================================== */

describe("filters", () => {
  it("names each filter group through its own visible label", () => {
    const navs = findTags(<ReviewFilters query={QUERY} />, "nav");

    expect(navs.length).toBe(5);
    for (const nav of navs) {
      expect(typeof nav.props["aria-labelledby"]).toBe("string");
    }
  });

  /**
   * Links all the way down — nothing needs script, and nothing needs a pointer.
   *
   * Every filter is a navigation, so the whole control set works before hydration, with the
   * keyboard, and with the back button. There is no button and no field: the one filter that would
   * have needed a field was the source reference, and it was removed rather than put in a URL.
   */
  it("needs neither script nor a pointer", () => {
    const filters = <ReviewFilters query={QUERY} />;

    expect(findTags(filters, "button")).toHaveLength(0);
    expect(findTags(filters, "form")).toHaveLength(0);

    for (const element of elementsOf(filters)) {
      expect(element.props.onClick).toBeUndefined();
      expect(element.props.onKeyDown).toBeUndefined();
      expect(element.props.onChange).toBeUndefined();
    }
  });

  it("marks the chosen value with aria-current, not only with a class", () => {
    const chosen = findLinks(
      <ReviewFilters query={{ ...QUERY, subjectType: "specification" }} />,
    ).filter((link) => link.props["aria-current"] === "true");

    expect(chosen.length).toBeGreaterThan(0);
  });

  it("hides the claim-kind group when specifications are the chosen subject", () => {
    const text = textOf(<ReviewFilters query={{ ...QUERY, subjectType: "specification" }} />);

    expect(text).not.toContain("Claim kind");
  });

  it("announces the active filters as text, not as pressed-looking chips", () => {
    const query: ReviewQueueQuery = { ...QUERY, subjectType: "specification" };
    const text = textOf(
      <ActiveFilterSummary
        query={query}
        filters={activeFilters(query, DESCRIBE_FILTER)}
        total={1398}
      />,
    );

    expect(text).toContain("Subject type");
    expect(text).toContain("Specifications");
  });

  it("gives each clear link a name that says what it clears", () => {
    const query: ReviewQueueQuery = { ...QUERY, subjectType: "specification" };
    const links = findLinks(
      <ActiveFilterSummary
        query={query}
        filters={activeFilters(query, DESCRIBE_FILTER)}
        total={1398}
      />,
    );

    const names = links.map((link) => accessibleName(link));
    expect(names.some((name) => name.includes("Remove the Subject type filter"))).toBe(true);
  });
});

/* ========================================================================== */

describe("pagination", () => {
  it("marks the current page for assistive technology, not only visually", () => {
    const current = findLinks(<ReviewPagination query={QUERY} page={3} pages={62} total={1546} />)
      .filter((link) => link.props["aria-current"] === "page")
      .map((link) => accessibleName(link));

    expect(current).toEqual(["Page 3"]);
  });

  it("renders unavailable steps as inert markup rather than as links that go nowhere", () => {
    const first = <ReviewPagination query={QUERY} page={1} pages={62} total={1546} />;
    const hrefs = findLinks(first).map((link) => String(link.props.href));

    expect(hrefs.some((href) => href.includes("page=0"))).toBe(false);
    expect(textOf(first)).toContain("Previous");
  });

  it("gives every numbered step a name a screen reader can use", () => {
    for (const link of findLinks(
      <ReviewPagination query={QUERY} page={3} pages={62} total={1546} />,
    )) {
      expect(accessibleName(link).length).toBeGreaterThan(0);
    }
  });
});

/* ========================================================================== */

describe("the whole page", () => {
  it("gives every link a non-empty accessible name", () => {
    for (const link of findLinks(queuePage())) {
      expect(accessibleName(link).length).toBeGreaterThan(0);
    }
  });

  it("has no clickable non-interactive element anywhere", () => {
    for (const element of elementsOf(queuePage())) {
      expect(element.props.onClick).toBeUndefined();
      expect(element.props.onKeyDown).toBeUndefined();
      expect(element.props.onMouseOver).toBeUndefined();
    }
  });

  it("takes focus from nobody — no autoFocus on this page", () => {
    for (const element of elementsOf(queuePage())) {
      expect(element.props.autoFocus).toBeUndefined();
    }
  });

  it("uses tabIndex only to make the scroll region reachable, and only as 0", () => {
    const indexed = elementsOf(queuePage())
      .map((element) => element.props.tabIndex)
      .filter((value) => value !== undefined);

    expect(indexed).toEqual([0]);
  });
});

/* ========================================================================== */

/**
 * `Source reference` — the internal import identity the Architect permitted on this surface.
 *
 * These pin the *presentation* constraints of that ruling. The boundary itself — that the column
 * appears in exactly three locations and nowhere else — is proved by `apps/api`'s
 * `source-ref-boundary.spec.ts`, which owns the allowlist and mutates a real public Product
 * component to show the guard still bites.
 */
describe("the source reference is internal metadata, not product content", () => {
  const rowWithRef = (): ReactNode => (
    <ReviewQueueTable items={[SPECIFICATION]} total={1} page={1} pages={1} query={QUERY} />
  );

  it("is labelled in full, so it cannot be read as a part number", () => {
    expect(visibleTextOf(rowWithRef())).toContain("Source reference HSB-001");
  });

  it("renders the value as plain text — never a link, never a button", () => {
    for (const link of findLinks(rowWithRef())) {
      expect(visibleTextOf(link.props.children as ReactNode)).not.toContain("HSB-001");
    }
    expect(findTags(rowWithRef(), "button")).toHaveLength(0);
  });

  it("offers no copy control and no clipboard affordance in this phase", () => {
    for (const element of elementsOf(rowWithRef())) {
      expect(element.props.onClick).toBeUndefined();
      expect(element.props["data-clipboard-text"]).toBeUndefined();
    }
    expect(visibleTextOf(rowWithRef()).toLowerCase()).not.toContain("copy");
  });

  it("stays subordinate to the product name", () => {
    const strong = findTags(rowWithRef(), "span").filter(
      (span) => span.props.className === "ad-cell-strong",
    );

    expect(strong).toHaveLength(1);
    expect(visibleTextOf(strong[0]?.props.children as ReactNode)).toBe("HSB 2000");
    // The reference is inside a `.ad-cell-sub` line, which is the cell's quiet register.
    const sub = findTags(rowWithRef(), "span").filter(
      (span) => span.props.className === "ad-cell-sub",
    );
    expect(
      sub.some((span) => visibleTextOf(span.props.children as ReactNode).includes("HSB-001")),
    ).toBe(true);
  });

  it("is never named a SKU, a supplier or a brand", () => {
    const text = visibleTextOf(queuePage()).toLowerCase();

    for (const word of ["sku", "supplier", "brand", "part number", "manufacturer"]) {
      expect(text).not.toContain(word);
    }
  });

  it("says nothing when the Product carries no reference", () => {
    const withoutRef: ReviewQueueItemResponse = {
      ...SPECIFICATION,
      product: { ...SPECIFICATION.product, sourceRef: null },
    };
    const text = visibleTextOf(
      <ReviewQueueTable items={[withoutRef]} total={1} page={1} pages={1} query={QUERY} />,
    );

    expect(text).not.toContain("Source reference");
  });

  /* ---------------------------------------------------------------- */
  /*  And it never travels                                              */
  /* ---------------------------------------------------------------- */

  /**
   * The Architect's final ruling: displayed, never in URL state. A URL is copied, bookmarked,
   * sent in a Referer, and written verbatim into a reverse-proxy access log — so keeping an
   * internal import identity out of every href is the whole of the protection.
   */
  it("puts the value in no link on the page", () => {
    for (const link of findLinks(queuePage())) {
      expect(String(link.props.href)).not.toContain("HSB-001");
      expect(String(link.props.href)).not.toContain("sourceRef");
    }
  });

  it("puts it in no pagination link either", () => {
    const pager = <ReviewPagination query={QUERY} page={3} pages={62} total={1546} />;

    for (const link of findLinks(pager)) {
      expect(String(link.props.href)).not.toContain("sourceRef");
    }
  });

  it("offers no filter control for it, and no form to put it in", () => {
    const filters = <ReviewFilters query={QUERY} />;

    expect(findTags(filters, "form")).toHaveLength(0);
    expect(findTags(filters, "input")).toHaveLength(0);
    expect(findTags(filters, "label")).toHaveLength(0);
    expect(visibleTextOf(filters)).not.toContain("Source reference");
  });

  /** Phase A must not advertise a capability it does not offer, even though the API has one. */
  it("does not suggest the queue can be filtered by it", () => {
    const text = visibleTextOf(queuePage()).toLowerCase();

    expect(text).not.toContain("filter by source");
    expect(text).not.toContain("search source");
  });

  it("keeps every rendered URL free of it, across the whole page", () => {
    const hrefs = findLinks(queuePage()).map((link) => String(link.props.href));

    expect(hrefs.length).toBeGreaterThan(0);
    expect(hrefs.join(" ")).not.toContain("sourceRef");
  });
});

/* ========================================================================== */

describe("AdminNav — Leads is unchanged and Technical Review is its sibling", () => {
  it("keeps the lead entries, their labels and their order", () => {
    const hrefs = findLinks(<AdminNav role="admin" />).map((link) => String(link.props.href));

    expect(hrefs).toEqual([
      "/admin",
      "/admin/leads/inquiries",
      "/admin/leads/custom-formulation-requests",
      "/admin/catalog/review",
    ]);
  });

  it("offers Technical Review to an Admin", () => {
    expect(textOf(<AdminNav role="admin" />)).toContain("Technical review");
  });

  it("hides Technical Review from a role that may not enter it, keeping the lead entries", () => {
    const hrefs = findLinks(<AdminNav role="content_manager" />).map((link) =>
      String(link.props.href),
    );

    expect(hrefs).toEqual(["/admin/leads/inquiries", "/admin/leads/custom-formulation-requests"]);
  });

  it("still renders nothing at all for a role no area admits", () => {
    expect(findTags(<AdminNav role="customer" />, "nav")).toHaveLength(0);
    expect(findLinks(<AdminNav role="customer" />)).toHaveLength(0);
  });

  it("marks only the area being viewed as current", () => {
    const current = findLinks(<AdminNav role="admin" current="catalog-review" />)
      .filter((link) => link.props["aria-current"] === "page")
      .map((link) => String(link.props.href));

    expect(current).toEqual(["/admin/catalog/review"]);
  });

  it("marks the lead inbox current exactly as it did before the move", () => {
    const current = findLinks(<AdminNav role="admin" current="inquiries" />)
      .filter((link) => link.props["aria-current"] === "page")
      .map((link) => String(link.props.href));

    expect(current).toEqual(["/admin/leads/inquiries"]);
  });
});

/* ========================================================================== */
/*  Phase B — the row's link into the detail screen                            */
/* ========================================================================== */

/**
 * Every queue row now ends in a link to that subject's detail route.
 *
 * The two things a table of twenty-five identical links gets wrong are both asserted here: that
 * each link is **named for what it opens** rather than "Review" twenty-five times (WCAG 2.2 §2.4.4),
 * and that each goes to the route matching its own subject type rather than to a single generic
 * one.
 */
describe("the queue links into the detail screens", () => {
  const table = (): ReactNode => (
    <ReviewQueueTable items={[SPECIFICATION, CLAIM]} total={2} page={1} pages={1} query={QUERY} />
  );

  it("sends a Specification row to the specifications route", () => {
    const href = findLinks(table())
      .map((link) => String(link.props.href))
      .find((candidate) => candidate.includes("/specifications/"));

    expect(href).toBe(`/admin/catalog/review/specifications/${SPECIFICATION.id}`);
  });

  it("sends a ProductClaim row to the product-claims route", () => {
    const href = findLinks(table())
      .map((link) => String(link.props.href))
      .find((candidate) => candidate.includes("/product-claims/"));

    expect(href).toBe(`/admin/catalog/review/product-claims/${CLAIM.id}`);
  });

  it("names each link by the product and what is under review", () => {
    const names = findLinks(table())
      .filter((link) => String(link.props.href).includes("/review/s"))
      .map((link) => String(link.props["aria-label"]));

    expect(names).toEqual(["Review Specification kinematic_viscosity_100c for HSB 2000"]);
  });

  it("gives the claim row a name that says it is a claim", () => {
    const name = findLinks(table())
      .filter((link) => String(link.props.href).includes("/product-claims/"))
      .map((link) => String(link.props["aria-label"]));

    expect(name).toEqual(["Review Product claim Reference only for HSB 2000"]);
  });

  it("carries the queue state forward so the reader can come back to it", () => {
    const filtered: ReviewQueueQuery = {
      page: 4,
      limit: DEFAULT_LIMIT,
      sort: DEFAULT_SORT,
      unresolvedFindings: true,
    };
    const href = findLinks(
      <ReviewQueueTable items={[SPECIFICATION]} total={1} page={4} pages={9} query={filtered} />,
    )
      .map((link) => String(link.props.href))
      .find((candidate) => candidate.includes("/specifications/"));

    expect(href).toContain("unresolvedFindings=true");
    expect(href).toContain("page=4");
  });

  /** The internal import identity is in none of them, filtered or not. */
  it("puts the source reference in no detail link", () => {
    for (const link of findLinks(table())) {
      expect(String(link.props.href)).not.toContain("HSB-001");
      expect(String(link.props.href)).not.toContain("sourceRef");
    }
  });

  /** Every link is an internal Admin path — no scheme, no protocol-relative authority. */
  it("emits only internal Admin paths", () => {
    for (const link of findLinks(table())) {
      const href = String(link.props.href);

      expect(href.startsWith("/admin/")).toBe(true);
      expect(href.startsWith("//")).toBe(false);
      expect(href).not.toMatch(/^https?:/);
    }
  });

  /** A header cell was added with the column, so the row and the header still agree. */
  it("keeps a column header for the new cell", () => {
    const headers = findTags(table(), "th")
      .filter((cell) => cell.props.scope === "col")
      .map((cell) => visibleTextOf(cell.props.children as ReactNode));

    expect(headers).toContain("Review");
    expect(headers).toHaveLength(10);
  });

  /**
   * One row, one link — at every width.
   *
   * The responsive tiers hide columns with CSS rather than rendering a second, narrow-screen copy
   * of each row. A duplicate representation is what would put the same subject in the tab order
   * twice and read it out twice, and `display: none` on a duplicate is a fix nobody remembers to
   * keep correct. This asserts the single-representation choice rather than the CSS.
   */
  it("renders exactly one detail link per row", () => {
    const rows = findTags(table(), "th").filter((cell) => cell.props.scope === "row").length;
    const links = findLinks(table());

    expect(rows).toBeGreaterThan(0);
    expect(links).toHaveLength(rows);
  });
});
