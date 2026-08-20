import { Injectable } from "@nestjs/common";

import { readContentGlobal } from "./content-global.reader";
import { toCustomizedSolutionsContent } from "./customized-solutions.projection";
import { PayloadClient } from "./payload.client";

import type { ContentGlobalResult } from "./content-global.reader";
import type { ResolvedLocale } from "../../common/locale/resolved-locale";
import type { CustomizedSolutionsContent } from "@sam-group/types";

/** Payload's slug for the Global. */
const CUSTOMIZED_SOLUTIONS_GLOBAL = "customized-solutions";

export type CustomizedSolutionsContentResult = ContentGlobalResult<CustomizedSolutionsContent>;

/**
 * The Customized Solutions Global — the page's editorial copy, and nothing to do with its form.
 *
 * The reading is `readContentGlobal`, identical to About Us's: no draft is ever requested, an empty
 * Payload document becomes `available: false`, and the locale fallback is measured rather than
 * inferred. Only the slug and the projection differ, which is the point of sharing it — the
 * published-only guarantee is one implementation, not one per page.
 *
 * **The Custom Product Request form is not served from here and never will be.** Its fields,
 * options, validation and consent text follow the `custom_formulation_requests` columns and the DTO
 * that writes them; this service returns page copy. A CMS outage changes what this endpoint
 * answers and changes nothing about whether the form works.
 */
@Injectable()
export class CustomizedSolutionsService {
  constructor(private readonly payload: PayloadClient) {}

  async find(locale: ResolvedLocale): Promise<CustomizedSolutionsContentResult> {
    return readContentGlobal(
      this.payload,
      CUSTOMIZED_SOLUTIONS_GLOBAL,
      locale,
      toCustomizedSolutionsContent,
    );
  }
}
