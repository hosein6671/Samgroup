FROM node:24-bookworm-slim AS build

ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
WORKDIR /workspace

RUN corepack enable && corepack prepare pnpm@11.20.0 --activate

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY apps/cms/package.json apps/cms/package.json
COPY packages/config/package.json packages/config/package.json
COPY packages/types/package.json packages/types/package.json
COPY packages/ui/package.json packages/ui/package.json
COPY packages/tsconfig/package.json packages/tsconfig/package.json
COPY packages/eslint-config/package.json packages/eslint-config/package.json
RUN --mount=type=cache,id=pnpm-api,target=/pnpm/store \
    HUSKY=0 pnpm install --frozen-lockfile --store-dir /pnpm/store --network-concurrency 8 --fetch-timeout 180000

COPY docker/apps/prepare-shared-runtime.cjs docker/apps/prepare-shared-runtime.cjs
COPY apps/cms apps/cms
COPY packages/types packages/types
COPY packages/tsconfig packages/tsconfig
RUN --mount=type=cache,id=pnpm-api,target=/pnpm/store \
    DATABASE_URI=postgresql://cms:build-only@localhost:5432/sam_cms \
    PAYLOAD_SECRET=build-only-not-a-runtime-secret-000000 \
    CMS_MEDIA_BUCKET=sam-public \
    CMS_MEDIA_ENDPOINT=http://localhost:9000 \
    CMS_MEDIA_ACCESS_KEY_ID=build-only \
    CMS_MEDIA_SECRET_ACCESS_KEY=build-only \
    pnpm --filter @sam-group/cms build \
    && node docker/apps/prepare-shared-runtime.cjs cms \
    && pnpm --prefer-offline --network-concurrency 8 --fetch-timeout 180000 --filter @sam-group/cms deploy --legacy /release/cms-cli \
    && node docker/apps/prepare-shared-runtime.cjs cms /release/cms-cli

FROM node:24-bookworm-slim AS runtime

ENV NODE_ENV=production
ENV HOSTNAME=0.0.0.0
ENV PORT=3000
WORKDIR /app

RUN groupadd --system --gid 1001 nodejs \
    && useradd --system --uid 1001 --gid nodejs cms

COPY --from=build --chown=cms:nodejs /workspace/apps/cms/.next/standalone ./
COPY --from=build --chown=cms:nodejs /workspace/apps/cms/.next/static ./apps/cms/.next/static
COPY --from=build --chown=cms:nodejs /release/cms-cli /cms-cli

USER cms
EXPOSE 3000
CMD ["node", "apps/cms/server.js"]
