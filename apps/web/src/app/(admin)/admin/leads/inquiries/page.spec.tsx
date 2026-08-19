import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { textOf } from "@test/element-tree";

import AdminInquiriesPage from "./page";

import type { ReactNode } from "react";

/**
 * `/admin/leads/inquiries` — what it renders for each way the request can end, and what it never
 * renders.
 *
 * ── Every assertion here is about a distinction, not a pixel ───────────────
 *
 * No test below checks a class name, a colour or a layout. What is checked is that four outcomes
 * stay four outcomes: no session sends you to sign in, a stale credential clears itself, a refused
 * role says so without offering a login, and an outage says the platform is down rather than that
 * the inbox is empty.
 */

const { readAdminSession, resolveAdminAccess } = vi.hoisted(() => ({
  readAdminSession: vi.fn(),
  resolveAdminAccess: vi.fn(),
}));
const { getAdminInquiries } = vi.hoisted(() => ({ getAdminInquiries: vi.fn() }));
const { signOut } = vi.hoisted(() => ({ signOut: vi.fn() }));

vi.mock("@/features/admin/session/session", () => ({ readAdminSession, resolveAdminAccess }));
vi.mock("@/features/admin/leads/leads-api", () => ({ getAdminInquiries }));
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
};

async function render(searchParams: Record<string, string> = {}): Promise<ReactNode> {
  return AdminInquiriesPage({ searchParams: Promise.resolve(searchParams) });
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
  getAdminInquiries.mockResolvedValue({
    state: "ok",
    value: { items: [], total: 0, page: 1, limit: 25 },
  });
});

afterEach(() => {
  vi.resetAllMocks();
});

describe("the session is required before anything is fetched", () => {
  it("sends an anonymous caller to the login page", async () => {
    readAdminSession.mockResolvedValue({ state: "anonymous" });

    expect(await redirectFrom()).toBe("/login");
    expect(getAdminInquiries).not.toHaveBeenCalled();
  });

  /**
   * NestJS refused the access token the browser still holds. A Server Component cannot clear a
   * cookie, so the render hands off to the Route Handler that can; redirecting straight to `/login`
   * would leave the stale cookie in place and bounce against middleware until it aged out.
   */
  it("sends a refused credential to the session-end handler, not to login", async () => {
    readAdminSession.mockResolvedValue({ state: "expired" });

    expect(await redirectFrom()).toBe("/admin/session/end");
    expect(getAdminInquiries).not.toHaveBeenCalled();
  });

  it("does not fetch lead data for a role the shell refuses", async () => {
    resolveAdminAccess.mockReturnValue({
      state: "forbidden",
      user: { ...ADMIN, role: "content_manager" },
    });

    const text = textOf(await render());

    expect(text).toContain("Access denied");
    expect(getAdminInquiries).not.toHaveBeenCalled();
  });

  /**
   * An outage during session resolution. **No redirect, and no cookie is touched** — the platform
   * not answering says nothing about anyone's session.
   */
  it("renders a neutral state when the session could not be confirmed", async () => {
    resolveAdminAccess.mockReturnValue({ state: "unavailable" });

    const text = textOf(await render());

    expect(text).toContain("Temporarily unavailable");
    expect(text.toLowerCase()).not.toContain("sign in");
    expect(getAdminInquiries).not.toHaveBeenCalled();
  });
});

