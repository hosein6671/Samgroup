import { inspectSourceBytes, sameCapture } from "./source-capture";

describe("source capture inspection", () => {
  it("computes a deterministic lowercase SHA-256 without retaining bytes", () => {
    expect(inspectSourceBytes(Buffer.from("source"), "Application/PDF", 2)).toEqual({
      sha256: "41cf6794ba4200b839c53531555f0f3998df4cbb01a4d5cb0b94e3ca5e23947d",
      byteSize: 6,
      mediaType: "application/pdf",
      pageCount: 2,
    });
  });

  it("rejects empty files, malformed media types and invalid page counts", () => {
    expect(() => inspectSourceBytes(new Uint8Array(), "application/pdf", 1)).toThrow(/empty/);
    expect(() => inspectSourceBytes(Uint8Array.of(1), "pdf", null)).toThrow(/MIME/);
    expect(() => inspectSourceBytes(Uint8Array.of(1), "application/pdf", 0)).toThrow(/positive/);
  });

  it("treats metadata as part of the immutable capture identity", () => {
    const value = inspectSourceBytes(Uint8Array.of(1), "application/pdf", 1);
    expect(sameCapture(value, value)).toBe(true);
    expect(sameCapture(value, { ...value, pageCount: 2 })).toBe(false);
  });
});
