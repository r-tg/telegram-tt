# syntax=docker/dockerfile:1

# ---- Build stage ----
FROM node:24-alpine AS build

WORKDIR /app

# Install dependencies first to leverage layer caching.
# `npm ci` can skip the platform-specific optional native binding
# (e.g. `@rolldown/binding-linux-*-musl`) due to npm's optional-dependency bug
# (npm/cli#4828); the follow-up `npm install` reconciles it in, versions still
# pinned by the lockfile.
COPY package.json package-lock.json ./
RUN npm ci --include=optional \
  && npm install --include=optional --no-audit --no-fund --no-save

# Build the production bundle
COPY . .
# Passed from build.sh so the app can display the git revision (optional)
ARG HEAD=""
ENV HEAD=$HEAD
RUN npm run build:production

# ---- Runtime stage ----
FROM nginx:stable-alpine AS runtime

# `nginx/nginx.conf` is a `server { ... }` block, so it belongs in conf.d
COPY nginx/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
