import { Injectable } from "@nestjs/common";

import { readContentGlobal } from "./content-global.reader";
import { PayloadClient } from "./payload.client";
import { toQualityCertificationsContent } from "./quality-certifications.projection";

import type { ContentGlobalResult } from "./content-global.reader";
import type { ResolvedLocale } from "../../common/locale/resolved-locale";
import type { QualityCertificationsContent } from "@sam-group/types";

/** Payload's slug for the Global. */
const QUALITY_CERTIFICATIONS_GLOBAL = "quality-certifications";

export type QualityCertificationsContentResult = ContentGlobalResult<QualityCertificationsContent>;

/**
 * The Quality & Certifications Global.
 *
 * The reading is `readContentGlobal`, identical to the two Globals before it: no draft is ever
 * requested, an empty Payload document becomes `available: false`, and the locale fallback is
 * measured rather than inferred. Only the slug and the projection differ — which is the point of
 * sharing it, and matters more here than anywhere: **the published-only guarantee on this page is
 * the same one implementation the other pages already depend on**, not a second copy written for
 * the page whose source document calls it the highest-stakes one for accuracy.
 *
 * **No `Certifications` collection is read from here, because none exists.** The certifications
 * section of this Global is a statement that the list is unconfirmed; there is no second request,
 * no relation to expand and no list to filter for published state. When that collection arrives it
 * is resolved inside the projection, so this service does not change.
 */
@Injectable()
export class QualityCertificationsService {
  constructor(private readonly payload: PayloadClient) {}

  async find(locale: ResolvedLocale): Promise<QualityCertificationsContentResult> {
    return readContentGlobal(
      this.payload,
      QUALITY_CERTIFICATIONS_GLOBAL,
      locale,
      toQualityCertificationsContent,
    );
  }
}
