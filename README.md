[![Lint](https://github.com/ajivoin/tug-of-war/actions/workflows/lint.yml/badge.svg)](https://github.com/ajivoin/tug-of-war/actions/workflows/lint.yml) [![Docker](https://github.com/ajivoin/tug-of-war/actions/workflows/docker-publish.yml/badge.svg)](https://github.com/ajivoin/tug-of-war/actions/workflows/docker-publish.yml)

# tug-of-war

Single-server Discord bot that makes counting competitive.

## Configuration

The bot is configured entirely through environment variables:

| Variable | Required | Default | Description |
| --- | --- | --- | --- |
| `DISCORD_TOKEN` | yes | — | Bot token from the [Discord Developer Portal](https://discord.com/developers/applications/). |
| `PREFIX` | no | `t?` | Command prefix. |
| `DATA_FILE` | no | `data.json` | Path to the persisted game state. |

## Development

0. Install Node.js 24 or newer.
1. Clone the repository.
2. Run `npm install`.
3. Copy `.env.example` to `.env` and set `DISCORD_TOKEN`. (`.env` is gitignored.)
4. Run `npm start`.

The source is TypeScript, but there is **no build step** — Node 24 strips types
natively, so `npm start` runs `src/index.ts` directly. Node strips without
checking, so type errors surface from `npm run typecheck` rather than at run
time.

| Script | What it does |
| --- | --- |
| `npm start` | Runs the bot. |
| `npm test` | `node --test` — the full suite, no framework. |
| `npm run typecheck` | `tsc --noEmit`. |
| `npm run lint` | ESLint 9 flat config. `npm run lint-f` auto-fixes. |

## Discord setup

1. Generate an OAuth invite link on the [Discord Developer Portal](https://discord.com/developers/applications/).
    * In the OAuth tab, select the `bot` scope and these permissions: `send messages, embed links, attach files, read message history, add reactions` (permissions value of `116800`).
    * In the bot tab, check the `Message Content Intent` option below `Privileged Gateway Intents` section.
2. Invite your bot to a Discord server.
3. Create a `#tug-of-war` channel.
4. In `#tug-of-war`, write `t?bind #tug-of-war` to get the bot in your channel.

## Deployment

Every push to `main` publishes an image to GitHub Container Registry as
`ghcr.io/ajivoin/tug-of-war:latest` (also tagged `sha-<commit>`, and with the
version on `v*` tags). Deploying is pulling that image on whatever host you like
— this repository needs no access to it.

```bash
docker run -d --name tug-of-war \
  --restart unless-stopped \
  -e DISCORD_TOKEN=your-bot-token-here \
  -v tug-of-war-data:/data \
  ghcr.io/ajivoin/tug-of-war:latest
```

Or with Compose, keeping a `compose.yaml` and a `.env` next to it on the server:

```yaml
services:
  bot:
    image: ghcr.io/ajivoin/tug-of-war:latest
    restart: unless-stopped
    env_file: .env
    volumes:
      - data:/data

volumes:
  data:
```

```bash
docker compose pull && docker compose up -d
```

Game state lives in the `/data` volume, so it survives restarts and image
upgrades. The container stores it at `/data/data.json` by default.

To migrate from an existing non-Docker install, copy the old `data.json` into
the volume before first start:

```bash
docker run --rm -v tug-of-war-data:/data -v "$PWD":/backup alpine \
  sh -c 'cp /backup/data.json /data/data.json && chown 1000:1000 /data/data.json'
```

(The container runs as the unprivileged `node` user, uid 1000, so the copied
file has to be owned by it.)

## Usage

Type `t?help` to see what commands you can use.

## Contributing

See [CONTRIBUTING.md](/CONTRIBUTING.md)
