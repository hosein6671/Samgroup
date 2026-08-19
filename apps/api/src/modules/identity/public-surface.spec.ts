import { GUARDS_METADATA } from "@nestjs/common/constants";
import { APP_GUARD } from "@nestjs/core";

import { AdminCustomFormulationRequestsController } from "../forms/admin-custom-formulation-requests.controller";
import { AdminInquiriesController } from "../forms/admin-inquiries.controller";
import { BlogPostsController } from "../blog/blog-posts.controller";
import { CategoriesController } from "../catalog/categories.controller";
import { ContentPagesController } from "../content/content-pages.controller";
import { CustomFormulationRequestsController } from "../forms/custom-formulation-requests.controller";
import { HealthController } from "../system/health.controller";
import { InquiriesController } from "../forms/inquiries.controller";
import { LocalesController } from "../localization/locales.controller";
import { ProductsController } from "../catalog/products.controller";
import { SeoController } from "../seo/seo.controller";

import { AdminUsersController } from "./admin-users.controller";
import { AuthController } from "./auth.controller";
import { JwtAuthGuard } from "./guards/jwt-auth.guard";
import { RolesGuard } from "./guards/roles.guard";

/**
 * The regression this gate most needed a test for.
 *
 * Introducing authentication is the moment a platform accidentally becomes authenticated: one
 * `APP_GUARD` registration and every public read starts answering 401. SECURITY.md is explicit that
 * "the public site is entirely unauthenticated in Phase 1" and that the admin area is "the *only*
 * authenticated surface", so this asserts the property directly rather than by exercising each
 * endpoint.
 */

/** Guard classes attached to a controller by `@UseGuards`, at the class level. */
function classGuards(controller: new (...args: never[]) => object): unknown[] {
  const guards: unknown = Reflect.getMetadata(GUARDS_METADATA, controller);

  return Array.isArray(guards) ? guards : [];
}

/** Guard classes attached to one handler by `@UseGuards`. */
function handlerGuards(handler: object): unknown[] {
  const guards: unknown = Reflect.getMetadata(GUARDS_METADATA, handler);

  return Array.isArray(guards) ? guards : [];
}

const PUBLIC_CONTROLLERS = [
  HealthController,
  LocalesController,
  CategoriesController,
  ProductsController,
  BlogPostsController,
  ContentPagesController,
  SeoController,
  InquiriesController,
  CustomFormulationRequestsController,
];

describe("the public API surface stays unauthenticated", () => {
  it("registers no authentication or RBAC guard globally", () => {
    /*
     * Loaded with `require` inside the test rather than imported at the top, and given an
     * environment first — `ConfigModule.forRoot` validates eagerly, while `AppModule`'s decorator
     * is evaluated, so a top-level import throws before a single assertion runs. The same
     * arrangement `throttle.config.spec.ts` documents from measurement. The values are placeholders
     * that satisfy `env.validation.ts` and reach nothing: no Nest application is created here, no
     * connection is opened, and no token is signed.
     */
    process.env.API_PORT ??= "3001";
    process.env.DATABASE_URL ??= "postgresql://user:pass@127.0.0.1:5432/sam_platform";
    process.env.JWT_SECRET ??= "test-placeholder-signing-secret-32-chars";

    const { AppModule } = require("../../app.module") as { AppModule: object };
    const providers: unknown = Reflect.getMetadata("providers", AppModule);
    const globalGuards = (Array.isArray(providers) ? providers : []).filter(
      (provider): provider is { provide: unknown; useClass?: unknown } =>
        typeof provider === "object" &&
        provider !== null &&
        (provider as { provide?: unknown }).provide === APP_GUARD,
    );

    // Not "no APP_GUARD of any kind" — a future global guard may be legitimate. What must never be
    // global is authentication or authorization.
    expect(globalGuards.map((provider) => provider.useClass)).not.toContain(JwtAuthGuard);
    expect(globalGuards.map((provider) => provider.useClass)).not.toContain(RolesGuard);
  });

  it("attaches no auth guard to any pre-existing public controller", () => {
    for (const controller of PUBLIC_CONTROLLERS) {
      const guards = classGuards(controller);

      expect(guards).not.toContain(JwtAuthGuard);
      expect(guards).not.toContain(RolesGuard);
    }
  });

  it("attaches no auth guard to any public controller's handlers", () => {
    for (const controller of PUBLIC_CONTROLLERS) {
      const prototype: object = controller.prototype;
      const handlers = Object.getOwnPropertyNames(prototype)
        .filter((name) => name !== "constructor")
        .map((name) => (prototype as Record<string, unknown>)[name])
        .filter((value): value is object => typeof value === "function");

      for (const handler of handlers) {
        const guards = handlerGuards(handler);

        expect(guards).not.toContain(JwtAuthGuard);
        expect(guards).not.toContain(RolesGuard);
      }
    }
  });

  it("keeps POST /auth/login itself public", () => {
    // Login cannot require a token. The class carries no auth guard, and the handler carries only
    // the throttler.
    expect(classGuards(AuthController)).not.toContain(JwtAuthGuard);
    expect(handlerGuards(AuthController.prototype.login)).not.toContain(JwtAuthGuard);
  });

  /**
   * Refresh is unauthenticated by design, and it is worth an assertion rather than a comment: the
   * endpoint exists to be reachable once the access token has expired, so a `JwtAuthGuard` added
   * here — which looks like tightening security — would make it useful only while it was
   * unnecessary, and would strand every session at the fifteen-minute mark. The refresh token is
   * the authentication factor (ADR-012).
   */
  it("keeps POST /auth/refresh reachable without an access token", () => {
    expect(handlerGuards(AuthController.prototype.refresh)).not.toContain(JwtAuthGuard);
  });
});

describe("the protected surface is protected by declaration", () => {
  it("gates GET /auth/me on authentication, without a role requirement", () => {
    const guards = handlerGuards(AuthController.prototype.me);

    expect(guards).toContain(JwtAuthGuard);
    // Any authenticated caller may ask who they are; RolesGuard denies by default and would need a
    // list of all four roles to say the same thing.
    expect(guards).not.toContain(RolesGuard);
  });

  /**
   * Logout is authenticated, per §2.2's **A** — and the guard is load-bearing rather than
   * decorative. The revocation is scoped to the id the guard resolved, so without it there would be
   * no id to scope to and presenting a stranger's refresh token would end their session.
   */
  it("gates POST /auth/logout on authentication, without a role requirement", () => {
    const guards = handlerGuards(AuthController.prototype.logout);

    expect(guards).toContain(JwtAuthGuard);
    expect(guards).not.toContain(RolesGuard);
  });

  it("gates /admin/users on authentication AND role, in that order", () => {
    // Order matters: RolesGuard reads what JwtAuthGuard wrote, so a reversed list would answer 401
    // for an Admin with a perfectly valid token.
    expect(classGuards(AdminUsersController)).toEqual([JwtAuthGuard, RolesGuard]);
  });

  /**
   * The Admin lead inbox. These two live in the Forms module — `/admin/*` is a URL namespace, not a
   * module, and `Inquiry` and `CustomFormulationRequest` belong to Forms — so they are the first
   * protected endpoints outside Identity. Their guards are asserted here as well as in their own
   * spec, because this file is the one place that answers "what on this platform is authenticated"
   * in a single list.
   */
  it.each([
    ["/admin/inquiries", AdminInquiriesController],
    ["/admin/custom-formulation-requests", AdminCustomFormulationRequestsController],
  ])("gates %s on authentication AND role, in that order", (_path, controller) => {
    expect(classGuards(controller)).toEqual([JwtAuthGuard, RolesGuard]);
  });
});
