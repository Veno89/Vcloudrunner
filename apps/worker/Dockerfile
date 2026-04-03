FROM node:20-alpine AS base
WORKDIR /workspace

COPY package.json tsconfig.base.json ./
COPY packages/shared-types/package.json ./packages/shared-types/package.json
COPY apps/worker/package.json ./apps/worker/package.json

RUN npm install

COPY packages/shared-types ./packages/shared-types
COPY apps/worker ./apps/worker

RUN npm --workspace @vcloudrunner/shared-types run build \
  && npm --workspace @vcloudrunner/worker run build

FROM node:20-alpine AS runtime
RUN apk add --no-cache git docker-cli
WORKDIR /workspace
ENV NODE_ENV=production

COPY --from=base /workspace/package.json ./package.json
COPY --from=base /workspace/node_modules ./node_modules
COPY --from=base /workspace/packages/shared-types/package.json ./packages/shared-types/package.json
COPY --from=base /workspace/packages/shared-types/dist ./packages/shared-types/dist
COPY --from=base /workspace/apps/worker/package.json ./apps/worker/package.json
COPY --from=base /workspace/apps/worker/dist ./apps/worker/dist

CMD ["npm", "--workspace", "@vcloudrunner/worker", "run", "start"]
