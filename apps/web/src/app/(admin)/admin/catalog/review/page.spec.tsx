import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { elementsOf, findLinks, findTags, textOf, visibleTextOf } from "@test/element-tree";

import CatalogReviewQueuePage from "./page";

import type { ReactNode } from "react";

/**
 * `/admin/catalog/review` — what it renders for each way the request can end, and what it never
 * renders.
 *
 * ## Distinctions, not pixels
 *
 * Nothing below asserts a class, a colour or a layout. What is asserted is that six outcomes stay
 * six outcomes, that a refusal is never a queue with no rows in it, and that a screen which cannot
 * write does not contain anything that looks like it can.
 */

const { readAdminSession, resolveAdminAccess, getAdminAccessToken } = vi.hoisted(() => ({
  readAdminSession: vi.fn(),
  resolveAdminAccess: vi.fn(),
  getAdminAccessToken: vi.fn(),
}));
const { getReviewQueue } = vi.hoisted(() => ({ getReviewQueue: vi.fn() }));
const { signOut } = vi.hoisted(() => ({ signOut: vi.fn() }));

vi.mock("@/features/admin/session/session", () => ({
  readAdminSession,
  resolveAdminAccess,
  getAdminAccessToken,
}));
vi.mock("@/features/admin/catalog/review/review-api", () => ({ getReviewQueue }));
vi.mock("@/features/admin/actions", () => ({ signOut }));

class RedirectSignal extends Error {
  constructor(readonly to: string) {
    super(`NEXT_REDIRECT:${to}`);
  }
}

vi.mock("next/navigation", () => ({
  redirect: (to: string) => {
    throw new RedirectSignal(to);
  },
}));

const ADMIN = { id: "u1", email: "admin@samgp.com", role: "admin" };
const CONTENT_MANAGER = { id: "u2", email: "editor@samgp.com", role: "content_manager" };

const SPECIFICATION = {
  subjectType: "specification" as const,
  id: "11111111-1111-4111-8111-111111111111",
  reviewStatus: "source_recorded" as const,
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
  summary: "kinematic_viscosity_100c 11.5 mm2/s",
  evidenceCount: 1,
  hasUnresolvedFindings: false,
  reviewCount: 0,
};

const CLAIM = {
  subjectType: "product_claim" as const,
  id: "22222222-2222-4222-8222-222222222222",
  reviewStatus: "needs_review" as const,
  createdAt: "2026-08-24T10:00:00.000Z",
  product: {
    slug: "addilex-7",
    name: "Addilex 7",
    sourceRef: null,
    family: "lubricant-additives",
    productType: null,
  },
  grade: { id: "g1", label: "SAE 40", gradeSystem: "sae" },
  propertyKey: null,
  claimKind: "reference_only" as const,
  summary: "reference_only API CK-4",
  evidenceCount: 2,
  hasUnresolvedFindings: true,
  reviewCount: 0,
};

const okQueue = (
  items: unknown[] = [SPECIFICATION, CLAIM],
  window: { total?: number; page?: number; limit?: number } = {},
): Record<string, unknown> => ({
  state: "ok",
  value: { items, total: window.total ?? 1546, page: window.page ?? 1, limit: window.limit ?? 25 },
});

async function render(searchParams: Record<string, string | string[]> = {}): Promise<ReactNode> {
  return CatalogReviewQueuePage({ searchParams: Promise.resolve(searchParams) });
}

async function redirectFrom(searchParams: Record<string, string> = {}): Promise<string> {
  try {
    await render(searchParams);
  } catch (error) {
    if (error instanceof RedirectSignal) return error.to;
    throw error;
  }
  throw new Error("expected a redirect");
}

beforeEach(() => {
  readAdminSession.mockResolvedValue({ state: "authenticated", user: ADMIN });
  resolveAdminAccess.mockReturnValue({ state: "authorized", user: ADMIN });
  getReviewQueue.mockResolvedValue(okQueue());
});

afterEach(() => {
  vi.resetAllMocks();
});

/* ========================================================================== */

