import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { elementsOf, findLinks, findTags, textOf } from "@test/element-tree";

import SpecificationReviewPage from "./page";

import type { ReactNode } from "react";

/**
 * `/admin/catalog/review/specifications/[id]` — what it renders for each way the request can end,
 * and what it never renders.
 *
 * ## Distinctions, not pixels
 *
 * Nothing below asserts a class, a colour or a layout. What is asserted is that seven outcomes stay
 * seven outcomes, that a missing subject is never an empty page of panels, that an outage never
 * reads as a sign-out or as a missing subject, and that a screen which cannot write contains
 * nothing that looks like it can.
 *
 * ## No credential, no session, no request
 *
 * The session boundary and the BFF are both mocked. No password is used, no session is created, no
 * request leaves the process, and no database is touched.
 */

const { readAdminSession, resolveAdminAccess, getAdminAccessToken } = vi.hoisted(() => ({
  readAdminSession: vi.fn(),
  resolveAdminAccess: vi.fn(),
  getAdminAccessToken: vi.fn(),
}));
const { getSpecificationReview } = vi.hoisted(() => ({ getSpecificationReview: vi.fn() }));
const { signOut } = vi.hoisted(() => ({ signOut: vi.fn() }));

vi.mock("@/features/admin/session/session", () => ({
  readAdminSession,
  resolveAdminAccess,
  getAdminAccessToken,
}));
vi.mock("@/features/admin/catalog/review/review-api", () => ({ getSpecificationReview }));
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
const ID = "11111111-1111-4111-8111-111111111111";

const SUBJECT = {
  subjectType: "specification" as const,
  id: ID,
  reviewStatus: "source_recorded" as const,
  createdAt: "2026-08-24T09:00:00.000Z",
  deletedAt: null,
  product: {
    slug: "hsb-2000",
    name: "HSB 2000",
    sourceRef: "HSB-001",
    family: "industrial-oils-lubricants",
    productType: null,
  },
  grade: null,
  specification: {
    propertyKey: "kinematic_viscosity_100c",
    displayValue: "11.5",
    valueType: "point" as const,
    numericMin: "11.500000",
    numericMax: null,
    pairFirst: null,
    pairSecond: null,
    unit: "mm2/s",
    method: "ASTM D445",
    qualifier: null,
    resultBasis: "typical" as const,
    valueKind: "numeric" as const,
    methodRequirement: "required" as const,
  },
  claim: null,
  evidenceSetHash: "2".repeat(64),
  evidence: [],
  mappings: [],
  approvalBlockers: [],
  eligibleForApproval: true,
  warnings: [],
  history: [],
};

function render(search: Record<string, string> = {}, id: string = ID): Promise<ReactNode> {
  return SpecificationReviewPage({
    params: Promise.resolve({ id }),
    searchParams: Promise.resolve(search),
  });
}

beforeEach(() => {
  readAdminSession.mockResolvedValue({ state: "authenticated", user: ADMIN });
  resolveAdminAccess.mockReturnValue({ state: "authorized", user: ADMIN });
  getSpecificationReview.mockResolvedValue({ state: "ok", value: SUBJECT });
});

afterEach(() => {
  vi.resetAllMocks();
  vi.restoreAllMocks();
});

describe("the route contract", () => {
  it("is dynamic, uncached, and offers the build nothing to prerender", async () => {
    const module = await import("./page");

    expect(module.dynamic).toBe("force-dynamic");
    expect(module.revalidate).toBe(0);
    expect("generateStaticParams" in module).toBe(false);
    expect("generateMetadata" in module).toBe(false);
  });

  it("names the screen rather than the subject in its title", async () => {
    const module = await import("./page");

    expect(module.metadata.title).toBe("Specification review · SAM Group Admin");
    expect(module.metadata.title).not.toContain(ID);
  });

  it("checks access for the review area before requesting anything", async () => {
    await render();

    expect(resolveAdminAccess).toHaveBeenCalledWith(
      { state: "authenticated", user: ADMIN },
      "review",
    );
  });

  it("passes the id from the path to the read, and nothing else", async () => {
    await render({ page: "3" });

    expect(getSpecificationReview).toHaveBeenCalledExactlyOnceWith(ID);
  });
});

