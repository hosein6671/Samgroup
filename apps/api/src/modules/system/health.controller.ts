import { Controller, Get } from "@nestjs/common";

/**
 * GET /api/v1/health — liveness/readiness for Docker health checks
 * (API_CONTRACT_FINAL.md §2.1).
 *
 * The global envelope interceptor wraps this return, so the wire response is
 * {"data":{"status":"ok"},"meta":{}} — the handler never composes the envelope itself.
 */
@Controller("health")
export class HealthController {
  @Get()
  check(): { status: string } {
    return { status: "ok" };
  }
}
