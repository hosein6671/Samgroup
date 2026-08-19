import { afterEach, describe, expect, it, vi } from "vitest";

import AdminPage from "./page";

import type { ReactElement, ReactNode } from "react";

/**
 * What the Admin shell renders, per session state — and what it never renders.
 *
 * ── Why the element tree rather than a mounted DOM ──────────────────────────
 *
 * `AdminPage` is an async Server Component. React Testing Library mounts client trees; it has no
 * good story for awaiting one of these, and jsdom would be a dependency bought for a single test.
 * Awaiting the component and walking what it returned is both simpler and stricter: it inspects
 * **prop values as well as text**, so a token smuggled into a `data-` attribute or a hidden input —
 * places a DOM text query would never look — fails the leak assertion too.
 */

const { readAdminSession } = vi.hoisted(() => ({ readAdminSession: vi.fn() }));
const { signOut } = vi.hoisted(() => ({ signOut: vi.fn() }));

vi.mock("@/features/admin/session/session", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/features/admin/session/session")>()),
  readAdminSession,
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

/** Every string reachable in the tree — element text and prop values alike. */
function collectStrings(node: ReactNode, found: string[] = []): string[] {
  if (typeof node === "string") {
    found.push(node);

    return found;
  }

  if (typeof node === "number") {
    found.push(String(node));

    return found;
  }

  if (Array.isArray(node)) {
    for (const child of node) collectStrings(child, found);

    return found;
  }

  if (node !== null && typeof node === "object" && "props" in node) {
    const { props } = node as ReactElement<Record<string, unknown>>;

    for (const [key, value] of Object.entries(props ?? {})) {
      if (key === "children") continue;
      if (typeof value === "string") found.push(value);
    }

    collectStrings((props as { children?: ReactNode })?.children, found);
  }

  return found;
}

async function renderAdmin(): Promise<{ text: string; tree: ReactNode }> {
  const tree = await AdminPage();

  return { text: collectStrings(tree).join(" "), tree };
}

async function redirectFrom(): Promise<string> {
  const rejection = await AdminPage()
    .then(() => null)
    .catch((error: unknown) => error);

  expect(rejection).toBeInstanceOf(RedirectSignal);

  return (rejection as RedirectSignal).to;
}

afterEach(() => {
  vi.resetAllMocks();
});

describe("no session", () => {
  it("redirects to /login", async () => {
    readAdminSession.mockResolvedValue({ state: "anonymous" });

    expect(await redirectFrom()).toBe("/login");
  });
});

describe("expired or revoked credentials", () => {
  it("redirects to the credential-clearing handler, not straight to /login", async () => {
    readAdminSession.mockResolvedValue({ state: "expired" });

    // Straight to /login would leave the stale access cookie in place, middleware would wave it
    // through on the next request, and the two would bounce until it aged out.
    expect(await redirectFrom()).toBe("/admin/session/end");
  });
});

describe("authenticated admin", () => {
  it("renders the shell with the server-supplied email and role", async () => {
    readAdminSession.mockResolvedValue({ state: "authenticated", user: ADMIN });

    const { text } = await renderAdmin();

    expect(text).toContain("SAM Group Admin");
    expect(text).toContain("admin@samgp.com");
    expect(text).toContain("admin");
    expect(text).toContain("Sign out");
  });

  it("renders no protected data — the shell fetches nothing", async () => {
    readAdminSession.mockResolvedValue({ state: "authenticated", user: ADMIN });

    const { text } = await renderAdmin();

    expect(text).toContain("The lead inbox is the only operational module built so far");
  });

  /**
   * The navigation into the lead inbox. Links only — the shell still issues no `/admin/*` request,
   * so there is no count, no preview row and no protected payload on this page.
   */
  it("points a refused lead role at the inbox it may open, and a Customer at nothing", async () => {
    for (const role of ["content_manager", "sales_expert"]) {
      readAdminSession.mockResolvedValue({ state: "authenticated", user: { ...ADMIN, role } });

      expect((await renderAdmin()).text).toContain("/admin/leads/inquiries");
    }

    readAdminSession.mockResolvedValue({
      state: "authenticated",
      user: { ...ADMIN, role: "customer" },
    });

    const { text } = await renderAdmin();

    expect(text).toContain("Access denied");
    expect(text).not.toContain("/admin/leads/inquiries");
  });

  it("links to both lead inboxes", async () => {
    readAdminSession.mockResolvedValue({ state: "authenticated", user: ADMIN });

    const { text } = await renderAdmin();

    expect(text).toContain("/admin/leads/inquiries");
    expect(text).toContain("/admin/leads/custom-formulation-requests");
  });
});

describe("authenticated non-admin", () => {
  /**
   * `/admin` itself stays Admin-only. The three refused roles are not refused identically, and that
   * is the correction this gate made: a Content Manager or Sales Expert is entitled to the lead
   * inbox, so the refusal points them at it. A Customer belongs to no area and is offered nothing
   * but the way out.
   */
  it("renders a distinct access-denied state rather than a login redirect", async () => {
    for (const role of ["content_manager", "sales_expert", "customer"]) {
      readAdminSession.mockResolvedValue({
        state: "authenticated",
        user: { ...ADMIN, role },
      });

      const { text } = await renderAdmin();

      expect(text).toContain("Access denied");
      expect(text).not.toContain("The lead inbox is the only operational module built so far");
      // The shell's own module navigation is not rendered for a role it refuses.
      expect(text).not.toContain("Custom formulation requests");
    }
  });

  it("offers a way out, so the wrong account is not a dead end", async () => {
    readAdminSession.mockResolvedValue({
      state: "authenticated",
      user: { ...ADMIN, role: "sales_expert" },
    });

    expect((await renderAdmin()).text).toContain("Sign out");
  });

  it("discloses nothing beyond what the caller already proved about themselves", async () => {
    readAdminSession.mockResolvedValue({
      state: "authenticated",
      user: { id: "u9", email: "sales@samgp.com", role: "sales_expert" },
    });

    const { text } = await renderAdmin();

    // Their own email, yes. Their internal id, no.
    expect(text).toContain("sales@samgp.com");
    expect(text).not.toContain("u9");
  });
});

describe("backend outage", () => {
  it("renders a neutral unavailable state instead of redirecting", async () => {
    readAdminSession.mockResolvedValue({ state: "unavailable" });

    const { text } = await renderAdmin();

    expect(text).toContain("Temporarily unavailable");
    expect(text).toContain("You have not");
  });

  it("does not claim the visitor is signed out", async () => {
    readAdminSession.mockResolvedValue({ state: "unavailable" });

    const { text } = await renderAdmin();

    expect(text).not.toContain("Access denied");
    expect(text.toLowerCase()).not.toContain("sign in");
  });
});

describe("credential leakage", () => {
  it("puts no token into the rendered output, in any state", async () => {
    const states = [
      { state: "authenticated", user: ADMIN },
      { state: "authenticated", user: { ...ADMIN, role: "customer" } },
      { state: "unavailable" },
    ];

    for (const session of states) {
      readAdminSession.mockResolvedValue(session);

      const { text } = await renderAdmin();

      // The page never reads a token, so this asserts an absence that is structural rather than
      // careful: `readAdminSession` returns no token field for the page to render even by mistake.
      expect(text).not.toMatch(/eyJ/);
      expect(text.toLowerCase()).not.toContain("bearer");
      expect(text).not.toContain("sam_admin_access");
      expect(text).not.toContain("sam_admin_refresh");
    }
  });

  it("passes no token to the sign-out form", async () => {
    readAdminSession.mockResolvedValue({ state: "authenticated", user: ADMIN });

    const { tree } = await renderAdmin();
    const serialized = JSON.stringify(collectStrings(tree));

    expect(serialized).not.toContain("accessToken");
    expect(serialized).not.toContain("refreshToken");
  });
});
