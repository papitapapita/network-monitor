# Backend image for one customer install (docs/operations/new-customer.md).
# On start it applies pending migrations, then runs the backend.

FROM node:24-bookworm-slim AS builder
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npx prisma generate && npm run build

FROM node:24-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production NPM_CONFIG_UPDATE_NOTIFIER=false
# ping for an install on the monitored network (SERVER_ON_SITE); harmless off site
RUN apt-get update \
  && apt-get install -y --no-install-recommends iputils-ping openssl \
  && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
# The Prisma CLI is a dev dependency; the container needs it for migrate deploy,
# pinned to the version the lockfile resolved.
RUN npm ci --omit=dev \
  && npm install --no-save "prisma@$(node -p "require('./package-lock.json').packages['node_modules/prisma'].version")" \
  && npm cache clean --force
COPY prisma ./prisma
COPY prisma.config.ts ./
COPY --from=builder /app/dist/main.js ./dist/main.js
RUN mkdir logs && chown node:node logs
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/health').then(r=>process.exit(r.ok?0:1),()=>process.exit(1))"
CMD ["sh", "-c", "npx prisma migrate deploy && exec node dist/main.js"]
