FROM node:20-alpine AS base
WORKDIR /workspace

COPY package.json tsconfig.base.json ./
COPY apps/dashboard/package.json ./apps/dashboard/package.json

RUN npm install

COPY apps/dashboard ./apps/dashboard

RUN npm --workspace @vcloudrunner/dashboard run build

FROM node:20-alpine AS runtime
WORKDIR /workspace
ENV NODE_ENV=production

RUN apk add --no-cache wget

COPY --from=base /workspace/package.json ./package.json
COPY --from=base /workspace/node_modules ./node_modules
COPY --from=base /workspace/apps/dashboard/package.json ./apps/dashboard/package.json
COPY --from=base /workspace/apps/dashboard/.next ./apps/dashboard/.next
COPY --from=base /workspace/apps/dashboard/next.config.mjs ./apps/dashboard/next.config.mjs

EXPOSE 3001
CMD ["npm", "--workspace", "@vcloudrunner/dashboard", "run", "start"]
