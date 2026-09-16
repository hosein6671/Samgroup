import sharp from "sharp";

/**
 * The longer edge every stored image is capped at. Product and blog photography is viewed at a
 * few hundred pixels wide even in a lightbox-sized gallery; 1600px leaves headroom for a retina
 * display without keeping a source camera's full resolution around forever.
 */
const MAX_DIMENSION = 1600;

/**
 * Every accepted image, resized and recompressed before it reaches storage.
 *
 * Shared by `MediaService.uploadOwnedImage` (every new upload) and `backfill-optimize-media.run.ts`
 * (the one-off pass over images stored before this existed) — one place decides what "optimized"
 * means, rather than the backfill script drifting from the upload path over time.
 *
 * A size guard elsewhere bounds the UPLOAD; it says nothing about what gets served afterwards, and
 * an admin's unedited camera photo — several megapixels, saved lossless or at a high JPEG quality
 * — would otherwise be exactly what every visitor downloads, on every page view, unchanged.
 * `withoutEnlargement` makes the resize a no-op on anything already smaller than the cap, so a
 * properly-sized image is not degraded by passing through this.
 *
 * Re-encoded in the SAME format it arrived in (the caller's already-validated `mimetype`) rather
 * than normalized to one format for every owner — nothing here changes the extension or
 * `ContentType` the rest of the upload path derives from that mimetype.
 */
export async function optimizeImage(buffer: Buffer, mimetype: string): Promise<Buffer> {
  const pipeline = sharp(buffer)
    .rotate() // Applies the source's EXIF orientation, then strips it — nothing here reads EXIF.
    .resize({
      width: MAX_DIMENSION,
      height: MAX_DIMENSION,
      fit: "inside",
      withoutEnlargement: true,
    });

  switch (mimetype) {
    case "image/jpeg":
      return pipeline.jpeg({ quality: 82, mozjpeg: true }).toBuffer();
    case "image/png":
      return pipeline.png({ compressionLevel: 9 }).toBuffer();
    case "image/webp":
      return pipeline.webp({ quality: 82 }).toBuffer();
    default:
      // Only "image/avif" reaches here — every caller has already rejected anything else.
      return pipeline.avif({ quality: 82 }).toBuffer();
  }
}
