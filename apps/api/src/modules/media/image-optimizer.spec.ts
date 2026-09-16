import sharp from "sharp";

import { optimizeImage } from "./image-optimizer";

describe("optimizeImage", () => {
  it("shrinks an oversized photo to the 1600px cap and a materially smaller file", async () => {
    const oversized = await sharp({
      create: { width: 2400, height: 2400, channels: 3, background: { r: 120, g: 80, b: 40 } },
    })
      .png()
      .toBuffer();

    const optimized = await optimizeImage(oversized, "image/png");
    const metadata = await sharp(optimized).metadata();

    expect(metadata.width).toBeLessThanOrEqual(1600);
    expect(metadata.height).toBeLessThanOrEqual(1600);
    expect(optimized.length).toBeLessThan(oversized.length);
  });

  it("leaves an already-small image's dimensions alone", async () => {
    const small = await sharp({
      create: { width: 400, height: 300, channels: 3, background: { r: 10, g: 10, b: 10 } },
    })
      .jpeg()
      .toBuffer();

    const optimized = await optimizeImage(small, "image/jpeg");
    const metadata = await sharp(optimized).metadata();

    expect(metadata.width).toBe(400);
    expect(metadata.height).toBe(300);
  });

  it("re-encodes in the same format it was given, not a normalized one", async () => {
    const webp = await sharp({
      create: { width: 2000, height: 1000, channels: 3, background: { r: 200, g: 200, b: 200 } },
    })
      .webp()
      .toBuffer();

    const optimized = await optimizeImage(webp, "image/webp");
    const metadata = await sharp(optimized).metadata();

    expect(metadata.format).toBe("webp");
  });

  it("keeps a non-square image's aspect ratio while capping its longer edge", async () => {
    const wide = await sharp({
      create: { width: 3200, height: 1600, channels: 3, background: { r: 50, g: 50, b: 50 } },
    })
      .jpeg()
      .toBuffer();

    const optimized = await optimizeImage(wide, "image/jpeg");
    const metadata = await sharp(optimized).metadata();

    expect(metadata.width).toBe(1600);
    expect(metadata.height).toBe(800);
  });
});
