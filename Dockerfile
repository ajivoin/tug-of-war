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

# data.json defaults to the working directory; point DATA_FILE at a mounted
# volume to persist game state across container restarts.
ENV DATA_FILE=/data/data.json
RUN mkdir -p /data && chown node:node /data
VOLUME /data

USER node

CMD ["node", "src/index.ts"]
