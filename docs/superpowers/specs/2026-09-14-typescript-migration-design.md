# TypeScript Migration — Design

**Date:** 2026-09-14
**Status:** Approved
**Repo:** tug-of-war (single-guild Discord counting bot)

## Goal

Convert the bot from JavaScript to TypeScript, restructure `util/` into a layered
`src/` tree, replace the `(callback, errorCallback)` convention with typed
`Result` returns, and fix the defects found during the design review — without
changing game balance.

This is the first of three planned efforts. It is sequenced first because it is
the only one that makes the other two cheaper rather than riskier: the database
migration is fundamentally "rewrite the persistence layer without breaking ~45
call sites", and boss attacks add fields to a schema that is currently implicit.

## Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Execution | Node 24 native type-stripping | No build step. `node src/index.ts` runs directly. Preserves the project's existing "Node runs the source" property. |
| Type checking | `tsc --noEmit` in CI | Node strips types without checking them. The check moves to a gate rather than the run path. |
| Erasable syntax | `erasableSyntaxOnly: true` | Enforces Node's constraint at compile time, so violations surface from `tsc` rather than as a runtime `SyntaxError`. No `enum`, `namespace`, or parameter properties. |
| Lint | ESLint 9 flat config + `typescript-eslint` | `eslint-config-airbnb-base` has no flat-config or TypeScript support. `recommended` + `stylistic` is the closest continuation. |
| Tests | `node:test` | Built into Node 24. Zero new dependencies. |
| Test timing | Characterization tests before refactoring | The suite is the gate proving behavior was preserved. |
| Store lifetime | Constructed and injected, not imported | A module-level singleton with an import side effect is what makes the current code untestable. |
| Behavior changes | Restore intended behavior only | Defects are fixed; balance is untouched. Each deliberate change gets a test naming it. |
| Multi-guild | Out of scope | Confirmed single-guild. State stays global. |

## Architecture

### Module layout

```
src/
  index.ts              bootstrap: load state, build client, wire, login, shutdown
  config.ts             env parsing, fails fast on missing token

  bot/
    client.ts           client construction + intents
    router.ts           messageCreate: route to a command or the counting loop
    context.ts          CommandContext: message, userId, args, store, reply()

  game/
    counting.ts         the core loop, lifted out of index.js
    boss.ts             boss rules over BossState — no static singleton
    economy.ts          coins, crowns, convert
    constants.ts        `as const`

  commands/
    registry.ts         name + alias lookup; help is generated from it
    meta.ts             help, info, user, leaderboard, ping
    economy.ts          balance, convert, buy, shop, inventory, equip
    game.ts             boss
    admin.ts            bind, debug, givecrowns, spawn, kill

  store/
    schema.ts           GameState / User / BossState + defaults + normalization
    store.ts            the facade: typed reads, explicit mutators
    json-file.ts        fs read/write/flush — the seam SQLite replaces later

  shop/
    shop.ts  powerups.ts  skins.ts

  ui/
    embeds.ts           EmbedBuilder construction
    messages.ts         error codes + results -> user-facing English

  lib/
    result.ts  random.ts  text.ts  rate-limit.ts

test/**.test.ts
assets/boss-images/
```

`util/` is dissolved because it held four unrelated concerns under one name:
persistence, domain model, view layer, and actual utilities.

`store/json-file.ts` is isolated deliberately — it is the entire surface the
future SQLite migration must replace.

### Result type

Every domain function currently takes `(callback, errorCallback)` and every
caller passes "send this string to the channel". The pattern is a return value
that cannot return, because the function is also doing the talking.

```ts
// lib/result.ts
export type Result<T, E> = { ok: true; value: T } | { ok: false; error: E };
```

Domain functions return facts; `ui/messages.ts` renders English.

```ts
// game/economy.ts — no Discord, no strings, no callbacks
export type ConvertError =
  | { code: 'NOT_ENOUGH_CROWNS'; had: number; wanted: number }
  | { code: 'INVALID_AMOUNT'; input: string };

export function convert(
  store: Store, userId: string, arg?: string,
): Result<{ crownsSpent: number; coinsGained: number }, ConvertError>;
```

Error vocabulary (complete): `NOT_ENOUGH_COINS`, `NOT_ENOUGH_CROWNS`,
`UNKNOWN_ITEM`, `ALREADY_OWNED`, `NOT_OWNED`, `MAX_LEVEL`, `NO_ACTIVE_BOSS`,
`INVALID_AMOUNT`, `INVALID_CHANNEL`, `MISSING_PERMISSION`.

Consequences:

- `strict` forces the error branch to be handled; `.value` is unreachable
  without narrowing `ok`. The current `if (callback)` / `else if (errorCb)`
  guards silently drop the message when a caller passes neither — that becomes
  unwritable.
- The domain layer is testable with no Discord mocking.
- Boss attacks will need one event surfaced through an embed, a reaction, and a
  message. A returned value feeds all three; a callback has already chosen one.

### Store

```ts
export interface User {
  count: number; wins: number; crowns: number; coins: number;
  miscount: number; boss: number;
  critBonus: number; acrobatics: number; royalty: number;  // no longer optional
  reactions: Record<string, boolean>;
}

export interface GameState {
  number: number; win: number;
  last: string | null; channel: string | null;
  users: Record<string, User>;
  boss: BossState | null;
  correctEmoji: string; incorrectEmoji: string; timeoutEmoji: string;
}
```

`critBonus` / `acrobatics` / `royalty` become required, filled by load-time
normalization. This removes every `?? 0` in the codebase.

`parseState(raw: unknown): GameState` normalizes on load and must read the
existing production `data.json` unchanged — users saved before these fields
existed get defaults.

