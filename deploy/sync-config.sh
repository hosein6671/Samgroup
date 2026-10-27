#!/bin/sh
# Brings the VPS's deployment files in line with a release: the compose files and deploy scripts
# published in that release's deploy bundle image (docker/apps/deploy-bundle.Dockerfile).
#
#   ./deploy/sync-config.sh <image-tag> --check   show what would change, change nothing
#   ./deploy/sync-config.sh <image-tag>           back up the current files, then install
#
# deploy.sh runs it on every deploy, so a change to docker-compose.prod.yml or a deploy script
# reaches the server with the images it belongs to instead of waiting for a hand edit.
#
# Never touched: .env, docker/nginx/templates, docker-compose.mail.yml, deploy/mailserver — the
# server keeps its own versions of those (see the bundle Dockerfile).
#
# Files are swapped with `mv` (a rename), so a script that is running — deploy.sh itself — keeps
# reading the version it started with; the new one is used from the next run.
set -eu

if [ "$#" -lt 1 ] || [ "$#" -gt 2 ]; then
  echo "Usage: ./deploy/sync-config.sh <image-tag> [--check]" >&2
  exit 64
fi
tag="$1"
mode="${2:-apply}"
case "$tag" in
  *[!A-Za-z0-9._-]*|'') echo "Invalid image tag." >&2; exit 64 ;;
esac
case "$mode" in
  apply|--check) ;;
  *) echo "Unknown option: $mode" >&2; exit 64 ;;
esac

prefix="$(sed -n 's/^SAM_IMAGE_PREFIX=//p' .env | tail -n 1)"
if [ -z "$prefix" ]; then
  echo "SAM_IMAGE_PREFIX is missing from .env." >&2
  exit 78
fi
image="$prefix/deploy:$tag"

work="$(mktemp -d)"
container=""
cleanup() {
  [ -n "$container" ] && docker rm -f "$container" >/dev/null 2>&1 || true
  rm -rf "$work"
}
trap cleanup EXIT

if ! docker pull --quiet "$image" >/dev/null 2>&1; then
  docker image inspect "$image" >/dev/null 2>&1 || {
    echo "Deploy bundle $image was not found. Wait for the release workflow to publish it." >&2
    exit 69
  }
fi
container="$(docker create "$image")"
docker cp "$container:/bundle/." "$work/"

files="docker-compose.yml docker-compose.prod.yml deploy/compose.sh deploy/deploy.sh deploy/backup.sh deploy/rollback.sh deploy/sync-config.sh deploy/product-content.sh"
changed=""
for file in $files; do
  [ -f "$work/$file" ] || { echo "Bundle is missing $file." >&2; exit 65; }
  if [ ! -f "$file" ] || ! cmp -s "$work/$file" "$file"; then
    changed="$changed $file"
  fi
done

if [ -z "$changed" ]; then
  echo "Deployment files already match $tag."
  exit 0
fi

if [ "$mode" = "--check" ]; then
  for file in $changed; do
    echo "=== $file"
    if [ -f "$file" ]; then diff -u "$file" "$work/$file" || true; else echo "(new file)"; fi
  done
  echo "Would update:$changed"
  exit 0
fi

backup="deploy/state/config/$(date -u +%Y%m%dT%H%M%SZ)"
mkdir -p "$backup/deploy"
for file in $changed; do
  [ -f "$file" ] && cp -p "$file" "$backup/$file"
done
for file in $changed; do
  cp "$work/$file" "$file.new"
  case "$file" in *.sh) chmod +x "$file.new" ;; esac
  mv -f "$file.new" "$file"
done
echo "Updated:$changed (previous versions in $backup)"
