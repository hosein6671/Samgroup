#!/bin/sh
# Publishes the reviewed product content (English and Persian, ADR-027), the Turbine oil grade
# display labels (ADR-028), the product classification corrections (ADR-030) and the application
# groups (ADR-029) on the VPS, in one guided run:
#
#   sh ./deploy/product-content.sh
#
# 1. Shows what would change, writing nothing.
# 2. Stops if anything is refused or in error.
# 3. Asks you to type "yes", then publishes through the same guarded CLIs, with the file hash the
#    check just printed.
#
# Safe to run again: every step skips what is already in place. The application groups are checked
# after the classification step has run, because the groups of a family follow its products.
# The content file is the one inside the current API image.
set -eu

run() { sh ./deploy/compose.sh --profile operations run --rm -T platform-migrate "$@"; }
FILE=/app/content/PRODUCT_CONTENT_IMPORT.json
CONTENT="dist/modules/catalog/import/content/content-import.run.js"
GRADES="dist/modules/catalog/grade-relabel/grade-relabel.run.js"
TAXONOMY="dist/modules/catalog/taxonomy-fix/taxonomy-fix.run.js"
GROUPS="dist/modules/catalog/application-groups-seed/application-groups-seed.run.js"

echo "== 1/4 Product content — check only"
if ! check="$(run node "$CONTENT" --file "$FILE" 2>&1)"; then
  echo "$check"
  echo
  echo "Stopped: some products are refused or in error. Nothing was written."
  exit 1
fi
echo "$check"
hash="$(echo "$check" | sed -n 's/^SHA-256 *//p')"

echo
echo "== 2/4 Turbine oil grade labels — check only"
relabel=yes
if ! grades="$(run node "$GRADES" 2>&1)"; then
  echo "$grades"
  echo "Grade labels will be skipped."
  relabel=no
else
  echo "$grades"
fi

echo
echo "== 3/4 Product classification — check only"
if ! taxonomy="$(run node "$TAXONOMY" 2>&1)"; then
  echo "$taxonomy"
  echo
  echo "Stopped: the classification check failed. Nothing was written."
  exit 1
fi
echo "$taxonomy"

echo
echo "== 4/4 Application groups are checked after step 3 is written."
echo
printf 'Type yes to publish the above: '
read -r answer
[ "$answer" = "yes" ] || { echo "Cancelled. Nothing was written."; exit 0; }

sh ./deploy/compose.sh --profile operations run --rm -T \
  -e SAM_ALLOW_PRODUCT_CONTENT_IMPORT=true platform-migrate \
  node "$CONTENT" --file "$FILE" --apply --confirm-target sam_platform \
  --expect-sha256 "$hash" --operator "${SAM_OPERATOR:-$(whoami)}"

if [ "$relabel" = yes ]; then
  sh ./deploy/compose.sh --profile operations run --rm -T \
    -e SAM_ALLOW_GRADE_RELABEL=true platform-migrate \
    node "$GRADES" --apply --confirm-target sam_platform
fi
sh ./deploy/compose.sh --profile operations run --rm -T \
  -e SAM_ALLOW_TAXONOMY_FIX=true platform-migrate \
  node "$TAXONOMY" --apply --confirm-target sam_platform

echo
echo "== 4/4 Application groups"
if ! seed="$(run node "$GROUPS" 2>&1)"; then
  echo "$seed"
  echo "Stopped before the groups: steps 1-3 are written, nothing of step 4."
  exit 1
fi
echo "$seed"
sh ./deploy/compose.sh --profile operations run --rm -T \
  -e SAM_ALLOW_APPLICATION_GROUP_SEED=true platform-migrate \
  node "$GROUPS" --apply --confirm-target sam_platform
echo "Done."