describe("what the API says is what is rendered", () => {
  it("renders the rows it was given", async () => {
    getAdminInquiries.mockResolvedValue({
      state: "ok",
      value: { items: [INQUIRY], total: 1, page: 1, limit: 25 },
    });

    const text = textOf(await render());

    expect(text).toContain("Ada");
    expect(text).toContain("Analytical Engines Ltd");
    // The wire value is rendered as the label the submitter saw, not as the enum label.
    expect(text).toContain("Sample request");
  });

  it("says the inbox is empty rather than inventing rows", async () => {
    const text = textOf(await render());

    expect(text).toContain("No inquiries yet");
  });

  /**
   * The empty state is also what an authorized Sales Expert with nothing assigned sees, so its
   * wording must describe an empty queue rather than a refusal — no "denied", no "permission", no
   * suggestion that signing in again would help.
   */
  it("words the empty state as an empty queue, never as an authorization failure", async () => {
    const text = textOf(await render());

    expect(text).toContain("assigned to your account");
    expect(text).not.toContain("Access denied");
    expect(text.toLowerCase()).not.toContain("permission");
    expect(text.toLowerCase()).not.toContain("forbidden");
  });

  it("names the filter in the empty state when one is applied", async () => {
    const text = textOf(await render({ inquiryType: "request_a_quote" }));

    expect(text).toContain("No inquiries of this type");
  });

  it("renders an authoritative 403 as access denied", async () => {
    getAdminInquiries.mockResolvedValue({ state: "forbidden" });

    const text = textOf(await render());

    expect(text).toContain("Access denied");
    expect(text).not.toContain("No inquiries yet");
  });

  it("sends an API 401 to the session-end handler", async () => {
    getAdminInquiries.mockResolvedValue({ state: "unauthenticated" });

    expect(await redirectFrom()).toBe("/admin/session/end");
  });

  /**
   * The load-bearing one. An outage renders "Temporarily unavailable" — never "No inquiries yet.",
   * which an operator would read as "there are no leads" and act on.
   */
  it("renders an outage as unavailable, never as an empty inbox", async () => {
    getAdminInquiries.mockResolvedValue({ state: "unavailable" });

    const text = textOf(await render());

    expect(text).toContain("Temporarily unavailable");
    expect(text).not.toContain("No inquiries yet");
  });
});

describe("pagination", () => {
  it("offers no previous link on the first page and a next link when there is more", async () => {
    getAdminInquiries.mockResolvedValue({
      state: "ok",
      value: { items: [INQUIRY], total: 60, page: 1, limit: 25 },
    });

    const text = textOf(await render());

    expect(text).toContain("60 inquiries in total");
    expect(text).toContain("/admin/leads/inquiries?page=2");
    expect(text).toContain("Page 3");
  });

  it("carries the active filter into the page links and drops everything else", async () => {
    getAdminInquiries.mockResolvedValue({
      state: "ok",
      value: { items: [INQUIRY], total: 60, page: 2, limit: 25 },
    });

    const text = textOf(await render({ inquiryType: "sample_request", assignedToId: "someone" }));

    expect(text).toContain("/admin/leads/inquiries?inquiryType=sample_request&page=3");
    expect(text).toContain("/admin/leads/inquiries?inquiryType=sample_request");
    expect(text).not.toContain("assignedToId");
  });

  it("asks the API for the page the URL named, at the fixed page size", async () => {
    await render({ page: "3", inquiryType: "general_inquiry" });

    expect(getAdminInquiries).toHaveBeenCalledWith({
      page: 3,
      limit: 25,
      inquiryType: "general_inquiry",
    });
  });

  /** A URL cannot ask for a bigger page than the inbox uses, nor for a parameter the API rejects. */
  it("ignores a caller-supplied limit and a caller-supplied scope", async () => {
    await render({ limit: "5000", assignedToId: "33333333-3333-4333-8333-333333333333" });

    expect(getAdminInquiries).toHaveBeenCalledWith({ page: 1, limit: 25 });
  });
});

describe("nothing about the credential reaches the render", () => {
  it("puts no token, cookie name or Authorization header in the tree", async () => {
    getAdminInquiries.mockResolvedValue({
      state: "ok",
      value: { items: [INQUIRY], total: 1, page: 1, limit: 25 },
    });

    const tree = await render();
    const text = textOf(tree);
    const serialized = JSON.stringify(tree, (_key, value: unknown) =>
      typeof value === "function" ? "[fn]" : value,
    );

    for (const secret of ["bearer", "authorization", "sam_admin_access", "sam_admin_refresh"]) {
      expect(text.toLowerCase()).not.toContain(secret);
      expect(serialized.toLowerCase()).not.toContain(secret);
    }

    expect(serialized).not.toContain("accessToken");
  });

  /**
   * Every request goes browser → `apps/web` → NestJS. The page reaches the API only through the
   * server-only module, and no absolute API origin appears anywhere in what it returned.
   */
  it("emits no direct API origin for a browser to call", async () => {
    const text = textOf(await render());

    expect(text).not.toContain("/api/v1");
    expect(text).not.toMatch(/https?:\/\//);
  });
});
