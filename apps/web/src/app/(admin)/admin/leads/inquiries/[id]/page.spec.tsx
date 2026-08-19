import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { textOf } from "@test/element-tree";

import AdminInquiryDetailPage from "./page";

import type { ReactNode } from "react";

/**
 * `/admin/leads/inquiries/[id]` — and above all, that a missing record and a broken platform are
 * two different pages.
 *
 * ADR-010 §7 fixes "infrastructure failure must never become a canonical 404" for public content.
 * A lead exists exactly once and nobody else is looking for it, so the cost of getting this wrong
 * is higher here: an operator told that a submission does not exist stops chasing it.
 */

const { readAdminSession, resolveAdminAccess, getAdminAccessToken, getLeadHistory } = vi.hoisted(
  () => ({
    readAdminSession: vi.fn(),
    resolveAdminAccess: vi.fn(),
    getAdminAccessToken: vi.fn(),
    getLeadHistory: vi.fn(),
  }),
);
const { getAdminInquiry } = vi.hoisted(() => ({ getAdminInquiry: vi.fn() }));
const { signOut } = vi.hoisted(() => ({ signOut: vi.fn() }));

vi.mock("@/features/admin/session/session", () => ({
  readAdminSession,
  resolveAdminAccess,
  getAdminAccessToken,
}));
vi.mock("@/features/admin/leads/leads-api", () => ({ getAdminInquiry, getLeadHistory }));
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
const ID = "11111111-1111-4111-8111-111111111111";

const DETAIL = {
  id: ID,
  createdAt: "2026-08-19T09:30:00.000Z",
  inquiryType: "request_a_quote" as const,
  firstName: "Ada",
  lastName: "Lovelace",
  companyName: "Analytical Engines Ltd",
  country: "United Kingdom",
  email: "ada@example.com",
  relatedProductId: null,
  status: "new",
  assigneeId: null,
  phone: null,
  industry: "Manufacturing",
  productsOfInterest: ["Base oils"],
  requiredQuantity: "20 t",
  destinationCountryPort: null,
  preferredIncoterm: "FOB",
  message: "Please quote for twenty tonnes.",
  consentGiven: true,
  privacyPolicyVersion: null,
};

async function render(id = ID): Promise<ReactNode> {
  return AdminInquiryDetailPage({ params: Promise.resolve({ id }) });
}

beforeEach(() => {
  /*
   * The Workflow panel's two reads. A null token is the "no assignee directory" path — the panel
   * still renders — and an empty history is the normal state of a lead nobody has touched.
   */
  getAdminAccessToken.mockResolvedValue(null);
  getLeadHistory.mockResolvedValue({ state: "ok", value: [] });
  readAdminSession.mockResolvedValue({ state: "authenticated", user: ADMIN });
  resolveAdminAccess.mockReturnValue({ state: "authorized", user: ADMIN });
  getAdminInquiry.mockResolvedValue({ state: "ok", value: DETAIL });
});

afterEach(() => {
  vi.resetAllMocks();
});

describe("the record", () => {
  it("asks for the id in the route and renders the submission", async () => {
    const text = textOf(await render());

    expect(getAdminInquiry).toHaveBeenCalledWith(ID);
    expect(text).toContain("Ada Lovelace");
    expect(text).toContain("Please quote for twenty tonnes.");
    expect(text).toContain("Request a quote");
  });

  it("groups the fields rather than listing twenty of them", async () => {
    const text = textOf(await render());

    for (const group of ["Submission", "Contact", "Company", "Request", "Consent"]) {
      expect(text).toContain(group);
    }
  });

  /** A blank next to "Phone" reads as a rendering fault; "Not provided" reads as the truth. */
  it("marks an omitted optional field as absent rather than blank", async () => {
    const text = textOf(await render());

    expect(text).toContain("Not provided");
  });

  /**
   * Consent evidence is operational: it is the only record of which policy text this person agreed
   * to, and `null` — no versioned policy in force — is the honest answer for every row written so
   * far, not a value to hide.
   */
  it("shows the consent evidence, including that no policy revision was in force", async () => {
    const text = textOf(await render());

    expect(text).toContain("Consent given");
    expect(text).toContain("None in force at submission");
  });
});

describe("the four failures stay four failures", () => {
  it("renders an authoritative 404 as a real not-found, with a way back", async () => {
    getAdminInquiry.mockResolvedValue({ state: "not-found" });

    const text = textOf(await render());

    expect(text).toContain("Not found");
    expect(text).toContain("/admin/leads/inquiries");
    expect(text).not.toContain("Temporarily unavailable");
  });

  /** The assertion this route exists to protect. An outage is not a missing lead. */
  it("renders an outage as unavailable, never as not-found", async () => {
    getAdminInquiry.mockResolvedValue({ state: "unavailable" });

    const text = textOf(await render());

    expect(text).toContain("Temporarily unavailable");
    expect(text).not.toContain("Not found");
  });

  it("renders an authoritative 403 as access denied", async () => {
    getAdminInquiry.mockResolvedValue({ state: "forbidden" });

    const text = textOf(await render());

    expect(text).toContain("Access denied");
    expect(text).not.toContain("Not found");
  });

  it("sends an API 401 to the session-end handler", async () => {
    getAdminInquiry.mockResolvedValue({ state: "unauthenticated" });

    await expect(render()).rejects.toThrow("NEXT_REDIRECT:/admin/session/end");
  });

  it("sends an anonymous caller to login without reading anything", async () => {
    readAdminSession.mockResolvedValue({ state: "anonymous" });

    await expect(render()).rejects.toThrow("NEXT_REDIRECT:/login");
    expect(getAdminInquiry).not.toHaveBeenCalled();
  });

  it("does not read a record for a role the shell refuses", async () => {
    resolveAdminAccess.mockReturnValue({
      state: "forbidden",
      user: { ...ADMIN, role: "sales_expert" },
    });

    expect(textOf(await render())).toContain("Access denied");
    expect(getAdminInquiry).not.toHaveBeenCalled();
  });
});

describe("nothing about the credential reaches the render", () => {
  it("puts no token, cookie name or API origin in the tree", async () => {
    const tree = await render();
    const text = textOf(tree);
    const serialized = JSON.stringify(tree, (_key, value: unknown) =>
      typeof value === "function" ? "[fn]" : value,
    );

    for (const secret of ["bearer", "authorization", "sam_admin_access", "sam_admin_refresh"]) {
      expect(text.toLowerCase()).not.toContain(secret);
      expect(serialized.toLowerCase()).not.toContain(secret);
    }

    expect(text).not.toContain("/api/v1");
    expect(text).not.toMatch(/https?:\/\//);
  });
});
