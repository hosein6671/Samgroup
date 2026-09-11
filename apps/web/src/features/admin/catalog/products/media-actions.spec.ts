import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  delete: vi.fn(),
  patch: vi.fn(),
  postFormData: vi.fn(),
  access: vi.fn(),
  token: vi.fn(),
  revalidate: vi.fn(),
}));

vi.mock("@/lib/api-client", () => ({
  apiDelete: mocks.delete,
  apiPatch: mocks.patch,
  apiPostFormData: mocks.postFormData,
}));
vi.mock("@/features/admin/session/require-admin", () => ({ requireAdminAccess: mocks.access }));
vi.mock("@/features/admin/session/session", () => ({ getAdminAccessToken: mocks.token }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidate }));

import { makeProductImagePrimary, removeProductImage, uploadProductImage } from "./media-actions";

describe("product media actions", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.access.mockResolvedValue({ state: "authorized" });
    mocks.token.mockResolvedValue("server-only-token");
  });

  it("uploads multipart image data through the protected product endpoint", async () => {
    const item = {
      id: "image-1",
      url: "/media/products/p/image.webp",
      altText: "Drum",
      sortOrder: 0,
      isPrimary: true,
    };
    mocks.postFormData.mockResolvedValue({ ok: true, data: item });
    const form = new FormData();
    form.set("image", new File([new Uint8Array([1])], "drum.webp", { type: "image/webp" }));
    form.set("altText", " Drum ");

    await expect(uploadProductImage("product-1", form)).resolves.toEqual({
      item,
      message: "Image uploaded.",
    });
    expect(mocks.postFormData).toHaveBeenCalledWith(
      "/admin/products/product-1/images",
      expect.any(FormData),
      { accessToken: "server-only-token" },
    );
    const sent = mocks.postFormData.mock.calls[0]?.[1] as FormData;
    expect(sent.get("altText")).toBe("Drum");
  });

  it("marks an owned image as primary and refreshes the catalogue", async () => {
    mocks.patch.mockResolvedValue({ ok: true, data: { updated: true } });
    await expect(makeProductImagePrimary("product/1", "image/1")).resolves.toEqual({
      ok: true,
      message: "Primary image updated.",
    });
    expect(mocks.patch).toHaveBeenCalledWith(
      "/admin/products/product%2F1/images/image%2F1/primary",
      {},
      { accessToken: "server-only-token" },
    );
    expect(mocks.revalidate).toHaveBeenCalledWith("/en/products", "layout");
  });

  it("does not report deletion success when the API rejects it", async () => {
    mocks.delete.mockResolvedValue({ ok: false, reason: "http", status: 404 });
    await expect(removeProductImage("product-1", "image-1")).resolves.toEqual({
      ok: false,
      message: "The image could not be removed.",
    });
  });
});