describe("route protection", () => {
  it("sends an anonymous reader to sign in", async () => {
    readAdminSession.mockResolvedValue({ state: "anonymous" });

    await expect(redirectFrom()).resolves.toBe("/login");
  });

  it("sends an expired session to the route that clears its cookies", async () => {
    readAdminSession.mockResolvedValue({ state: "expired" });

    await expect(redirectFrom()).resolves.toBe("/admin/session/end");
  });

  it("asks for the review area, not the shell — they are separate entry rules", async () => {
    await render();

    expect(resolveAdminAccess).toHaveBeenCalledWith(expect.anything(), "review");
  });

  it("refuses a non-Admin role without ever requesting the queue", async () => {
    resolveAdminAccess.mockReturnValue({ state: "forbidden", user: CONTENT_MANAGER });

    const page = await render();

    expect(textOf(page)).toContain("Access denied");
    expect(getReviewQueue).not.toHaveBeenCalled();
  });

  /** A refusal is not "no work to do". The two must never render the same. */
  it("does not render a refusal as an empty queue", async () => {
    resolveAdminAccess.mockReturnValue({ state: "forbidden", user: CONTENT_MANAGER });

    const text = visibleTextOf(await render());

    expect(text).toContain("Access denied");
    expect(text).not.toContain("No review subjects");
  });

  it("keeps the session when the platform cannot confirm it", async () => {
    resolveAdminAccess.mockReturnValue({ state: "unavailable" });

    const text = visibleTextOf(await render());

    expect(text).toContain("Temporarily unavailable");
    expect(text).toContain("not been signed out");
    expect(getReviewQueue).not.toHaveBeenCalled();
  });

  it("hands a cookie that vanished mid-request back to the session route", async () => {
    getReviewQueue.mockResolvedValue({ state: "unauthenticated" });

    await expect(redirectFrom()).resolves.toBe("/admin/session/end");
  });
});

/* ========================================================================== */

describe("the default request", () => {
  /** Ratified decision D8 — the queue opens on all 1,546, not on the 130 flagged rows. */
  it("asks for no status filter, so every unapproved subject is in scope", async () => {
    await render();

    expect(getReviewQueue).toHaveBeenCalledWith({ page: 1, limit: 25, sort: "-createdAt" });
  });

  it("states the total it was given, and calls them unapproved", async () => {
    const text = visibleTextOf(await render());

    expect(text).toContain("1546");
    expect(text).toContain("unapproved");
  });

  it("says no filter is applied when none is", async () => {
    expect(visibleTextOf(await render())).toContain("No filter is applied");
  });

  /**
   * The Review API does accept an exact `sourceRef` filter. Phase A does not use it: the Architect
   * ruled the column may be displayed inside the authenticated UI and may never enter URL state, and
   * a query parameter is URL state. So a hand-written `?sourceRef=` is treated as a key this page
   * does not own — dropped silently, never forwarded, never echoed back.
   */
  it("never forwards a source reference, even when the address carries one", async () => {
    await render({ sourceRef: "HSB-001" });

    expect(getReviewQueue).toHaveBeenCalledWith({ page: 1, limit: 25, sort: "-createdAt" });
  });

  /**
   * A distinct probe value, not the one the fixture row carries: the row is *supposed* to print
   * its own reference, and asserting on the same string could not tell a legitimate render from an
   * echoed query parameter.
   */
  it("does not echo a hand-written source reference back into the page", async () => {
    const text = visibleTextOf(await render({ sourceRef: "SHOULD-NOT-APPEAR" }));

    expect(text).not.toContain("SHOULD-NOT-APPEAR");
    // ...and it is not reported as a rejected parameter either — it is simply not a filter here.
    expect(text).not.toContain("not applied");
  });

  it("keeps it out of every link it renders, including pagination", async () => {
    getReviewQueue.mockResolvedValue(okQueue([SPECIFICATION], { total: 200, page: 2 }));

    const hrefs = findLinks(await render({ sourceRef: "HSB-001", page: "2" })).map((link) =>
      String(link.props.href),
    );

    expect(hrefs.length).toBeGreaterThan(0);
    expect(hrefs.join(" ")).not.toContain("sourceRef");
    expect(hrefs.join(" ")).not.toContain("HSB-001");
  });

  it("shows the source reference on a row that has one, labelled", async () => {
    expect(visibleTextOf(await render())).toContain("Source reference HSB-001");
  });

  it("forwards a supported filter as the API spells it", async () => {
    await render({ subjectType: "product_claim", unresolvedFindings: "true", page: "3" });

    expect(getReviewQueue).toHaveBeenCalledWith({
      page: 3,
      limit: 25,
      sort: "-createdAt",
      subjectType: "product_claim",
      unresolvedFindings: true,
    });
  });

  it("never forwards a value outside the API's vocabulary", async () => {
    await render({ reviewStatus: "pending" });

    expect(getReviewQueue).toHaveBeenCalledWith({ page: 1, limit: 25, sort: "-createdAt" });
  });

  it("tells the reader which part of the address was not applied", async () => {
    const text = visibleTextOf(await render({ reviewStatus: "pending" }));

    expect(text).toContain("not applied");
    expect(text).toContain("reviewStatus");
  });
});

/* ========================================================================== */

