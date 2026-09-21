/**
 * How many reverse-proxy hops `apps/api` trusts when resolving a client's address.
 *
 * ── Why 1, and why that number is safe rather than assumed ──────────────────
 *
 * ADR-005's topology puts exactly **one** proxy — nginx — directly in front of this process, and
 * nothing else: no CDN, no load balancer. The Turnstile widget is the platform's one deliberate
 * third-party contact (DEVOPS.md "Anti-spam"), and it is not in the request path to `apps/api`.
 *
 * nginx's `X-Forwarded-For` directive is `$proxy_add_x_forwarded_for`
 * (`docker/nginx/templates/production-tls.conf.template.example`), which **appends** nginx's own
 * view of the immediate connecting peer to whatever header value already arrived — it never trusts
 * or relays a caller-supplied value as-is. That is what makes trusting exactly one hop safe rather
 * than a spoofing surface: Express's numeric `trust proxy` mode consumes the header from the
 * rightmost entry inward, one entry per trusted hop, and stops. With this set to `1`, `req.ip`
 * always resolves to the single entry nginx itself appended — a client that forges extra
 * `X-Forwarded-For` entries only pollutes positions further left, which a trust count of `1` never
 * reaches. Proven in `trust-proxy.spec.ts` against a real Express listener, not asserted from
 * reasoning alone.
 *
 * ── What this fixes ───────────────────────────────────────────────────────────
 *
 * Before this was set, `req.ip` behind nginx resolved to **nginx's own address** for every
 * request — Express ignores `X-Forwarded-For` entirely until `trust proxy` says to read it. That
 * collapsed every visitor onto one shared bucket wherever `req.ip` is the tracker: the form
 * submission and login rate limiters (`throttle.config.ts`) budgeted the whole site's traffic as
 * one client, rather than per visitor.
 *
 * ── Raising this number ───────────────────────────────────────────────────────
 *
 * Only if a second proxy is ever placed in front of nginx (a CDN, a load balancer) — and only
 * after confirming that hop also *appends* rather than *trusts* its own inbound header, or the
 * same spoofing this setting exists to prevent reopens one layer further out.
 */
export const TRUST_PROXY_HOPS = 1;
