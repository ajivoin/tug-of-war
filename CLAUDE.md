# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm install       # install dependencies
npm start          # run the bot (node index.js, native ESM)
npm run lint        # eslint .
npm run lint-f       # eslint --fix .
```

There is no test suite (`npm test` is a placeholder that just runs the string `test` as a shell command and will fail if invoked). There is no build step — Node 24 runs the ESM source directly; no transpiler. Requires Node ≥24 (`engines` in `package.json`), since native ESM resolution requires the explicit `.js` extensions used on every relative import throughout the codebase.

Before running locally, copy `config.example.js` to `config.js` and set a real bot `token`. `config.js` is gitignored; CI touches an empty `config.js` just to satisfy the import during lint.

## Architecture

This is a single-server Discord bot (discord.js v14) built around one gameplay loop: a shared counting game ("tug of war") layered with an RPG-lite economy (coins/crowns), a shop, cosmetic reaction skins, and periodic "boss" mini-events. There is exactly one instance of the game state per bot process — it is not multi-guild aware (see "Single-channel, single-guild state" below).

- **`index.js`** — entry point. Owns the Discord client and the single `messageCreate` handler, which does double duty:
  1. Command dispatch: messages starting with `prefix` (`t?`) are tokenized and routed through `client.commands` (see `util/commands.js`). `bind` is special-cased before the "must be bound to a channel" / "wrong channel" guards so a fresh server can still bind.
  2. The core counting game: any bare integer sent in the bound channel is checked against `data.getCurrentNumber()`. Correct-in-sequence numbers advance the count, roll for coin drops / boss spawns / boss damage / acrobatics, and check for a win against the hidden target (`data.getTargetNumber()`); wrong numbers or the same user posting twice in a row reset progress and cost coins.
  Both flows share the same catch-all `try/catch`, so a thrown error anywhere in message handling is logged, not fatal.

- **`util/data.js`** — the entire persistence layer: a module-level in-memory object (schema from `utils.getDataSchema()`), loaded synchronously from `data.json` on startup and flushed back to disk every 5 minutes and on `SIGINT`. All game state (current number, target number, last counter, bound channel, per-user stats, boss) is read/written exclusively through this module's getters/setters — nothing else touches `data.json` or the in-memory object directly. There is no database; scaling beyond one process/one guild would require replacing this module.

- **Command system (`util/Command.js`, `util/AdminCommand.js`, `util/commands.js`, `util/command_list.js`)** — commands are plain objects (`new Command(name, description, executeFn, aliases?)`), not discord.js slash commands — this bot only uses classic prefix commands via `messageCreate`, no `interactionCreate`/application command registration. `AdminCommand` wraps `execute` with a `MANAGE_GUILD` permission check. `util/commands.js` builds every command instance and the `cmds` lookup table (including short aliases like `h`/`?`/`help`); `util/command_list.js` is just the `name -> description` map used to render `t?help`.

- **`util/bosses.js`** — a boss is a singleton (`Boss.instance`) spawned probabilistically while counting. Level is rolled from `BOSS_BREAKPOINTS`, which selects an image from `IMAGE_PATH` (files under `util/boss_images/`, not shown by `ls` but referenced by path) and scales health/rewards. Damage comes from ordinary counting (`hit`) or the `bomb` shop item; on death, `distributeRewards()` pays every participant proportional to damage dealt. Boss state is persisted through `data.persistBoss`/`data.getBoss` so a boss survives a process restart.

- **`util/shop/`** — `shop.js` implements `buy(userId, item, quantity, callback, errorCallback)`, dispatching on item name to either a powerup effect (teleport, reroll, zero, fliparoo, sneak, sqrt, crit/acrobatics/royalty permanent upgrades, boss bomb) or a cosmetic skin purchase. `shop/items/powerups.js` and `shop/items/skins.js` are flat catalogs with an `enabled` flag; only `enabled: true` entries are exported (filtered into `enabledPowerups`/`enabledSkins`) and shown in the shop/inventory embeds — disabled entries are kept in the source as a catalog of retired/seasonal/joke items rather than deleted.

- **`util/embeds.js`** — builds every `EmbedBuilder` response (help, shop, inventory, user stats, info, leaderboard) from current `data`/command-list state. `helpEmbed`/`shopEmbed` are computed once at module load, not regenerated per invocation.

- **`util/constants.js`** — every tunable gameplay number (win range, coin/crit/acrobatics rates, damage values, multipliers) lives here; adjusting game balance should go through this file rather than inline literals.

### Single-channel, single-guild state

`data.js` stores one `channel` id and one game state, globally — not keyed by guild. `t?bind #channel` (admin-only, via `MANAGE_GUILD`) sets it. The bot is designed to run against a single Discord server; adding multi-guild support would mean namespacing all of `data.js`'s state by guild id.

### Style

ESLint config extends `airbnb-base` via `.eslintrc.cjs`, with `no-console` disabled, `max-len` relaxed to 160, and `import/extensions` set to require (not forbid) extensions on relative imports — the opposite of airbnb-base's default, needed because native ESM resolution requires them. Run `npm run lint-f` to auto-fix before committing.
