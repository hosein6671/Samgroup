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
      <PhotoBrand />
      <figcaption>{caption}</figcaption>
    </figure>
  );
}

/** The SAM GROUP badge every home-page photograph carries, as its own HTML layer. */
export function PhotoBrand(): ReactNode {
  return (
    <span className="fs-photo-brand" aria-hidden="true">
      <LogoMark height={18} />
      <span>SAM GROUP</span>
    </span>
  );
}

/**
 * The same plate without a caption of its own, for photographs whose text sits beside or below
 * them (Who We Are, Industries, Customized Solutions, Insights). The frame is a `div`, so it can
 * live inside a `figure`, an `article` or a link without nesting figures.
 */
export function PhotoFrame({
  src,
  alt,
  className,
  sizes,
  priority = false,
}: {
  readonly src: string;
  readonly alt: string;
  readonly className?: string;
  readonly sizes: string;
  readonly priority?: boolean;
}): ReactNode {
  return (
    <div className={className === undefined ? "fs-photo" : `fs-photo ${className}`}>
      <Image src={src} alt={alt} fill sizes={sizes} priority={priority} />
      <PhotoBrand />
    </div>
  );
}
