import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { textOf } from "@test/element-tree";

import AdminCustomFormulationRequestDetailPage from "./page";

import type { ReactNode } from "react";

/**
 * `/admin/leads/custom-formulation-requests/[id]`.
 *
 * The same not-found / unavailable separation the inquiry detail route asserts, checked here too
 * rather than assumed to have been copied correctly — the two routes are separate files, and the
 * rule they share is the one thing about them worth a duplicate assertion.
 */

const { readAdminSession, resolveAdminAccess, getAdminAccessToken, getLeadHistory } = vi.hoisted(
  () => ({
    readAdminSession: vi.fn(),
    resolveAdminAccess: vi.fn(),
    getAdminAccessToken: vi.fn(),
    getLeadHistory: vi.fn(),
  }),
);
const { getAdminCustomFormulationRequest } = vi.hoisted(() => ({
  getAdminCustomFormulationRequest: vi.fn(),
}));
const { signOut } = vi.hoisted(() => ({ signOut: vi.fn() }));

vi.mock("@/features/admin/session/session", () => ({
  readAdminSession,
  resolveAdminAccess,
  getAdminAccessToken,
}));
vi.mock("@/features/admin/leads/leads-api", () => ({
  getAdminCustomFormulationRequest,
  getLeadHistory,
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

const DETAIL = {
  id: ID,
  createdAt: "2026-08-19T10:00:00.000Z",
  companyName: "Analytical Engines Ltd",
  country: "United Kingdom",
  industry: "Manufacturing",
  email: "ada@example.com",
  productOrApplication: "High-temperature chain oil",
  status: "new",
  assigneeId: null,
  phone: null,
  requiredSpecifications: "ISO VG 220, drop point above 250 C",
  estimatedQuantity: null,
  packagingRequirements: null,
  additionalInformation: null,
  destinationCountry: null,
  preferredIncoterm: null,
  consentGiven: true,
  privacyPolicyVersion: null,
};

async function render(id = ID): Promise<ReactNode> {
  return AdminCustomFormulationRequestDetailPage({ params: Promise.resolve({ id }) });
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
  getAdminCustomFormulationRequest.mockResolvedValue({ state: "ok", value: DETAIL });
});

afterEach(() => {
  vi.resetAllMocks();
});

it("renders the request, including the specification brief the list omits", async () => {
  const text = textOf(await render());

  expect(getAdminCustomFormulationRequest).toHaveBeenCalledWith(ID);
  expect(text).toContain("ISO VG 220, drop point above 250 C");
  expect(text).toContain("Analytical Engines Ltd");
});

it("renders an authoritative 404 as a real not-found, with a way back", async () => {
  getAdminCustomFormulationRequest.mockResolvedValue({ state: "not-found" });

  const text = textOf(await render());

  expect(text).toContain("Not found");
  expect(text).toContain("/admin/leads/custom-formulation-requests");
  expect(text).not.toContain("Temporarily unavailable");
});

it("renders an outage as unavailable, never as not-found", async () => {
  getAdminCustomFormulationRequest.mockResolvedValue({ state: "unavailable" });

  const text = textOf(await render());

  expect(text).toContain("Temporarily unavailable");
  expect(text).not.toContain("Not found");
});

it("sends an API 401 to the session-end handler", async () => {
  getAdminCustomFormulationRequest.mockResolvedValue({ state: "unauthenticated" });

  await expect(render()).rejects.toThrow("NEXT_REDIRECT:/admin/session/end");
});

it("leaks no credential into the render", async () => {
  const tree = await render();
  const serialized = JSON.stringify(tree, (_key, value: unknown) =>
    typeof value === "function" ? "[fn]" : value,
  );

  expect(serialized.toLowerCase()).not.toContain("bearer");
  expect(serialized).not.toContain("accessToken");
  expect(textOf(tree)).not.toContain("/api/v1");
});
