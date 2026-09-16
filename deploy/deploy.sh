#!/bin/sh
set -eu

if [ "$#" -ne 1 ]; then
  echo "Usage: ./deploy/deploy.sh <image-tag>" >&2
  exit 64
fi

new_tag="$1"
case "$new_tag" in
  *[!A-Za-z0-9._-]*|'') echo "Invalid image tag." >&2; exit 64 ;;
esac

if [ ! -f .env ]; then
  echo "Missing VPS .env file. Start from deploy/production.env.example." >&2
  exit 78
fi

# `compose.sh` passes `.env` to `docker compose --env-file`, which reaches the containers but
# never this script's own shell — and `backup.sh` runs `pg_dump --username "$POSTGRES_USER"`
# directly, outside any container. Exporting every `.env` entry here is what makes that (and any
# other `.env` value a script in this directory reads directly) available to them.
set -a
# shellcheck disable=SC1091
. ./.env
set +a

current_tag="$(sed -n 's/^SAM_IMAGE_TAG=//p' .env | tail -n 1)"
if [ -z "$current_tag" ]; then
  echo "SAM_IMAGE_TAG is missing from .env." >&2
  exit 78
fi

export SAM_IMAGE_TAG="$current_tag"
sh ./deploy/backup.sh

export SAM_IMAGE_TAG="$new_tag"
sh ./deploy/compose.sh pull api web cms
sh ./deploy/compose.sh --profile operations run --rm platform-migrate
sh ./deploy/compose.sh --profile operations run --rm cms-migrate
if ! sh ./deploy/compose.sh up -d --remove-orphans --wait --wait-timeout 180; then
  echo "Health checks failed; restoring application image tag $current_tag." >&2
  export SAM_IMAGE_TAG="$current_tag"
  sh ./deploy/compose.sh up -d api web cms nginx --wait --wait-timeout 180
  exit 1
fi

mkdir -p deploy/state
printf '%s\n' "$current_tag" > deploy/state/previous-image-tag
printf '%s\n' "$new_tag" > deploy/state/current-image-tag
sed -i "s/^SAM_IMAGE_TAG=.*/SAM_IMAGE_TAG=$new_tag/" .env
echo "Deployment completed with image tag $new_tag."