describe("the queue as rendered", () => {
  it("names both subject types by their labels, not their wire values", async () => {
    const text = visibleTextOf(await render());

    expect(text).toContain("Specification");
    expect(text).toContain("Product claim");
  });

  it("renders SOURCE_RECORDED as words and explains what it means", async () => {
    const text = visibleTextOf(await render());

    expect(text).toContain("Source recorded");
    expect(text).toContain("Nobody has reviewed it yet");
  });

  it("renders NEEDS_REVIEW as words and explains what it means", async () => {
    const text = visibleTextOf(await render());

    expect(text).toContain("Needs review");
    expect(text).toContain("The importer detected a reason this row needs attention");
  });

  it("never presents NEEDS_REVIEW as the backlog on its own", async () => {
    const text = visibleTextOf(await render());

    expect(text).toContain("Every subject below is");
    expect(text).toContain("The queue opens on all of it rather than on one status");
  });

  it("states both findings outcomes in words", async () => {
    const text = visibleTextOf(await render());

    expect(text).toContain("Unresolved finding");
    expect(text).toContain("No unresolved finding");
  });

  it("shows the product identity, the grade when there is one, and says so when there is not", async () => {
    const text = visibleTextOf(await render());

    expect(text).toContain("HSB 2000");
    expect(text).toContain("hsb-2000");
    expect(text).toContain("SAE 40");
    expect(text).toContain("No grade");
  });

  it("marks a claim kind that can never be approved", async () => {
    expect(visibleTextOf(await render())).toContain("Never approvable");
  });

  it("renders the DTO summary rather than reconstructing one", async () => {
    expect(visibleTextOf(await render())).toContain("kinematic_viscosity_100c 11.5 mm2/s");
  });

  /**
   * Nothing in the catalogue is approved, and no *row* may suggest otherwise.
   *
   * The word does appear on the page, in the review-status filter and in the `approved_by` claim
   * kind. Both are accurate: the queue contract supports five statuses and eight kinds, and hiding
   * two of them would misdescribe the contract. What must never happen is a subject being presented
   * as approved, so that is what is asserted — against the badges, not against the prose.
   */
  it("presents no subject as approved, while still offering the status as a filter", async () => {
    const page = await render();
    const badges = elementsOf(page).filter(
      (element) =>
        typeof element.props.className === "string" &&
        element.props.className.startsWith("ad-badge"),
    );

    expect(badges.length).toBeGreaterThan(0);
    for (const badge of badges) {
      expect(visibleTextOf(badge.props.children as ReactNode)).not.toBe("Approved");
    }

    const text = visibleTextOf(page);
    expect(text).toContain("none of it is published");
    expect(text).toContain("Every subject below is unapproved");
  });
});

/* ========================================================================== */

describe("the empty state", () => {
  it("names the active filters, because at 1,546 rows the filter is always the reason", async () => {
    getReviewQueue.mockResolvedValue(okQueue([], { total: 0 }));

    const text = visibleTextOf(
      await render({ subjectType: "specification", unresolvedFindings: "true" }),
    );

    expect(text).toContain("No subjects match these filters");
    expect(text).toContain("Specifications");
    expect(text).toContain("Unresolved finding");
    expect(text).toContain("Clear all filters");
  });

  it("says plainly that nothing was filtered out when nothing was", async () => {
    getReviewQueue.mockResolvedValue(okQueue([], { total: 0 }));

    const text = visibleTextOf(await render());

    expect(text).toContain("No review subjects");
    expect(text).toContain("this is the whole queue");
  });
});

/* ========================================================================== */

describe("the failure states stay distinct", () => {
  it("renders an outage as an outage, not as zero results", async () => {
    getReviewQueue.mockResolvedValue({ state: "unavailable" });

    const text = visibleTextOf(await render());

    expect(text).toContain("Temporarily unavailable");
    expect(text).not.toContain("No review subjects");
  });

  it("renders a refusal from the API as a refusal", async () => {
    getReviewQueue.mockResolvedValue({ state: "forbidden" });

    expect(visibleTextOf(await render())).toContain("Access denied");
  });

  it("renders a refused filter as a refused filter, not as an outage", async () => {
    getReviewQueue.mockResolvedValue({ state: "invalid-query", field: "limit" });

    const text = visibleTextOf(await render());

    expect(text).toContain("That filter was refused");
    expect(text).toContain("limit");
    expect(text).not.toContain("not responding");
  });

  it("renders an unreadable answer as its own thing", async () => {
    getReviewQueue.mockResolvedValue({ state: "failed" });

    const text = visibleTextOf(await render());

    expect(text).toContain("could not be read");
    expect(text).not.toContain("not responding");
  });

  it("renders no table in any failure state", async () => {
    for (const state of [
      { state: "unavailable" },
      { state: "forbidden" },
      { state: "failed" },
      { state: "invalid-query", field: null },
    ]) {
      getReviewQueue.mockResolvedValue(state);
      expect(findTags(await render(), "table")).toHaveLength(0);
    }
  });
});

/* ========================================================================== */

