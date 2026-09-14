# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm install       # install dependencies
npm start          # run the bot (node src/index.ts, native ESM + TypeScript)
npm test           # node --test
npm run typecheck   # tsc --noEmit
npm run lint         # eslint .
npm run lint-f        # eslint --fix .
```

**There is no build step.** Node 24 strips TypeScript types natively, so
`node src/index.ts` runs the source directly — no transpiler, no `dist/`.
Because Node strips types without checking them, `npm run typecheck` is a
separate gate; it is not in the path between you and running the bot. CI runs
lint, typecheck, and test.

This imposes one constraint: **erasable syntax only**. No `enum`, no
`namespace`, no constructor parameter properties — those emit runtime code
rather than vanishing. Use `as const` objects instead. `erasableSyntaxOnly` in
`tsconfig.json` enforces this at compile time, so violations surface from `tsc`
rather than as a runtime `SyntaxError`.

Relative imports carry the `.ts` extension (`import { x } from './lib/result.ts'`)
— Node resolves the literal path.

Requires Node >= 24 (`engines` in `package.json`). Copy `.env.example` to `.env`
and set a real `DISCORD_TOKEN` before running; `.env` is gitignored.

## Architecture

A single-server Discord bot (discord.js v14) built around one gameplay loop: a
shared counting game ("tug of war") layered with an RPG-lite economy
(coins/crowns), a shop, cosmetic reaction skins, and periodic "boss"
mini-events. There is exactly one instance of game state per bot process — it is
not multi-guild aware.

Two rules hold the structure together:

1. **Domain code returns values; it does not talk to Discord.** `game/`,
   `store/`, and `shop/` must not import `discord.js`. They return
   `Result<T, E>` with structured error codes, and `ui/messages.ts` renders
   English. This is what makes the domain testable without mocking Discord.
2. **All mutable state lives behind an injected `Store`.** Nothing imports a
   global. `index.ts` constructs the one instance and threads it through
   `CommandContext`.

### Layers

- **`src/index.ts`** — bootstrap only: load state, build the client, register
  the handler, log in, handle `SIGINT`/`SIGTERM`.
- **`src/bot/`** — the only place that touches discord.js message plumbing.
  `router.ts` owns `messageCreate` and does double duty: dispatching prefix
  commands, and running bare integers through the counting loop. `bind` is
  handled before the bound-channel guards so a fresh server can recover.
  `context.ts` defines `CommandContext` and `Command`.
- **`src/game/`** — the rules. `counting.ts` is the core loop and returns a
  `CountOutcome` with a list of effects rather than reacting to messages;
  `boss.ts` operates on `BossState` through the store with no singleton;
  `economy.ts` handles crowns/coins/convert; `constants.ts` holds every tunable
  number as `as const`.
- **`src/commands/`** — one file per command group plus `registry.ts`, which
  builds the name/alias lookup and generates the help embed from it, so help
  cannot drift from reality. `adminOnly` commands are gated on
  `PermissionFlagsBits.ManageGuild`.
- **`src/store/`** — `schema.ts` defines `GameState`/`User`/`BossState` and
  `parseState`, which normalizes any prior on-disk shape and fills defaults.
  `store.ts` is the facade: reads return frozen objects, all mutation goes
  through named methods. `json-file.ts` is the filesystem backend and is
  deliberately isolated — it is the entire surface a database migration would
  replace.
- **`src/shop/`** — `shop.ts`'s `buy()` resolves the item, prices it, applies
  the effect, and charges **only on success**. That ordering makes a failed
  purchase that still took coins unrepresentable. `powerups.ts` and `skins.ts`
  are flat catalogs with an `enabled` flag; disabled entries are retained as a
  catalog of retired/seasonal items rather than deleted.
- **`src/ui/`** — `embeds.ts` builds every embed; `messages.ts` maps `Result`
  values to user-facing strings.
- **`src/lib/`** — `result.ts`, `random.ts`, `text.ts`, `rate-limit.ts`.

### Embed field limits

Discord rejects embeds with more than 25 fields. `buildEmbeds` returns
`EmbedBuilder[]`, chunking at that limit, and inventory and shop skins render
as description lists rather than one field per item. Do not reintroduce
one-field-per-catalog-entry rendering — the skin catalog has 45 entries and a
user owning 26 of them previously crashed `t?inventory` in production.

### Single-channel, single-guild state

`GameState` stores one `channel` id and one game state, globally — not keyed by
guild. `t?bind #channel` (admin-only) sets it. Adding multi-guild support would
mean namespacing all of `store/` by guild id.

### Style

ESLint 9 flat config (`eslint.config.js`) with `typescript-eslint` recommended +
stylistic, `no-console` off, and `max-len` at 160. Run `npm run lint-f` to
auto-fix before committing.

### Testing

`node:test`, no framework. Domain modules take a `Store` and, where behavior is
probabilistic, an injectable `rng` — so coin drops, crits, acrobatics, and boss
spawns are all deterministic in tests. Adjusting game balance should go through
`game/constants.ts` rather than inline literals.
