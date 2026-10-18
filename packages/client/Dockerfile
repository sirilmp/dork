# --- Build stage -------------------------------------------------------
FROM node:20-alpine AS build
WORKDIR /app

COPY package.json package-lock.json* ./
COPY packages/client/package.json packages/client/package.json
RUN npm install --workspace=packages/client --include-workspace-root

COPY packages/client packages/client
# VITE_API_URL defaults to a relative /api, proxied by nginx below, so no
# build-time value is required for the default docker-compose setup.
ARG VITE_API_URL=/api
ENV VITE_API_URL=$VITE_API_URL
RUN npm run build --workspace=packages/client

# --- Runtime stage: static files served by nginx -------------------------
FROM nginx:1.27-alpine AS runtime
COPY --from=build /app/packages/client/dist /usr/share/nginx/html
COPY packages/client/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
