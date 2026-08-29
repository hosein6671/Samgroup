import { Injectable } from "@nestjs/common";

import { readContentGlobal } from "./content-global.reader";
import { toContactUsContent } from "./contact-us.projection";
import { PayloadClient } from "./payload.client";

import type { ContentGlobalResult } from "./content-global.reader";
import type { ResolvedLocale } from "../../common/locale/resolved-locale";
import type { ContactUsContent } from "@sam-group/types";

@Injectable()
export class ContactUsService {
  constructor(private readonly payload: PayloadClient) {}

  find(locale: ResolvedLocale): Promise<ContentGlobalResult<ContactUsContent>> {
    return readContentGlobal(this.payload, "contact-us", locale, toContactUsContent, (doc) => {
      const address = doc.address;
      return typeof address === "string" ? address.trim() : "";
    });
  }
}
