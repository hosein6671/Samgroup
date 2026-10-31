import { cache } from "react";

import { getCategoryBySlug } from "@/lib/catalog";

import { FAMILIES } from "./products-data";

/** A family photograph uploaded in Admin → Catalog → Categories. */
export type FamilyPhoto = { readonly src: string; readonly alt: string };

/**
 * The Admin-uploaded photograph of each Product Family, keyed by family id.
 *
 * The owner uploads a family's photograph in `/admin/catalog/categories` (the category's
 * `processImage`). The redesigned family page and the Products overview cards used to show only the
 * built-in fixture photograph, so an upload changed nothing a visitor could see (reported 31 October
 * 2026). Both now prefer the upload and keep the fixture photograph when there is none.
 *
 * A family whose read fails is simply absent: the card keeps its built-in photograph, and the page
 * never fails because of a photograph.
 */
export const getFamilyPhotos = cache(
  async (locale: string): Promise<Readonly<Record<string, FamilyPhoto>>> => {
    const entries = await Promise.all(
      FAMILIES.map(async (family): Promise<[string, FamilyPhoto] | null> => {
        const result = await getCategoryBySlug(family.id, locale).catch(() => null);
        const image = result?.ok ? result.record.processImage : null;
        return image ? [family.id, { src: image.url, alt: image.altText ?? "" }] : null;
      }),
    );
    return Object.fromEntries(entries.filter((entry) => entry !== null));
  },
);
