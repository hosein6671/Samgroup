import { Module } from "@nestjs/common";

import { PrismaModule } from "../../prisma/prisma.module";
import { CatalogModule } from "../catalog/catalog.module";
import { IdentityModule } from "../identity/identity.module";

import { AdminCustomFormulationRequestsController } from "./admin-custom-formulation-requests.controller";
import { AdminInquiriesController } from "./admin-inquiries.controller";
import { CustomFormulationRequestsController } from "./custom-formulation-requests.controller";
import { CustomFormulationRequestsService } from "./custom-formulation-requests.service";
import { InquiriesController } from "./inquiries.controller";
import { InquiriesService } from "./inquiries.service";
import { LeadNotificationService } from "./notification/lead-notification.service";
import {
  AdminCustomFormulationWorkflowController,
  AdminInquiryWorkflowController,
} from "./workflow/lead-workflow.controller";
import { LeadWorkflowService } from "./workflow/lead-workflow.service";
import { SmtpMailer } from "./notification/smtp.mailer";

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
 * ── Why it imports IdentityModule ──────────────────────────────────────────
 *
 * For `JwtAuthGuard` and `RolesGuard`, and for nothing else. Those two are the only things
 * Identity exports — `UsersService` and `AuthSessionsService` are deliberately withheld, so this
 * import grants no way to read `users` or `auth_sessions`. The Admin read endpoints get their
 * authentication and their role check from the module that owns identity, and their data from the
 * module that owns the table; neither reaches into the other's repository.
 *
 * ── Why the Admin lead reads live here rather than in an Admin module ───────
 *
 * `/admin/*` is a URL namespace, not a module. `Inquiry` and `CustomFormulationRequest` belong to
 * Forms (ARCHITECTURE.md §Modules), so an "Admin" module querying `inquiries` would be exactly the
 * cross-module repository access the modular-monolith rule forbids and would give both tables two
 * owners. `GET /admin/users` sits inside Identity for the same reason and records the same
 * argument.
 *
 * Both Admin controllers are **read-only**: list and detail. §2.10 contracts the group as "list,
 * read, assign, status"; assignment and status lifecycle are a separate gate and there is no
 * approved status vocabulary to operate — see `submission-status.ts`.
 *
 * ── Internal notification, and nothing the submitter can see ────────────────
 *
 * A successful submission writes one row, then attempts one internal email to the mailbox named by
 * `LEAD_NOTIFICATION_TO`. `LeadNotificationService` is the boundary and `SmtpMailer` is the
 * transport; both are private to this module, because a lead notification is the only thing either
 * of them knows how to send.
 *
 * Three properties this module depends on, all of them asserted by test rather than intended:
 *
 * 1. **The email is outside the success condition.** The row is committed before the attempt, the
 *    boundary never throws, and the 201 is identical whether the relay answered, refused or was
 *    never configured. A lead is never lost to a mail failure.
 * 2. **Nothing reaches the submitter.** No acknowledgement is sent, and the response body still
 *    carries `{ id, createdAt }` and nothing else — no delivery status of any kind is exposed.
 *    The frontend's confirmation copy is unchanged and still claims nothing was sent.
 * 3. **No mailbox is hard-coded.** Sender and recipient are environment configuration with no
 *    defaults; unconfigured means the attempt is skipped and logged, not that mail goes somewhere
 *    unintended.
 */
@Module({
  imports: [PrismaModule, CatalogModule, IdentityModule],
  controllers: [
    InquiriesController,
    CustomFormulationRequestsController,
    AdminInquiriesController,
    AdminCustomFormulationRequestsController,
    AdminInquiryWorkflowController,
    AdminCustomFormulationWorkflowController,
  ],
  providers: [
    InquiriesService,
    CustomFormulationRequestsService,
    LeadNotificationService,
    LeadWorkflowService,
    SmtpMailer,
  ],
})
export class FormsModule {}
