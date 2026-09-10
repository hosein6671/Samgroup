import { CATEGORY_CONTENT_KEYS } from "./category-content.controller";
import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Header,
  HttpException,
  Injectable,
  Module,
  Param,
  Patch,
  Query,
  ServiceUnavailableException,
  UseGuards,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  IsDateString,
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from "class-validator";
import { Type } from "class-transformer";
import { withMeta } from "../../common/http/with-meta";
import { UserRole } from "../../prisma/generated/client";
import { IdentityModule } from "../identity/identity.module";
import { CurrentUser } from "../identity/decorators/current-user.decorator";
import { Roles } from "../identity/decorators/roles.decorator";
import { JwtAuthGuard } from "../identity/guards/jwt-auth.guard";
import { RolesGuard } from "../identity/guards/roles.guard";
import type { AuthenticatedUser } from "../identity/authenticated-user";

const KEYS = [
  "faq-page",
  "about-us",
  "customized-solutions",
  "quality-certifications",
  "contact-us",
];
export class ContentEditDto {
  @IsUUID() operationId!: string;
  @IsString() @MaxLength(100) revision!: string;
  @IsIn(["save-draft", "publish"]) action!: "save-draft" | "publish";
  @IsObject() fields!: Record<string, unknown>;
}
@Injectable()
export class CompanyEditorService {
  constructor(private readonly config: ConfigService) {}
  async request(
    key: string,
    actorId: string,
    edit?: ContentEditDto,
  ): Promise<Record<string, unknown>> {
    if (
      !/^faq-[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(key) &&
      !KEYS.includes(key) &&
      !(key.startsWith("category-") && CATEGORY_CONTENT_KEYS.includes(key.slice(9)))
    )
      throw new BadRequestException("Unknown content page.");
    const result = await this.send(
      `/api/editor/company/${key}`,
      JSON.stringify({ ...edit, actorId, action: edit?.action ?? "read" }),
    );
    if (typeof result.revision !== "string")
      throw new ServiceUnavailableException("Invalid content response.");
    return result;
  }
  async faqs(page: number): Promise<ReturnType<typeof withMeta>> {
    const result = await this.send(`/api/editor/faqs?page=${page}`);
    if (!Array.isArray(result.items) || typeof result.total !== "number")
      throw new ServiceUnavailableException("Invalid FAQ list.");
    return withMeta(result.items, { total: result.total, page, limit: 20 });
  }
  async events(query: ContentEventsQuery): Promise<ReturnType<typeof withMeta>> {
    if (query.from && query.to && Date.parse(query.from) > Date.parse(query.to))
      throw new BadRequestException("Start time must not be after end time.");
    const params = new URLSearchParams({ page: String(query.page) });
    for (const key of ["actorId", "event", "from", "to"] as const) {
      const value = query[key];
      if (value) params.set(key, value);
    }
    const result = await this.send(`/api/editor/events?${params}`);
    if (!Array.isArray(result.items) || typeof result.total !== "number")
      throw new ServiceUnavailableException("Invalid content history response.");
    return withMeta(result.items, { total: result.total, page: query.page, limit: 50 });
  }
  private async send(path: string, body?: string): Promise<Record<string, unknown>> {
    const origin = this.config.get<string>("PAYLOAD_INTERNAL_URL");
    const apiKey = this.config.get<string>("PAYLOAD_API_KEY");
    const secret = this.config.get<string>("PAYLOAD_EDITOR_SECRET");
    if (!origin || !apiKey || !secret)
      throw new ServiceUnavailableException("Content editing is unavailable.");
    if (body && Buffer.byteLength(body, "utf8") > 200000)
      throw new BadRequestException("Content is too large.");
    let response: Response;
    try {
      response = await fetch(`${origin.replace(/\/+$/, "")}${path}`, {
        method: body ? "POST" : "GET",
        headers: {
          authorization: `users API-Key ${apiKey}`,
          "x-editor-secret": secret,
          "Content-Type": "application/json",
        },
        body,
        signal: AbortSignal.timeout(10000),
      });
    } catch {
      throw new ServiceUnavailableException(
        "Content service did not respond. Reload before retrying a save.",
      );
    }
    if (response.status === 400 || response.status === 409)
      throw new HttpException(
        response.status === 409
          ? "Content changed. Reload before saving."
          : "Check the content fields.",
        response.status,
      );
    if (!response.ok) throw new ServiceUnavailableException("Content editing is unavailable.");
    let result: unknown;
    try {
      result = await response.json();
    } catch {
      throw new ServiceUnavailableException("Invalid content response.");
    }
    if (!result || typeof result !== "object" || Array.isArray(result))
      throw new ServiceUnavailableException("Invalid content response.");
    return result as Record<string, unknown>;
  }
}
export class ContentEventsQuery {
  @Type(() => Number) @IsInt() @Min(1) @Max(100000) page = 1;
  @IsOptional() @IsUUID() actorId?: string;
  @IsOptional() @IsIn(["content.save-draft", "content.publish"]) event?: string;
  @IsOptional() @IsDateString({ strict: true }) from?: string;
  @IsOptional() @IsDateString({ strict: true }) to?: string;
}
export class FaqListQuery {
  @Type(() => Number) @IsInt() @Min(1) @Max(100000) page = 1;
}
@Controller("admin/faqs")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.CONTENT_MANAGER)
export class FaqAdminController {
  constructor(private readonly editor: CompanyEditorService) {}
  @Get()
  @Header("Cache-Control", "no-store")
  list(@Query() query: FaqListQuery): Promise<ReturnType<typeof withMeta>> {
    return this.editor.faqs(query.page);
  }
}
@Controller("admin/content-events")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class ContentEventsController {
  constructor(private readonly editor: CompanyEditorService) {}
  @Get()
  @Header("Cache-Control", "no-store")
  list(@Query() query: ContentEventsQuery): Promise<ReturnType<typeof withMeta>> {
    return this.editor.events(query);
  }
}
@Controller("admin/content")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.CONTENT_MANAGER)
export class CompanyEditorController {
  constructor(private readonly editor: CompanyEditorService) {}
  @Get(":key")
  @Header("Cache-Control", "no-store")
  read(
    @Param("key") key: string,
    @CurrentUser() actor: AuthenticatedUser,
  ): Promise<Record<string, unknown>> {
    return this.editor.request(key, actor.id);
  }
  @Patch(":key")
  @Header("Cache-Control", "no-store")
  save(
    @Param("key") key: string,
    @CurrentUser() actor: AuthenticatedUser,
    @Body() edit: ContentEditDto,
  ): Promise<Record<string, unknown>> {
    return this.editor.request(key, actor.id, edit);
  }
}
@Module({
  imports: [IdentityModule],
  controllers: [CompanyEditorController, ContentEventsController, FaqAdminController],
  providers: [CompanyEditorService],
})
export class CompanyEditorModule {}
