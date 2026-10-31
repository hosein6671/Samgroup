#!/bin/sh
# The release-image registry on the VPS (ADR-031).
#
# The release workflow builds every image on GitHub and copies it here, so a deploy pulls from this
# server itself instead of from GitHub's image storage, which the VPS cannot download from reliably
# (31 October 2026: every layer stalled at "Pulling fs layer", while the same host answered small
# HTTPS requests). Nothing in the application depends on it: it only holds release images.
#
#   sh ./deploy/registry.sh setup <user>   create the login (asks for a password) and start it
#   sh ./deploy/registry.sh start          (re)start it, e.g. after a certificate renewal
#   sh ./deploy/registry.sh status         is it running, and does it answer
#
# Run from /opt/sam-group-platform. It reuses the site's Let's Encrypt certificate for
# SAM_PUBLIC_HOST and listens on SAM_REGISTRY_PORT (default 5443). It is a plain `docker run`
# rather than a compose service on purpose: it must keep running while `deploy.sh` recreates the
# stack, and it must be startable before any release image exists on this server.
set -eu

if [ ! -f .env ]; then
  echo "Run from /opt/sam-group-platform (no .env here)." >&2
  exit 78
fi
set -a
# shellcheck disable=SC1091
. ./.env
set +a

host="${PUBLIC_HOST:?Set PUBLIC_HOST in .env}"
port="${SAM_REGISTRY_PORT:-5443}"
image="${SAM_REGISTRY_IMAGE:-docker.arvancloud.ir/registry:2}"
state="deploy/state/registry"
name="sam-registry"

start() {
  [ -f "$state/htpasswd" ] || { echo "No login yet. Run: sh ./deploy/registry.sh setup <user>" >&2; exit 78; }
  [ -f "/etc/letsencrypt/live/$host/fullchain.pem" ] || {
    echo "No certificate at /etc/letsencrypt/live/$host." >&2
    exit 78
  }
  docker rm -f "$name" >/dev/null 2>&1 || true
  docker run -d --name "$name" --restart unless-stopped \
    -p "$port:5000" \
    -v sam_registry_data:/var/lib/registry \
    -v "$(pwd)/$state/htpasswd:/auth/htpasswd:ro" \
    -v /etc/letsencrypt:/etc/letsencrypt:ro \
    -e REGISTRY_AUTH=htpasswd \
    -e REGISTRY_AUTH_HTPASSWD_REALM="SAM release images" \
    -e REGISTRY_AUTH_HTPASSWD_PATH=/auth/htpasswd \
    -e REGISTRY_HTTP_TLS_CERTIFICATE="/etc/letsencrypt/live/$host/fullchain.pem" \
    -e REGISTRY_HTTP_TLS_KEY="/etc/letsencrypt/live/$host/privkey.pem" \
    -e REGISTRY_STORAGE_DELETE_ENABLED=true \
    "$image" >/dev/null
  echo "Registry running at $host:$port."
}

case "${1:-}" in
  setup)
    user="${2:?Usage: sh ./deploy/registry.sh setup <user>}"
    command -v htpasswd >/dev/null 2>&1 || { apt-get update -qq && apt-get install -y -qq apache2-utils; }
    mkdir -p "$state"
    # bcrypt is the only scheme the registry accepts; -i reads the password from stdin.
    printf "Password for %s: " "$user"
    stty -echo 2>/dev/null || true
    read -r password
    stty echo 2>/dev/null || true
    echo
    printf '%s' "$password" | htpasswd -iBc "$state/htpasswd" "$user" 2>/dev/null
    chmod 600 "$state/htpasswd"
    # A renewed certificate is only read when the registry starts.
    hook=/etc/letsencrypt/renewal-hooks/deploy/sam-registry
    if [ -d /etc/letsencrypt/renewal-hooks/deploy ]; then
      printf '#!/bin/sh\ndocker restart %s >/dev/null 2>&1 || true\n' "$name" >"$hook"
      chmod 755 "$hook"
    fi
    start
    ;;
  start) start ;;
  status)
    docker ps --filter "name=^$name\$" --format '{{.Names}} {{.Status}}'
    code="$(curl -s -o /dev/null -w '%{http_code}' --max-time 10 "https://$host:$port/v2/" || true)"
    echo "https://$host:$port/v2/ answered $code (401 means running and asking for the login)."
    ;;
  *)
    echo "Usage: sh ./deploy/registry.sh setup <user> | start | status" >&2
    exit 64
    ;;
esac
