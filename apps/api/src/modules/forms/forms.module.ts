import { Module } from "@nestjs/common";

import { PrismaModule } from "../../prisma/prisma.module";
import { CatalogModule } from "../catalog/catalog.module";

import { CustomFormulationRequestsController } from "./custom-formulation-requests.controller";
import { CustomFormulationRequestsService } from "./custom-formulation-requests.service";
import { InquiriesController } from "./inquiries.controller";
import { InquiriesService } from "./inquiries.service";

/**
 * The **Forms** module — ARCHITECTURE.md §Modules, "sample requests, custom formulation requests,
 * contact form". Owns `Inquiry` and `CustomFormulationRequest` in sam_platform, and nothing else.
 *
 * Two of the six entities that module eventually holds are implemented here.
 * `DistributorApplication`, `JobApplication`, `DownloadRequest` and `NewsletterSubscription` are
 * contracted in §2.6 and are not in this gate — each has a page that does not exist yet, and
 * `/downloads/request` additionally needs the object storage whose production replacement is
 * undecided (CLAUDE.md §2).
 *
 * ── Why it imports CatalogModule ────────────────────────────────────────────
 *
 * `Inquiry.relatedProductId` references a `Product`, which Catalog owns. The verification before
 * the insert therefore goes through `ProductsService` — the module boundary rule is that cross-
 * module access uses the other module's service interface, never its repository or model. This is
 * what made `CatalogModule` export `ProductsService`; before this gate it exported only
 * `CategoriesService`, deliberately, because no consumer existed.
 *
 * ── Nothing is exported ─────────────────────────────────────────────────────
 *
 * Both services are write paths for their own controllers and no other module has a reason to
 * submit an inquiry. Exporting ahead of a consumer is the same mistake `CatalogModule`'s own note
 * warns about.
 *
 * ── No notification, no email, and the API says so ──────────────────────────
 *
 * A successful submission writes one row and returns. Nothing is emailed to the submitter, nothing
 * notifies a Sales Expert, and no acknowledgement is queued: API_CONTRACT_FINAL.md's Remaining
 * Blockers §4 records that email delivery is unspecified — no provider, no sender domain, no
 * deliverability plan exists in any document. The frontend's confirmation copy is written to match
 * what actually happens.
 */
@Module({
  imports: [PrismaModule, CatalogModule],
  controllers: [InquiriesController, CustomFormulationRequestsController],
  providers: [InquiriesService, CustomFormulationRequestsService],
})
export class FormsModule {}
