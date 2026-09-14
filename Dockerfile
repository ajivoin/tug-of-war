FROM node:24-alpine

ENV NODE_ENV=production

WORKDIR /app

# Install production dependencies first so this layer is cached across source changes.
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# Source. Boss images are referenced by paths relative to the working directory
# (util/boss_images/...), so the app must run from /app.
COPY . .

# data.json defaults to the working directory; point DATA_FILE at a mounted
# volume to persist game state across container restarts.
ENV DATA_FILE=/data/data.json
RUN mkdir -p /data && chown node:node /data
VOLUME /data

USER node

CMD ["node", "index.js"]
