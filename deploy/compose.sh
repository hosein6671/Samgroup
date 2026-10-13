#!/bin/sh
set -eu

# The mail server (docker-compose.mail.yml) is part of this deployment when its overlay is present.
# Leaving it out would make `up --remove-orphans` remove the mailserver and roundcube containers.
if [ -f docker-compose.mail.yml ]; then
  set -- -f docker-compose.mail.yml "$@"
fi

docker compose --env-file .env -f docker-compose.yml -f docker-compose.prod.yml "$@"
