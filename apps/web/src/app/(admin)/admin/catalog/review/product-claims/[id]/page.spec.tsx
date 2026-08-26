import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { findLinks, findTags, textOf } from "@test/element-tree";

import ProductClaimReviewPage from "./page";

import type { ReactNode } from "react";

/**
 * `/admin/catalog/review/product-claims/[id]` — the sibling route.
 *
 * The Specification route's spec carries the full outcome matrix; both routes share one
 * implementation of every state, so repeating all of it here would assert the same components
 * twice. What is asserted here is what is **specific to this route**: that it reads the ProductClaim
 * endpoint and not the Specification one, that it renders the claim's legal classification without
 * upgrading it, that its failure states are the same seven and stay distinct, and that it cannot
 * write.
 */

const { readAdminSession, resolveAdminAccess, getAdminAccessToken } = vi.hoisted(() => ({
  readAdminSession: vi.fn(),
  resolveAdminAccess: vi.fn(),
  getAdminAccessToken: vi.fn(),
}));
const { getProductClaimReview, getSpecificationReview } = vi.hoisted(() => ({
  getProductClaimReview: vi.fn(),
  getSpecificationReview: vi.fn(),
}));
const { signOut } = vi.hoisted(() => ({ signOut: vi.fn() }));

vi.mock("@/features/admin/session/session", () => ({
  readAdminSession,
  resolveAdminAccess,
  getAdminAccessToken,
}));
vi.mock("@/features/admin/catalog/review/review-api", () => ({
  getProductClaimReview,
  getSpecificationReview,
}));
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
const ID = "22222222-2222-4222-8222-222222222222";

const SUBJECT = {
  subjectType: "product_claim" as const,
  id: ID,
  reviewStatus: "needs_review" as const,
  createdAt: "2026-08-24T10:00:00.000Z",
  deletedAt: null,
  product: {
    slug: "addilex-7",
    name: "Addilex 7",
    sourceRef: null,
    family: "additives",
    productType: null,
  },
  grade: null,
  specification: null,
  claim: {
    kind: "formulated_for" as const,
    standardBody: null,
    standardCode: "API CK-4",
    contextNote: null,
  },
  evidenceSetHash: "3".repeat(64),
  evidence: [],
  mappings: [],
  approvalBlockers: ["The claim cites no evidence."],
  eligibleForApproval: false,
  history: [],
};

function render(search: Record<string, string> = {}): Promise<ReactNode> {
  return ProductClaimReviewPage({
    params: Promise.resolve({ id: ID }),
    searchParams: Promise.resolve(search),
  });
}

beforeEach(() => {
  readAdminSession.mockResolvedValue({ state: "authenticated", user: ADMIN });
  resolveAdminAccess.mockReturnValue({ state: "authorized", user: ADMIN });
  getProductClaimReview.mockResolvedValue({ state: "ok", value: SUBJECT });
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
  });

  it("names the screen rather than the subject in its title", async () => {
    const module = await import("./page");

    expect(module.metadata.title).toBe("Product claim review · SAM Group Admin");
  });

  /** The two subject types never cross. This route reads one endpoint, and it is not the other. */
  it("reads the ProductClaim endpoint and never the Specification one", async () => {
    await render();

    expect(getProductClaimReview).toHaveBeenCalledExactlyOnceWith(ID);
    expect(getSpecificationReview).not.toHaveBeenCalled();
  });
});

describe("a claim that resolved", () => {
  it("renders the claim and its recorded classification", async () => {
    const text = textOf(await render());

    expect(text).toContain("Product claim review");
    expect(text).toContain("Addilex 7");
    expect(text).toContain("API CK-4");
    expect(text).toContain("Formulated for");
  });

  /** The single most important sentence on this screen. */
  it("says a formulated-for claim is not an approval", async () => {
    const text = textOf(await render());

    expect(text).toContain("additive target level");
    expect(text).toContain("not an approval");
  });

  it("lists the unresolved findings that block approval", async () => {
    const text = textOf(await render());

    expect(text).toContain("Cannot be approved as it stands");
    expect(text).toContain("The claim cites no evidence.");
  });

  it("states the empty review history rather than omitting it", async () => {
    const text = textOf(await render());

    expect(text).toContain("No decision has ever been recorded against this subject");
  });

  it("offers a back link that carries the queue state", async () => {
    const page = await render({ claimKind: "formulated_for", page: "2" });
    const back = findLinks(page).find((link) =>
      String(link.props.href).startsWith("/admin/catalog/review?"),
    );

    expect(back?.props.href).toBe("/admin/catalog/review?claimKind=formulated_for&page=2");
  });
});

describe("every way the request can fail", () => {
  it.each([
    ["not-found", "No review subject exists at this address"],
    ["invalid-id", "not one the platform recognises"],
    ["forbidden", "Access denied"],
    ["unavailable", "The platform did not answer"],
    ["failed", "something this screen cannot read"],
  ])("renders the %s state as its own sentence and shows no claim", async (state, sentence) => {
    getProductClaimReview.mockResolvedValue({ state });

    const text = textOf(await render());

    expect(text).toContain(sentence);
    expect(text).not.toContain("Formulated for");
    expect(text).not.toContain("Claim statement");
  });

  it("does not clear the session when the platform is unreachable", async () => {
    getProductClaimReview.mockResolvedValue({ state: "unavailable" });

    const text = textOf(await render());

    expect(text).toContain("admin@samgp.com");
    expect(text).toContain("You are still signed in");
  });

  it("hands an expired credential to the route that can clear cookies", async () => {
    getProductClaimReview.mockResolvedValue({ state: "unauthenticated" });

    await expect(render()).rejects.toThrow("NEXT_REDIRECT:/admin/session/end");
  });
});

describe("the page cannot change review state", () => {
  it("renders no form, field or button other than the shell's sign-out", async () => {
    const page = await render();

    expect(findTags(page, "form")).toHaveLength(1);
    expect(findTags(page, "button")).toHaveLength(1);
    expect(findTags(page, "input")).toHaveLength(0);
    expect(findTags(page, "select")).toHaveLength(0);
    expect(findTags(page, "textarea")).toHaveLength(0);
  });
});
