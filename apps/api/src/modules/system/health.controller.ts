import { Controller, Get } from "@nestjs/common";

/**
 * GET /api/v1/health — liveness/readiness for Docker health checks
 * (API_CONTRACT_FINAL.md §2.1).
 *
 * Returns an unwrapped body. The {data, meta} envelope interceptor arrives in the next
 * step; nothing but a container probe consumes this shape until then.
 */
@Controller("health")
export class HealthController {
  @Get()
  check(): { status: string } {
    return { status: "ok" };
  }
}
