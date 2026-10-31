# ADR-031: Release images are served to the VPS from a registry on the VPS

## Status

**Accepted, 1 November 2026.** The owner chose this option on 1 November 2026, over an Iranian
hosted registry (ArvanCloud), a manual image file copied with `scp`, and a proxy for Docker.

**Amends** ADR-005 (single-VPS Docker deployment) only in where the VPS pulls release images from.
Deployment stays manual (`deploy/deploy.sh`, run by a person); nothing here deploys automatically.

## Context

- The release workflow builds the `api`, `web`, `cms` and deploy-bundle images on GitHub and
  publishes them to GHCR under the commit SHA. `deploy/deploy.sh` pulls them on the VPS.
- On 31 October 2026 the VPS could no longer download them. `ghcr.io` and
  `pkg-containers.githubusercontent.com` answered small HTTPS requests in under two seconds, but
  every image layer stayed at `Pulling fs layer`, for our images and after a Docker restart; the
  first attempt had ended in `connection reset by peer` from GitHub's storage. The release could not
  be deployed, although the site itself kept running the previous release.
- The same VPS downloaded `registry:2` from ArvanCloud's Docker Hub mirror
  (`docker.arvancloud.ir`) without trouble, and GitHub's runners reach the VPS over HTTPS (the
  public site is served from it).

## Decision

1. **A private registry runs on the VPS** (`registry:2`, from the ArvanCloud mirror), started by
   `deploy/registry.sh`. It listens on `PUBLIC_HOST:5443` with the site's existing Let's Encrypt
   certificate and htpasswd (bcrypt) login. Images live in the `sam_registry_data` volume. It is a
   plain `docker run --restart unless-stopped`, outside the compose stack, so a deploy never
   recreates it and it can start before any release image is on the server. A certbot deploy hook
   restarts it after a certificate renewal.
2. **The release workflow copies each published release to it.** A separate workflow,
   `mirror-images.yml`, runs after "Release images" succeeds and copies the four images unchanged,
   under the same SHA, with `docker buildx imagetools create` and retries. It can be re-run by hand
   for any SHA. Without its three secrets (`SAM_REGISTRY`, `SAM_REGISTRY_USER`,
   `SAM_REGISTRY_PASSWORD`) it does nothing.
3. **The VPS pulls from it** by setting `SAM_IMAGE_PREFIX=<PUBLIC_HOST>:5443/sam-group-platform` in
   its `.env` and logging in once. `deploy.sh`, `sync-config.sh` and `rollback.sh` are unchanged:
   they already read the prefix from `.env`. GHCR remains the build's own registry and the source
   of every copy.

## Consequences

- A deploy no longer depends on downloading from GitHub on the VPS. It depends on GitHub's runners
  uploading to the VPS, which happens once per release, is retried, and can be repeated by hand.
- One more process on the VPS and one more open port (5443), protected by TLS and a login. The
  registry holds only release images, never secrets or data.
- Disk use grows with every release, less what layers share. Old tags are not pruned yet; a pruning
  routine is a follow-up, to be added before the disk becomes a concern.
- Rollback (`deploy/rollback.sh`) works as before for any SHA that was mirrored.

## Alternatives considered

- **Iranian hosted registry (ArvanCloud Container Registry).** Same flow without a process on the
  VPS, but a paid external account and one more provider. Rejected by the owner.
- **Image files copied by hand (`docker save`, `scp`, `docker load`).** No new component, but every
  deploy becomes a manual transfer of hundreds of megabytes.
- **A proxy for the Docker daemon.** Needs a server outside Iran and fails whenever the proxy does.
- **Building on the VPS.** Depends on npm and Docker Hub from the VPS, which are also unreliable
  there, and puts a full build on the production machine.
