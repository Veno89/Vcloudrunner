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

COPY --from=base /workspace/package.json ./package.json
COPY --from=base /workspace/node_modules ./node_modules
COPY --from=base /workspace/apps/dashboard/package.json ./apps/dashboard/package.json
COPY --from=base /workspace/apps/dashboard/.next ./apps/dashboard/.next
COPY --from=base /workspace/apps/dashboard/public ./apps/dashboard/public
COPY --from=base /workspace/apps/dashboard/next.config.ts ./apps/dashboard/next.config.ts

EXPOSE 3001
CMD ["npm", "--workspace", "@vcloudrunner/dashboard", "run", "start"]
