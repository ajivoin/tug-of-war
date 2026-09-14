FROM node:24-alpine

ENV NODE_ENV=production

WORKDIR /app

# Install production dependencies first so this layer is cached across source changes.
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# Source. Node 24 strips TypeScript types natively, so there is no build step
# and no dist/ - the .ts files are what runs. Boss images resolve relative to
# the module via import.meta.dirname, not the working directory.
COPY . .

# data.db defaults to the working directory; point DATA_FILE at a mounted
# volume to persist game state across container restarts. LEGACY_DATA_FILE
# points at where an existing data.json (from before the SQLite migration)
# would already be sitting in that same volume - it is imported into
# DATA_FILE automatically, once, on the first boot that finds no DATA_FILE
# yet.
ENV DATA_FILE=/data/data.db
ENV LEGACY_DATA_FILE=/data/data.json
RUN mkdir -p /data && chown node:node /data
VOLUME /data

USER node

CMD ["node", "src/index.ts"]
