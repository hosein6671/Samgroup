# Nginx configuration

Nginx runs from the **official image** with this directory bind-mounted — it has no Dockerfile. Proxy configuration is operational data, so changing a routing rule is an edit plus a restart, never an image rebuild (ADR-005, approved implementation decision 2).

## Files

| File                                             | Processed?                      | Purpose                                                     |
| ------------------------------------------------ | ------------------------------- | ----------------------------------------------------------- |
| `templates/default.conf.template`                | **Yes** — suffix is `.template` | HTTP proxy. Drives local development today                  |
| `templates/production-tls.conf.template.example` | **No** — trailing `.example`    | Prepared TLS configuration for the VPS. Inert until renamed |

## No hostname is hard-coded

nginx cannot read environment variables on its own. The official image compensates by running `envsubst` over `/etc/nginx/templates/*.template` at container start and writing the result into `/etc/nginx/conf.d/`. Every host and upstream in these templates comes from the environment:

| Template variable   | Sourced from (`.env`) | Local value                 | Production value |
| ------------------- | --------------------- | --------------------------- | ---------------- |
| `SAM_PUBLIC_HOST`   | `PUBLIC_HOST`         | `localhost`                 | `samgp.com`      |
| `SAM_CMS_HOST`      | `CMS_HOST`            | `cms.localhost`             | `cms.samgp.com`  |
| `SAM_WEB_UPSTREAM`  | `WEB_UPSTREAM`        | `host.docker.internal:3000` | `web:3000`       |
| `SAM_API_UPSTREAM`  | `API_UPSTREAM`        | `host.docker.internal:3001` | `api:3000`       |
| `SAM_CMS_UPSTREAM`  | `CMS_UPSTREAM`        | `host.docker.internal:3002` | `cms:3000`       |
| `SAM_PUBLIC_BUCKET` | `MINIO_PUBLIC_BUCKET` | `sam-public`                | `sam-public`     |

`docker-compose.yml` renames the unprefixed `.env` values to `SAM_*` at the service boundary, so `.env` keeps one source of truth and the prefix stays an implementation detail of this container.

**`NGINX_ENVSUBST_FILTER` is set to `^SAM_`, and that matters.** Without a filter, `envsubst` substitutes _every_ `$NAME` it finds — including nginx's own runtime variables, so `$host`, `$remote_addr`, and `$proxy_add_x_forwarded_for` would be replaced with empty strings and the proxy would silently forward broken headers. Restricting substitution to `SAM_*` leaves nginx's variables untouched. Any new template variable must therefore use the `SAM_` prefix.

## Local development needs no DNS

The public server block is `default_server` and also matches `${SAM_PUBLIC_HOST}`, so it answers on `http://localhost:${HTTP_PORT}` whatever the host header says. Browsers resolve `cms.localhost` — and any `*.localhost` name — to the loopback address without a hosts-file entry, so the CMS host works locally too. Nothing here depends on `samgp.com` resolving.

## Why upstreams go through nginx variables

```nginx
set $web_upstream ${SAM_WEB_UPSTREAM};
proxy_pass $web_upstream;
```

`envsubst` fills in `${SAM_WEB_UPSTREAM}`; `$web_upstream` survives as a real nginx variable. This is not decoration. With a literal `proxy_pass http://web:3000`, nginx resolves the name **at startup** and refuses to start if it fails — which would make nginx unbootable today, since no application exists, and would take the whole proxy down whenever one app container restarted. Resolving per request means nginx starts cleanly and returns `502` only for routes whose backend is genuinely absent.

## Current state: HTTP only, deliberately

TLS is not enabled in either template. The production domain is confirmed (`samgp.com`, `cms.samgp.com`) but no VPS exists and DNS does not yet point anywhere, so no certificate can be issued. Local development runs plain HTTP.

**One consequence to carry forward:** cookies marked `Secure` are not sent over plain HTTP. That is harmless now — no application sets a cookie, because no application exists. It stops being harmless when authentication lands (`SECURITY.md`: the refresh token is an httpOnly cookie). **Revisit local TLS before the auth work in `PROJECT_HANDOFF.md` §5 step 5**, or dev and production will diverge on exactly the behaviour that is hardest to debug remotely. Options then: `mkcert`-issued local certificates, or a self-signed pair in a git-ignored directory.

## Activating TLS (VPS setup phase)

1. Point `A` records for `samgp.com` and `cms.samgp.com` at the VPS.
2. Set `PUBLIC_HOST`, `CMS_HOST`, and the three upstreams to their production values in the VPS `.env` — the templates need no editing.
3. Start nginx with the **HTTP-only** template so the ACME challenge can be answered. Certbot's HTTP-01 needs port 80 responding _before_ any certificate exists, and nginx will not start while `ssl_certificate` points at a missing file. This ordering is the single most common way this setup fails.
4. Run certbot in webroot mode against `/var/www/certbot`, issuing certificates for both hosts.
5. Rename `production-tls.conf.template.example` to `production-tls.conf.template`, remove `default.conf.template`, and restart nginx.
6. Only after confirming HTTPS works end to end, uncomment the HSTS header — browsers cache it for `max-age`, so enabling it early is painful to undo.

The certbot service, its renewal schedule, and the shared `letsencrypt` volume belong to the VPS deployment work, not to this local-only stack.
