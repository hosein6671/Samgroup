import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { textOf } from "@test/element-tree";

import AdminCustomFormulationRequestsPage from "./page";

import type { ReactNode } from "react";

/**
 * `/admin/leads/custom-formulation-requests` — the second inbox.
 *
 * Its session handling and failure taxonomy are the inquiry inbox's, asserted in full there. What
 * is asserted here is what makes this inbox a different surface rather than a copy: it offers no
 * type filter, shows no type column, and its empty state names the right thing.
 */

const { readAdminSession, resolveAdminAccess } = vi.hoisted(() => ({
  readAdminSession: vi.fn(),
  resolveAdminAccess: vi.fn(),
}));
const { getAdminCustomFormulationRequests } = vi.hoisted(() => ({
  getAdminCustomFormulationRequests: vi.fn(),
}));
const { signOut } = vi.hoisted(() => ({ signOut: vi.fn() }));

vi.mock("@/features/admin/session/session", () => ({ readAdminSession, resolveAdminAccess }));
vi.mock("@/features/admin/leads/leads-api", () => ({ getAdminCustomFormulationRequests }));
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

async function render(searchParams: Record<string, string> = {}): Promise<ReactNode> {
  return AdminCustomFormulationRequestsPage({ searchParams: Promise.resolve(searchParams) });
}

beforeEach(() => {
  readAdminSession.mockResolvedValue({ state: "authenticated", user: ADMIN });
  resolveAdminAccess.mockReturnValue({ state: "authorized", user: ADMIN });
  getAdminCustomFormulationRequests.mockResolvedValue({
    state: "ok",
    value: { items: [], total: 0, page: 1, limit: 25 },
  });
});

afterEach(() => {
  vi.resetAllMocks();
});

describe("the list", () => {
  it("renders the rows it was given", async () => {
    getAdminCustomFormulationRequests.mockResolvedValue({
      state: "ok",
      value: { items: [REQUEST], total: 1, page: 1, limit: 25 },
    });

    const text = textOf(await render());

    expect(text).toContain("Analytical Engines Ltd");
    expect(text).toContain("High-temperature chain oil");
  });

  it("says the inbox is empty rather than inventing rows", async () => {
    expect(textOf(await render())).toContain("No custom formulation requests yet");
  });

  /**
   * The entity has no enumerated column, so the API declares no filter and the page offers no
   * control for one. A filter that cannot change the result is worse than no filter.
   */
  it("offers no type filter, and forwards none even if a URL supplies one", async () => {
    const text = textOf(await render({ inquiryType: "sample_request" }));

    expect(text).not.toContain("All types");
    expect(getAdminCustomFormulationRequests).toHaveBeenCalledWith({ page: 1, limit: 25 });
  });

  it("asks for the page the URL named, at the fixed page size", async () => {
    await render({ page: "2", limit: "5000" });

    expect(getAdminCustomFormulationRequests).toHaveBeenCalledWith({ page: 2, limit: 25 });
  });

  it("carries only the page into its pagination links", async () => {
    getAdminCustomFormulationRequests.mockResolvedValue({
      state: "ok",
      value: { items: [REQUEST], total: 60, page: 1, limit: 25 },
    });

    const text = textOf(await render({ assignedToId: "someone" }));

    expect(text).toContain("/admin/leads/custom-formulation-requests?page=2");
    expect(text).not.toContain("assignedToId");
  });
});

describe("failures", () => {
  it("renders an outage as unavailable, never as an empty inbox", async () => {
    getAdminCustomFormulationRequests.mockResolvedValue({ state: "unavailable" });

    const text = textOf(await render());

    expect(text).toContain("Temporarily unavailable");
    expect(text).not.toContain("No custom formulation requests yet");
  });

  it("renders an authoritative 403 as access denied", async () => {
    getAdminCustomFormulationRequests.mockResolvedValue({ state: "forbidden" });

    expect(textOf(await render())).toContain("Access denied");
  });

  it("sends an API 401 to the session-end handler", async () => {
    getAdminCustomFormulationRequests.mockResolvedValue({ state: "unauthenticated" });

    await expect(render()).rejects.toThrow("NEXT_REDIRECT:/admin/session/end");
  });

  it("sends an anonymous caller to login without reading anything", async () => {
    readAdminSession.mockResolvedValue({ state: "anonymous" });

    await expect(render()).rejects.toThrow("NEXT_REDIRECT:/login");
    expect(getAdminCustomFormulationRequests).not.toHaveBeenCalled();
  });
});
