#!/bin/sh
set -eu

umask 077
timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
backup_dir="${SAM_BACKUP_DIR:-./deploy/backups}/$timestamp"
mkdir -p "$backup_dir"

sh ./deploy/compose.sh exec -T postgres pg_dump \
  --username "$POSTGRES_USER" --format=custom "$POSTGRES_PLATFORM_DB" \
  > "$backup_dir/sam_platform.dump"
sh ./deploy/compose.sh exec -T postgres pg_dump \
  --username "$POSTGRES_USER" --format=custom "$POSTGRES_CMS_DB" \
  > "$backup_dir/sam_cms.dump"
mkdir -p "$backup_dir/object-storage"
sh ./deploy/compose.sh cp minio:/data/. "$backup_dir/object-storage"

printf '%s\n' "$SAM_IMAGE_TAG" > "$backup_dir/image-tag"
printf 'Database backup created at %s\n' "$backup_dir"
printf '%s\n' "$backup_dir"
