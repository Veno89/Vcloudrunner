FROM node:20-alpine AS base
WORKDIR /workspace

COPY package.json tsconfig.base.json ./
COPY packages/shared-types/package.json ./packages/shared-types/package.json
COPY apps/api/package.json ./apps/api/package.json

RUN npm install

COPY packages/shared-types ./packages/shared-types
COPY apps/api ./apps/api

RUN npm --workspace @vcloudrunner/shared-types run build \
  && npm --workspace @vcloudrunner/api run build

FROM node:20-alpine AS runtime
WORKDIR /workspace
ENV NODE_ENV=production

RUN apk add --no-cache wget

COPY --from=base /workspace/package.json ./package.json
COPY --from=base /workspace/node_modules ./node_modules
COPY --from=base /workspace/packages/shared-types/package.json ./packages/shared-types/package.json
COPY --from=base /workspace/packages/shared-types/dist ./packages/shared-types/dist
COPY --from=base /workspace/apps/api/package.json ./apps/api/package.json
COPY --from=base /workspace/apps/api/dist ./apps/api/dist

EXPOSE 4000
CMD ["npm", "--workspace", "@vcloudrunner/api", "run", "start"]
