FROM node:24-bookworm-slim AS build

ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
ENV DATABASE_URL=postgresql://build:build@localhost:5432/sam_platform
WORKDIR /workspace

RUN apt-get update \
    && apt-get install -y --no-install-recommends openssl \
    && rm -rf /var/lib/apt/lists/* \
    && corepack enable \
    && corepack prepare pnpm@11.20.0 --activate

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json prisma.config.ts ./
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

COPY prisma prisma
COPY docker/apps/prepare-shared-runtime.cjs docker/apps/prepare-shared-runtime.cjs
COPY apps/api apps/api
COPY packages/types packages/types
COPY packages/tsconfig packages/tsconfig
RUN --mount=type=cache,id=pnpm-api,target=/pnpm/store \
    pnpm exec prisma generate \
    && pnpm --filter @sam-group/api build \
    && node docker/apps/prepare-shared-runtime.cjs api \
    && pnpm --prefer-offline --network-concurrency 8 --fetch-timeout 180000 --filter @sam-group/api deploy --prod --legacy /release/api \
    && node docker/apps/prepare-shared-runtime.cjs api /release/api \
    && cp -R apps/api/dist /release/api/dist \
    && cp -R prisma /release/api/prisma \
    && cp prisma.config.ts /release/api/prisma.config.ts

FROM node:24-bookworm-slim AS runtime

ENV NODE_ENV=production
WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends openssl \
    && rm -rf /var/lib/apt/lists/* \
    && groupadd --system --gid 1001 nodejs \
    && useradd --system --uid 1001 --gid nodejs api

COPY --from=build --chown=api:nodejs /release/api ./

USER api
EXPOSE 3000
CMD ["node", "--enable-source-maps", "dist/main.js"]
