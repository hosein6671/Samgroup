#!/bin/sh
set -eu

if [ "$#" -eq 1 ]; then
  target_tag="$1"
elif [ -f deploy/state/previous-image-tag ]; then
  target_tag="$(cat deploy/state/previous-image-tag)"
else
  echo "Usage: ./deploy/rollback.sh <image-tag>" >&2
  exit 64
fi

case "$target_tag" in
  *[!A-Za-z0-9._-]*|'') echo "Invalid image tag." >&2; exit 64 ;;
esac

export SAM_IMAGE_TAG="$target_tag"
sh ./deploy/compose.sh pull api web cms
sh ./deploy/compose.sh up -d api web cms nginx --wait --wait-timeout 180
sed -i "s/^SAM_IMAGE_TAG=.*/SAM_IMAGE_TAG=$target_tag/" .env

echo "Application containers now use $target_tag. Database changes were not reversed."
