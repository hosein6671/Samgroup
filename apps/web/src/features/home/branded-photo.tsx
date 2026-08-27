import Image from "next/image";
import type { ReactNode } from "react";

import { LogoMark } from "@/features/site/logo-mark";

type BrandedPhotoProps = {
  readonly src: string;
  readonly alt: string;
  readonly caption: string;
  readonly className: string;
  readonly sizes: string;
};

/**
 * A photographic home-page plate with the official mark rendered separately from the image.
 * Keeping the brand layer in HTML preserves the supplied artwork and avoids AI-distorted logos.
 */
export function BrandedPhoto({
  src,
  alt,
  caption,
  className,
  sizes,
}: BrandedPhotoProps): ReactNode {
  return (
    <figure className={`fs-branded-photo ${className}`}>
      <Image src={src} alt={alt} fill sizes={sizes} />
      <span className="fs-photo-brand" aria-hidden="true">
        <LogoMark height={18} />
        <span>SAM GROUP</span>
      </span>
      <figcaption>{caption}</figcaption>
    </figure>
  );
}
