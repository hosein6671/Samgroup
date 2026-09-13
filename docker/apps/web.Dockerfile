FROM node:24-bookworm-slim AS build

ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
WORKDIR /workspace
RUN corepack enable && corepack prepare pnpm@11.20.0 --activate

ARG API_INTERNAL_URL
ARG SITE_PUBLIC_URL=https://samgp.com
ARG SITE_SEO_INDEXING=false
ARG NEXT_PUBLIC_TURNSTILE_SITE_KEY
ENV API_INTERNAL_URL=$API_INTERNAL_URL
ENV SITE_PUBLIC_URL=$SITE_PUBLIC_URL
ENV SITE_SEO_INDEXING=$SITE_SEO_INDEXING
ENV NEXT_PUBLIC_TURNSTILE_SITE_KEY=$NEXT_PUBLIC_TURNSTILE_SITE_KEY
RUN test -n "$API_INTERNAL_URL"

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

COPY apps/web apps/web
COPY packages/config packages/config
COPY packages/types packages/types
COPY packages/ui packages/ui
COPY packages/tsconfig packages/tsconfig
RUN pnpm --filter @sam-group/web build

FROM node:24-bookworm-slim AS runtime

ENV NODE_ENV=production
ENV HOSTNAME=0.0.0.0
ENV PORT=3000
WORKDIR /app

RUN groupadd --system --gid 1001 nodejs \
    && useradd --system --uid 1001 --gid nodejs nextjs

COPY --from=build --chown=nextjs:nodejs /workspace/apps/web/.next/standalone ./
COPY --from=build --chown=nextjs:nodejs /workspace/apps/web/.next/static ./apps/web/.next/static
COPY --from=build --chown=nextjs:nodejs /workspace/apps/web/public ./apps/web/public

USER nextjs
EXPOSE 3000
CMD ["node", "apps/web/server.js"]