describe("a subject that resolved", () => {
  it("renders the subject inside the Admin shell", async () => {
    const text = textOf(await render());

    expect(text).toContain("Specification review");
    expect(text).toContain("HSB 2000");
    expect(text).toContain("kinematic_viscosity_100c");
    expect(text).toContain("admin@samgp.com");
  });

  it("offers a back link to the queue in the state it was left", async () => {
    const page = await render({ page: "3", subjectType: "specification" });
    const links = findLinks(page);
    const back = links.find((link) => String(link.props.href).startsWith("/admin/catalog/review?"));

    expect(back?.props.href).toBe("/admin/catalog/review?subjectType=specification&page=3");
  });

  /**
   * A hand-edited or drifted parameter is dropped by the same validator the queue uses, so the back
   * link stays a link to the queue rather than becoming a link to whatever the URL said.
   */
  it("drops an unusable queue parameter rather than forwarding it", async () => {
    const page = await render({ subjectType: "not-a-subject-type", page: "3" });
    // The module navigation also links at `/admin/catalog/review`; the back link is the one that
    // carries the queue state, so it is the one with a query string.
    const back = findLinks(page).find((link) =>
      String(link.props.href).startsWith("/admin/catalog/review?"),
    );

    expect(back?.props.href).toBe("/admin/catalog/review?page=3");
  });

  /** No parameter names the back link's destination, so none can move it off the Admin surface. */
  it("refuses to be redirected by a hostile parameter", async () => {
    const page = await render({
      returnTo: "https://evil.invalid",
      next: "//evil.invalid",
      page: "2",
    });

    for (const link of findLinks(page)) {
      const href = String(link.props.href);

      expect(href.startsWith("/")).toBe(true);
      expect(href.startsWith("//")).toBe(false);
      expect(href).not.toContain("evil.invalid");
    }
  });

  /** The source reference is shown on the page and is in no URL the page emits. */
  it("shows the source reference without putting it in any link", async () => {
    const page = await render();

    expect(textOf(page)).toContain("HSB-001");

    for (const link of findLinks(page)) {
      expect(String(link.props.href)).not.toContain("HSB-001");
      expect(String(link.props.href)).not.toContain("sourceRef");
    }
  });
});

describe("every way the request can fail", () => {
  it.each([
    ["not-found", "No review subject exists at this address"],
    ["invalid-id", "not one the platform recognises"],
    ["forbidden", "Access denied"],
    ["unavailable", "The platform did not answer"],
    ["failed", "something this screen cannot read"],
  ])("renders the %s state as its own sentence", async (state, sentence) => {
    getSpecificationReview.mockResolvedValue({ state });

    const text = textOf(await render());

    expect(text).toContain(sentence);
    // Never a subject, and never an empty page of panels standing in for one.
    expect(text).not.toContain("kinematic_viscosity_100c");
    expect(text).not.toContain("Reviewed technical value");
  });

  it("keeps a missing subject and an outage saying different things", async () => {
    getSpecificationReview.mockResolvedValue({ state: "not-found" });
    const missing = textOf(await render());

    getSpecificationReview.mockResolvedValue({ state: "unavailable" });
    const outage = textOf(await render());

    expect(missing).not.toBe(outage);
    expect(outage).toContain("You are still signed in");
    expect(missing).not.toContain("You are still signed in");
  });

  /** An API outage is not a sign-out: the shell, the identity and the navigation all survive it. */
  it("does not clear the session when the platform is unreachable", async () => {
    getSpecificationReview.mockResolvedValue({ state: "unavailable" });

    const text = textOf(await render());

    expect(text).toContain("admin@samgp.com");
    expect(text).toContain("Sign out");
  });

  it("hands an expired credential to the route that can clear cookies", async () => {
    getSpecificationReview.mockResolvedValue({ state: "unauthenticated" });

    await expect(render()).rejects.toThrow("NEXT_REDIRECT:/admin/session/end");
  });

  it("refuses a role that may not enter the review area, and shows no subject", async () => {
    resolveAdminAccess.mockReturnValue({ state: "forbidden", user: CONTENT_MANAGER });

    const text = textOf(await render());

    expect(text).toContain("Access denied");
    expect(getSpecificationReview).not.toHaveBeenCalled();
  });

  /** The session itself could not be confirmed. No identity is invented for the bar. */
  it("renders the unavailable state with no identity when the session cannot be confirmed", async () => {
    resolveAdminAccess.mockReturnValue({ state: "unavailable" });

    const text = textOf(await render());

    expect(text).toContain("temporarily unavailable");
    expect(text).not.toContain("admin@samgp.com");
    expect(getSpecificationReview).not.toHaveBeenCalled();
  });

  it("exposes no status code, endpoint or backend message in any failure state", async () => {
    for (const state of ["not-found", "invalid-id", "forbidden", "unavailable", "failed"]) {
      getSpecificationReview.mockResolvedValue({ state });

      const text = textOf(await render());

      expect(text).not.toMatch(/\b(400|401|403|404|409|500|503)\b/);
      expect(text).not.toContain("/api/v1");
      expect(text).not.toContain("Bearer");
    }
  });
});

describe("the page cannot change review state", () => {
  it("renders no form, field or button other than the shell's sign-out", async () => {
    const page = await render();
    const forms = findTags(page, "form");
    const buttons = findTags(page, "button");

    // Exactly one of each, and both belong to `AdminShell`'s sign-out control.
    expect(forms).toHaveLength(1);
    expect(buttons).toHaveLength(1);
    expect(textOf(buttons[0]?.props.children as ReactNode)).toContain("Sign out");

    expect(findTags(page, "input")).toHaveLength(0);
    expect(findTags(page, "select")).toHaveLength(0);
    expect(findTags(page, "textarea")).toHaveLength(0);
  });

  it("carries no event handler and no disabled control anywhere", async () => {
    const elements = elementsOf(await render());

    for (const element of elements) {
      expect(Object.keys(element.props).some((name) => /^on[A-Z]/.test(name))).toBe(false);
      expect(element.props.disabled).toBeUndefined();
    }
  });
});
