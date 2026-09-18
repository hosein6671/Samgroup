import { NextResponse } from "next/server";

import type { NextRequest } from "next/server";

/**
 * `/media/*` inside `apps/web` itself — a proxy to the same MinIO object that nginx's own
 * `location /media/` block already serves, but reachable from a place nginx's block cannot help
 * with: `next/image`'s built-in optimizer.
 *
 * ── Why this exists ─────────────────────────────────────────────────────────
 *
 * nginx's `/media/` block (`docker/nginx/templates/production-tls.conf.template.example`)
 * `rewrite`s straight to MinIO and never reaches the `web` container — the fastest path for a real
 * browser, and unchanged by this file. But `next/image` does not ask the browser to fetch the
 * original: given a relative `src`, its optimizer performs its OWN fetch, from inside the `web`
 * server process, against `web`'s own origin. That origin had no route for `/media/*` at all —
 * confirmed against production itself, `curl` on `/media/<a real, 200-reachable object>` through
 * `/_next/image` returned 400 ("received null") — because only nginx, not `web`, knew how to reach
 * MinIO for that path. This route is what gives `web` that same knowledge, so its self-fetch can
 * resolve.
 *
 * Nothing stops an external request from reaching this route directly instead of through nginx's
 * shortcut — nginx still wins that race in production because it intercepts `/media/` before the
 * request ever reaches `web` — but it would serve the same bytes if it did: the bucket this proxies
 * is MinIO's public one, already configured for unauthenticated reads (`minio-init`'s
 * `mc anonymous set download`), so there is no access check to bypass.
 *
 * ── Runtime env, not build-time config ──────────────────────────────────────
 *
 * `MEDIA_PROXY_ENDPOINT`/`MEDIA_PROXY_BUCKET` are read from `process.env` inside the handler, the
 * same pattern `lib/api-client.ts`'s `resolveBaseUrl` uses for `API_INTERNAL_URL` — deliberately,
 * over a `next.config.ts` `rewrites()` entry, because `output: "standalone"` leaves it unconfirmed
 * whether a `rewrites()` destination is frozen at image-build time (before
 * `docker-compose.prod.yml`'s environment is available) or resolved fresh at boot. Reading
 * `process.env` inside a request handler has no such ambiguity.
 */

const UPSTREAM_TIMEOUT_MS = 10_000;

function resolveEndpoint(): string | null {
  const raw = process.env.MEDIA_PROXY_ENDPOINT?.trim();

  if (raw === undefined || raw === "") {
    return null;
  }

  try {
    const parsed = new URL(raw);

    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return null;
    }

    return raw.replace(/\/+$/, "");
  } catch {
    return null;
  }
}

function resolveBucket(): string | null {
  const raw = process.env.MEDIA_PROXY_BUCKET?.trim();

  return raw === undefined || raw === "" ? null : raw;
}

/** Headers worth forwarding in both directions; anything else is proxy/runtime noise. */
const FORWARDED_RESPONSE_HEADERS = ["content-type", "content-length", "etag", "last-modified"];

async function proxy(request: NextRequest, path: readonly string[]): Promise<Response> {
  const endpoint = resolveEndpoint();
  const bucket = resolveBucket();

  if (endpoint === null || bucket === null) {
    return NextResponse.json(
      { error: { code: "MEDIA_PROXY_UNCONFIGURED", message: "Media proxy is not configured." } },
      { status: 502 },
    );
  }

  // Each segment is re-encoded on its own: Next has already decoded `params.path`, and joining
  // decoded segments with a raw `/` would let one segment smuggle its own `/` or `..` into the
  // upstream path.
  const upstreamUrl = `${endpoint}/${bucket}/${path.map(encodeURIComponent).join("/")}`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);

  try {
    const upstreamResponse = await fetch(upstreamUrl, {
      method: request.method,
      signal: controller.signal,
      cache: "no-store",
    });

    const headers = new Headers();

    for (const name of FORWARDED_RESPONSE_HEADERS) {
      const value = upstreamResponse.headers.get(name);

      if (value !== null) {
        headers.set(name, value);
      }
    }

    // Matches nginx's own `Cache-Control` for this same object, so behavior does not depend on
    // which of the two paths served a given request.
    headers.set("Cache-Control", "public, max-age=3600");

    return new NextResponse(upstreamResponse.body, {
      status: upstreamResponse.status,
      headers,
    });
  } catch {
    return NextResponse.json(
      { error: { code: "MEDIA_PROXY_UNREACHABLE", message: "Could not reach media storage." } },
      { status: 502 },
    );
  } finally {
    clearTimeout(timeout);
  }
}

type RouteContext = { readonly params: Promise<{ readonly path: string[] }> };

export async function GET(request: NextRequest, { params }: RouteContext): Promise<Response> {
  const { path } = await params;

  return proxy(request, path);
}

export async function HEAD(request: NextRequest, { params }: RouteContext): Promise<Response> {
  const { path } = await params;

  return proxy(request, path);
}
