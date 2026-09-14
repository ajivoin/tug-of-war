# SQLite Migration — Design

**Date:** 2026-09-14
**Status:** Implemented
**Repo:** tug-of-war (single-guild Discord counting bot)

## Goal

Replace `data.json` + a five-minute flush timer with a real database, so a
crash (container OOM-kill, host reboot, `docker kill`) can no longer discard
up to five minutes of play, and so `store.ts`'s single-JSON-blob-in-memory
model stops being the ceiling on what the game state can grow into.

This was called out as planned follow-up work in the TypeScript migration
design (`2026-09-14-typescript-migration-design.md`): `json-file.ts` was
named there as "the seam SQLite replaces later." This plan is that seam
being replaced.

## Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Engine | SQLite via Node's built-in `node:sqlite` (`DatabaseSync`) | Ships in Node 24, already the project's floor - zero new dependency. Its API is fully synchronous, so it's a drop-in replacement for the in-memory object `store.ts` currently mutates: no async refactor ripples through `game/`, `shop/`, `commands/`, `bot/`, or the ~35 call sites in `store.ts` itself. Verified against this repo's exact `tsconfig.json`/`@types/node` - typechecks clean, no experimental flag needed on Node 24.15. |
| Alternative considered: `better-sqlite3` | Rejected | Also synchronous, but a native addon requiring node-gyp/prebuilt binaries - complicates the `node:24-alpine` Docker image for no behavioral gain over the built-in module. |
| Alternative considered: Postgres/MySQL | Rejected | This is a single-process, single-guild bot with one writer. A network database adds an operational dependency (a second container, credentials, backup story) with no corresponding benefit at this scale. |
| Persistence model | Write-through on every mutation, no buffering | This is the actual bug being fixed: the current 5-minute interval flush is why a crash loses data. SQLite's per-statement cost is microseconds at this write rate (a Discord bot), so there is no performance reason to buffer. `flush()`/the flush timer are removed entirely - nothing in `src/` calls `flush()` today. |
| Durability | `PRAGMA journal_mode = WAL` + `PRAGMA synchronous = FULL` | WAL avoids readers/writers blocking each other (moot for one writer today, but free and standard); `synchronous = FULL` fsyncs on commit, which is the property this migration is being done for. |
| Schema shape | Normalized tables (`game_state`, `users`, `user_reactions`, `boss_state`, `boss_participants`), not one JSON column | A JSON column would just move the blob-in-memory problem into the database. Normalized tables make `t?inventory`-style per-item queries actually queryable later, and match the existing typed shape (`GameState`/`User`/`BossState` in `schema.ts`) column-for-column. |
| `Store` public API | Unchanged (same ~35 method names/signatures) | The entire point of the store-facade architecture (`game/`, `shop/`, `commands/` never touch persistence directly) is that this migration is contained to `src/store/`. Nothing outside that directory changes. |
| Existing-deployment migration | Automatic, on boot, once | The bot already runs in production with a real `data.json` (per README's Docker migration instructions). Requiring a manual export/import step is an unnecessary chance to lose data or be forgotten before a deploy. Boot checks "does the configured db file exist yet? no, but a legacy json file does? import it, then rename the json aside" - idempotent, safe to run on every boot. |
| Rollback story | Old `data.json` is preserved as `data.json.migrated`, never deleted | If the SQLite path misbehaves in production, reverting the deploy and renaming `data.json.migrated` back to `data.json` restores the pre-migration state exactly. |
| `node:sqlite` stability | Accepted risk | The module is documented `@experimental` in Node's own type definitions as of v24, despite having no feature flag requirement and a stable-since-22.5 API. Single-guild hobby bot; if this proves unstable in practice the fallback is `better-sqlite3` behind the same `sqlite.ts` seam, not a second migration of `store.ts`'s call sites. |

## Schema

```sql
CREATE TABLE game_state (          -- one row, id = 1
  id INTEGER PRIMARY KEY CHECK (id = 1),
  number INTEGER NOT NULL,
  win INTEGER NOT NULL,
  last TEXT,
  channel TEXT,
  correct_emoji TEXT NOT NULL,
  incorrect_emoji TEXT NOT NULL,
  timeout_emoji TEXT NOT NULL
);

CREATE TABLE users (
  id TEXT PRIMARY KEY,             -- Discord user id
  count INTEGER NOT NULL DEFAULT 0,
  wins INTEGER NOT NULL DEFAULT 0,
  crowns INTEGER NOT NULL DEFAULT 0,
  coins INTEGER NOT NULL DEFAULT 0,
  miscount INTEGER NOT NULL DEFAULT 0,
  boss INTEGER NOT NULL DEFAULT 0,
  crit_bonus INTEGER NOT NULL DEFAULT 0,
  acrobatics INTEGER NOT NULL DEFAULT 0,
  royalty INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE user_reactions (      -- ownership + equipped state of a skin
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reaction_id TEXT NOT NULL,
  selected INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, reaction_id)
);

CREATE TABLE boss_state (          -- 0 or 1 row; a row's presence = active boss
  id INTEGER PRIMARY KEY CHECK (id = 1),
  level INTEGER NOT NULL,
  health INTEGER NOT NULL,
  total_health INTEGER NOT NULL,
  reward_crowns INTEGER NOT NULL,
  reward_coins INTEGER NOT NULL,
  image_path TEXT NOT NULL,
  image_name TEXT NOT NULL,
  boss_name TEXT NOT NULL
);

CREATE TABLE boss_participants (
  user_id TEXT PRIMARY KEY,
  damage INTEGER NOT NULL
);
```

Column mapping is direct from `schema.ts`'s `User`/`BossState`/`GameState`
interfaces (camelCase field -> snake_case column), with two shape changes:

- `User.reactions: Record<string, boolean>` becomes rows in `user_reactions`
  rather than a JSON blob, so ownership (`hasReaction`) and equip
  (`selectReaction`) are both plain queries.
- `BossState | null` becomes "does a row exist in `boss_state`", replacing
  the null-check with a presence-check. `setBoss(null)` deletes the row (and
  `boss_participants`, which has no independent lifetime).

## `Store`'s new contract with its data

Today, `createStore(state, opts)` takes an already-loaded `GameState` and
mutates it in place; the caller (`index.ts`) is responsible for having
called `loadState()` first. After this migration, **the database is the
source of truth**: `createStore(initialState, opts)` opens (creating if
needed) the SQLite file at `opts.file` and only writes `initialState` into
`game_state` if that table is empty - i.e. `initialState` is a fresh-install
seed, not data that overwrites what's already on disk. Every boot after the
first finds an existing `game_state` row and leaves it alone.

This is a deliberate behavior change from today's `loadState(file)` +
`createStore(state, {file})` pair, where the JSON file was read once at
startup into memory and everything after that was an in-memory mutation
flushed back out periodically. It removes that entire indirection: reads and
writes both go straight to SQLite, so there is no separate "loaded state"
that can drift from disk.

## Migration path for the existing production `data.json`

On every boot, before constructing the store:

1. If the configured SQLite file already exists, do nothing (already
   migrated, or a fresh SQLite-native install).
2. Else, if the configured legacy JSON file exists, parse it with the
   existing `parseState()` (unchanged - still does the "normalize whatever
   prior shape was saved" job it does today), write every row into a fresh
   SQLite file, then rename the JSON file to `<name>.json.migrated`.
3. Else (neither exists - a brand-new install), do nothing; `createStore`
   creates an empty database and seeds `game_state` from `createState()`.

This means a `docker compose pull && docker compose up -d` on the existing
production deployment converts the volume's `data.json` into `data.db`
automatically on the next start, with no manual step and no window where
data could be lost (the JSON is renamed, not deleted, only after the import
transaction commits).

## Out of scope

- Multi-guild support. Still one process, one `game_state` row, per the
  TypeScript migration design's existing decision.
- Changing what data is tracked. This is a storage-layer swap; no new
  columns beyond what `GameState`/`User`/`BossState` already have today.
- A generic query/reporting layer. Nothing in this plan adds new read
  patterns beyond what `Store`'s existing methods expose.