Reads return `Readonly<T>`; all mutation goes through named methods
(`incrementBossKills(userId)` rather than `getUser(id).boss += 1`). The current
`getUserWritable` and `getUser` are byte-for-byte identical, so today's
encapsulation is a fiction; `index.js:126` writes straight through the
"read-only" accessor.

### Boss state

The static `Boss.instance` singleton is removed. Boss state lives in
`GameState.boss` as the single source of truth, and `game/boss.ts` holds the
rules operating on it.

This is forced by a defect: two state sources with one missing write path
(see B7 below).

## Defects fixed

Tier 1 — identified by the user:

- **B1** `util/data.js:186` — `if (Number.isInteger)` is missing its argument.
  Always truthy; the error branch is dead.
- **B2** `util/data.js:9` — `data` is assigned inside an async `fs.stat`
  callback. Anything touching state before it fires throws. Works today only
  because Discord login is slower. Becomes a synchronous load.
- **B3** `getCoins` / `getCrowns` pass an `errorCallback` into `getUser`, which
  takes one parameter and ignores it.

Tier 2 — outright breakage found in review:

- **B4** `util/AdminCommand.js:4` and `index.js:35` call
  `.permissions.has('MANAGE_GUILD')`. That is the v13 spelling; v14 **throws**
  `DiscordjsRangeError` on it. `index.js`'s catch-all swallows the throw, so
  `bind`, `debug`, `givecrowns`, `spawn`, and `kill` have been silently dead
  since the v14 upgrade (commit `fba0ca2`). Fix: `ManageGuild`.
- **B5** `index.js:38-50` — `bind()` chains `.catch(...).then(...)`, so the
  `.then` runs even when the channel fetch rejects and an invalid channel id is
  bound anyway.
- **B6** `util/shop/shop.js:79` — `if (errorCallback) errorCallback('There is no
  active boss right now.')` sits outside the `if (Boss.instance)` block, so a
  successful bomb also reports failure. Additionally, a bomb bought with no boss
  present spends the coins without a refund.
- **B7** `util/bosses.js:229` — `hit()` calls `handleWin()` and returns early
  without `data.persistBoss(null)`; `bomb()` at :216 does. `data.boss` keeps
  referencing the object `handleWin` just mutated, the 5-minute flush writes it,
  and `Boss.load()` restores it on startup because it only checks `if (boss)`.
  The next count drives health below zero again and `distributeRewards()` pays
  the same `participants` map a second time. Resolved structurally by making
  `GameState.boss` the only source of truth.
- **B8** `util/commands.js` — `message.content.substr(prefix)` in `convert`,
  `equip`, and `buy`. `substr` takes a number; the string `'t?'` coerces to
  `NaN`, treated as `0`. A no-op that happens to work.
- **B9** `util/commands.js:135` — `_.debounce(equipFunction, true)` passes `true`
  as the wait in ms. `equip` is effectively undebounced and fires on the
  trailing edge instead of immediately.
- **B11** `util/bosses.js:123-130` — `BOSS_BREAKPOINTS` has six entries but the
  active `IMAGE_PATH` roster has five tiers, so `odds > 0.99` sets `bp = 5` and
  `IMAGE_PATH[5]` is `undefined`. `_.sample(undefined)` returns `undefined` and
  the following `.split('/')` throws a `TypeError`, swallowed by `index.js`'s
  catch-all — roughly **1% of boss spawns fail silently**. Both retired rosters
  had six tiers; this broke when the active roster was cut to five. Verified by
  forcing `Math.random` to 0.995. Fixed by clamping the tier index.
- **B12** `util/bosses.js:140` vs `:167` — the constructor renders `levelText`
  as `⭐`/`💀` but `Boss.load()` renders it as `🦴`, so a boss silently changed
  its level display after a process restart. `levelText` is now derived from
  level rather than stored, so the two cannot disagree.
- **B13** `util/embeds.js:76` — accuracy is `100 * count / (count + miscount)`,
  which renders `NaN%` for a user with no attempts yet. Now renders `—`.
- **B10** `util/embeds.js:15` — `getCoreEmbed` builds an unbounded field list;
  Discord caps embeds at 25 fields. `inventoryEmbedForUser` emits one field per
  owned reaction against a 45-skin catalog, so it throws
  `ExpectedConstraintError` for any user owning 26+. Confirmed in production.
  `generateShopEmbed` sits at 18 of 25 — enabling eight retired seasonal skins
  would break `t?shop` identically. Fix: `inventory` and the skins half of
  `shop` render as a compact list in the embed description (4096-char cap);
  `getCoreEmbed` returns `EmbedBuilder[]`, chunking at 25.

## Deferred

Recorded here, decided during the boss-attacks work when balance is in play:

- Rate limiting is global rather than per-user — one person spamming `t?help`
  rate-limits the whole server. May be intentional. Current values are carried
  forward unchanged.

**Resolved during planning:** whether `bomb` should refund when no boss is
present. `Result` settles it — charging happens only on the success path, so an
`err` return means no coins were ever taken. A no-op purchase cannot charge.

## Out of scope

- Database migration (planned next-but-one; `store/json-file.ts` is its seam).
- Boss attacks and other gameplay features.
- Any change to game balance or to values in `constants.ts`.

## Verification

- `npm run lint` — ESLint 9 flat config, clean.
- `npm run typecheck` — `tsc --noEmit`, clean under `strict` +
  `noUncheckedIndexedAccess` + `erasableSyntaxOnly`.
- `npm test` — `node --test`, all green. Replaces the placeholder script that
  currently runs the shell string `test`.
- The production `data.json` loads unchanged through `parseState`.
- `underscore` removed; `discord.js` is the only runtime dependency.
