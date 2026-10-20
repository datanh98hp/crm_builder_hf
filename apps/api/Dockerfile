# syntax=docker/dockerfile:1
# Build context is the repository root (see deploy/compose/docker-compose.yml).
FROM node:22-slim AS build
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /repo
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/
RUN npm ci
COPY apps/api apps/api
RUN npm run prisma:generate -w @buildcrm/api && npm run build -w @buildcrm/api

FROM node:22-slim AS runtime
RUN apt-get update && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*
ENV NODE_ENV=production
WORKDIR /repo
COPY --from=build --chown=node:node /repo /repo
USER node
WORKDIR /repo/apps/api
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=3s --retries=3 CMD node -e "fetch('http://127.0.0.1:3000/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "dist/main.js"]
