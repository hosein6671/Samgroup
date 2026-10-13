# The deployment files of one release, published next to its api/web/cms images under the same
# commit SHA, so the VPS can take the compose files and deploy scripts that belong to the images it
# runs (deploy/sync-config.sh). Nothing in it runs: it is a carrier, read with `docker create` +
# `docker cp`.
#
# Only files the repository is the source of truth for. Deliberately NOT included, because the VPS
# holds its own versions: .env (secrets), docker/nginx/templates (the live TLS template is
# server-specific), docker-compose.mail.yml and deploy/mailserver (the mail server's live config).
FROM scratch
COPY docker-compose.yml docker-compose.prod.yml /bundle/
COPY deploy/compose.sh deploy/deploy.sh deploy/backup.sh deploy/rollback.sh deploy/sync-config.sh /bundle/deploy/
# `docker create` refuses an image with no command; this one is never started.
CMD ["/bundle"]