describe("nothing on this page can write", () => {
  /**
   * One button, and it is the Admin shell's sign-out. No decision control exists — not an enabled
   * one and not a disabled one, because a greyed-out "Approve" is a promise this screen cannot
   * keep: the decision endpoint needs an evidence-set hash only the unbuilt detail route carries.
   */
  /**
   * One button on the whole page, and it is the shell's sign-out. Every review control is a link.
   */
  it("renders exactly one button, and it is sign out", async () => {
    const buttons = findTags(await render(), "button");

    expect(buttons).toHaveLength(1);
    expect(textOf(buttons[0]?.props.children as ReactNode)).toBe("Sign out");
    expect(buttons[0]?.props.type).toBe("submit");
  });

  /**
   * A decision would have to be a form bound to a Server Action. There is exactly one form on the
   * page — the shell's sign-out — and the review feature contributes none at all.
   *
   * Asserted structurally rather than by scanning for the word "approve", which legitimately occurs
   * in "unapproved", "approved_by" and "Never approvable" — a text scan here would either fail on
   * correct wording or have to be weakened until it caught nothing.
   */
  it("renders exactly one form, and it is sign-out", async () => {
    const forms = findTags(await render(), "form");

    expect(forms).toHaveLength(1);
    expect(forms[0]?.props.action).toBe(signOut);
  });

  it("offers no control whose accessible name is a decision", async () => {
    const page = await render();
    const names = [
      ...findLinks(page).map((link) => visibleTextOf(link.props.children as ReactNode)),
      ...findTags(page, "button").map((button) =>
        visibleTextOf(button.props.children as ReactNode),
      ),
    ].map((name) => name.toLowerCase().trim());

    for (const decision of ["approve", "reject", "supersede", "return to needs review"]) {
      expect(names).not.toContain(decision);
    }
  });

  /**
   * Phase B built the two detail routes, so the rows now link at them.
   *
   * This test previously asserted the opposite — that nothing linked at an unbuilt route — and it
   * is amended rather than deleted, because the property that actually matters is unchanged and is
   * what it now checks: **every link on this page is a read**. A detail route is a page; the
   * decision sub-collection is not a page and is still named nowhere.
   */
  it("links only at the two detail routes, and never at the decision endpoint", async () => {
    const hrefs = findLinks(await render()).map((link) => String(link.props.href));
    const subjectLinks = hrefs.filter(
      (href) => href.includes("/specifications/") || href.includes("/product-claims/"),
    );

    expect(subjectLinks).toEqual([
      `/admin/catalog/review/specifications/${SPECIFICATION.id}`,
      `/admin/catalog/review/product-claims/${CLAIM.id}`,
    ]);

    for (const href of hrefs) {
      expect(href).not.toContain("/decisions");
      // `/admin` itself is the dashboard entry in the module navigation, so the prefix has no
      // trailing separator.
      expect(href.startsWith("/admin")).toBe(true);
    }
  });

  /**
   * A subject id belongs in a detail path and nowhere else — not in a query parameter, and above
   * all not carrying the Product's internal import identity alongside it.
   */
  it("puts a subject id only in its own detail path", async () => {
    const hrefs = findLinks(await render()).map((link) => String(link.props.href));

    for (const href of hrefs) {
      for (const id of [SPECIFICATION.id, CLAIM.id]) {
        if (!href.includes(id)) continue;

        expect(href.endsWith(`/${id}`) || href.includes(`/${id}?`)).toBe(true);
        expect(href).not.toContain(`=${id}`);
      }

      expect(href).not.toContain("HSB-001");
      expect(href).not.toContain("sourceRef");
    }
  });
});

/* ========================================================================== */

describe("pagination", () => {
  it("carries every active filter and the ordering into each page link", async () => {
    getReviewQueue.mockResolvedValue(okQueue([SPECIFICATION], { total: 200, page: 2 }));

    const hrefs = findLinks(
      await render({ subjectType: "specification", sort: "updatedAt", page: "2" }),
    )
      .map((link) => String(link.props.href))
      .filter((href) => href.includes("page="));

    expect(hrefs.length).toBeGreaterThan(0);
    for (const href of hrefs) {
      expect(href).toContain("subjectType=specification");
      expect(href).toContain("sort=updatedAt");
    }
  });

  it("resets to page 1 when a filter chip is followed from a later page", async () => {
    getReviewQueue.mockResolvedValue(okQueue([SPECIFICATION], { total: 1546, page: 9 }));

    const hrefs = findLinks(await render({ page: "9" })).map((link) => String(link.props.href));

    expect(hrefs).toContain("/admin/catalog/review?unresolvedFindings=true");
  });

  it("reports the window in words as well as in links", async () => {
    getReviewQueue.mockResolvedValue(okQueue([SPECIFICATION], { total: 1546, page: 2 }));

    expect(visibleTextOf(await render({ page: "2" }))).toContain("page 2 of 62");
  });
});
