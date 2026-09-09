import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  patch: vi.fn(),
  access: vi.fn(),
  token: vi.fn(),
  revalidate: vi.fn(),
}));
vi.mock("@/lib/api-client", () => ({ apiPatch: mocks.patch }));
vi.mock("@/features/admin/session/require-admin", () => ({ requireAdminAccess: mocks.access }));
vi.mock("@/features/admin/session/session", () => ({ getAdminAccessToken: mocks.token }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidate }));
import { saveContent } from "./actions";

const previous = { message: "", saved: false, revision: "3", operationId: "operation" };
function form(): FormData {
  const result = new FormData();
  result.set("resource", "product");
  result.set("key", "product-id");
  result.set("action", "publish");
  result.set(
    "fields",
    JSON.stringify({
      name: "Example",
      description: "Copy",
      seo: { canonicalUrl: "", keywords: ["one", "", " two "] },
    }),
  );
  return result;
}
describe("content editor save actions", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.access.mockResolvedValue({ state: "authorized" });
    mocks.token.mockResolvedValue("server-only-token");
  });
  it("publishes product fields to the product endpoint and invalidates public catalogue pages", async () => {
    mocks.patch.mockResolvedValue({ ok: true, data: { revision: "4", slug: "example" } });
    const state = await saveContent(previous, form());
    expect(state.saved).toBe(true);
    expect(state.revision).toBe("4");
    expect(mocks.patch).toHaveBeenCalledWith(
      "/admin/products/product-id",
      {
        revision: 3,
        action: "publish",
        content: { name: "Example", description: "Copy", seo: { keywords: ["one", "two"] } },
      },
      { accessToken: "server-only-token" },
    );
    expect(mocks.revalidate).toHaveBeenCalledWith("/en/products/example");
    expect(mocks.revalidate).toHaveBeenCalledWith("/en/products", "layout");
  });
  it("keeps the revision on a conflict and does not revalidate unpublished edits", async () => {
    mocks.patch.mockResolvedValue({ ok: false, reason: "http", status: 409 });
    const state = await saveContent(previous, form());
    expect(state.saved).toBe(false);
    expect(state.revision).toBe("3");
    expect(state.message).toContain("changed");
    expect(mocks.revalidate).not.toHaveBeenCalled();
  });
  it("does not write without editorial access", async () => {
    mocks.access.mockResolvedValue({ state: "forbidden" });
    expect((await saveContent(previous, form())).saved).toBe(false);
    expect(mocks.patch).not.toHaveBeenCalled();
  });
});
