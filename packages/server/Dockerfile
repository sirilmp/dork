# --- Build stage -------------------------------------------------------
FROM node:20-alpine AS build
WORKDIR /app

# Copy workspace manifests first for better layer caching.
COPY package.json package-lock.json* ./
COPY packages/server/package.json packages/server/package.json
RUN npm install --workspace=packages/server --include-workspace-root

COPY packages/server packages/server
# Prisma client must be generated before the TypeScript build since generated
# types are imported by the application code.
RUN npm run prisma:generate --workspace=packages/server
RUN npm run build --workspace=packages/server

# --- Runtime stage -------------------------------------------------------
FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production

COPY package.json package-lock.json* ./
COPY packages/server/package.json packages/server/package.json
# Keep devDependencies here: the entrypoint runs `prisma migrate deploy` and
# the `tsx`-based seed script at container start, both of which are listed as
# devDependencies for local DX. Trading some image size for a simpler,
# single-install story.
RUN npm install --workspace=packages/server --include-workspace-root

COPY --from=build /app/packages/server/dist packages/server/dist
COPY --from=build /app/packages/server/prisma packages/server/prisma
COPY --from=build /app/node_modules/.prisma node_modules/.prisma
COPY packages/server/docker-entrypoint.sh packages/server/docker-entrypoint.sh
RUN chmod +x packages/server/docker-entrypoint.sh

WORKDIR /app/packages/server
EXPOSE 4000
ENTRYPOINT ["./docker-entrypoint.sh"]
CMD ["node", "dist/index.js"]
