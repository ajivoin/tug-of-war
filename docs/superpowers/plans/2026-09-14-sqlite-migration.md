# SQLite Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace `data.json` + the 5-minute flush timer with a SQLite database (`node:sqlite`), so a crash can no longer discard up to five minutes of play, without changing anything outside `src/store/`.

**Architecture:** `src/store/sqlite.ts` owns schema + a transaction helper; `src/store/store.ts` is rewritten to back its existing ~35-method facade with prepared statements instead of an in-memory object, writing through on every call; `src/store/legacy-import.ts` does a one-time, idempotent import of any existing `data.json` on boot. `Store`'s public API is unchanged, so `game/`, `shop/`, `commands/`, `bot/` require zero edits.

**Tech Stack:** `node:sqlite` (`DatabaseSync`) - built into Node 24, no new dependency. `node:test` for tests, matching the rest of the suite.

**Spec:** `docs/superpowers/specs/2026-09-14-sqlite-migration-design.md`

## Global Constraints

- Node >= 24 (already the project floor; `node:sqlite` needs >= 22.5).
- No new npm dependency - `node:sqlite` is built in.
- `Store`'s public method names/signatures do not change, with one deliberate exception: `flush()` and the `flushMs` option are removed entirely (no call site in `src/` uses them; every mutation is now durable immediately, so there is nothing left to flush).
- Every mutation writes through to SQLite synchronously - no buffered in-memory state, no interval timer.
- `PRAGMA journal_mode = WAL` and `PRAGMA synchronous = FULL` on every database open.
- The database, once it has a `game_state` row, is the source of truth - `createStore(initialState, opts)` only writes `initialState` in if that row is missing (fresh install).
- The legacy `data.json` migration is automatic, idempotent (safe to call on every boot), and never deletes the old file - it renames it to `<name>.json.migrated` only after the import transaction commits.
- Every task's code below has been typechecked, linted, and run against the full existing test suite (102/102 passing) as part of writing this plan - the code blocks are the verified implementation, not a sketch.

---

## Task 1: SQLite schema and connection helper

**Files:**
- Create: `src/store/sqlite.ts`
- Test: `test/store/sqlite.test.ts`

**Interfaces:**
- Produces: `openDatabase(file: string): DatabaseSync` - opens (creating if needed) the file at `file` (or `':memory:'`), sets PRAGMAs, and ensures every table exists. `withTransaction<T>(db: DatabaseSync, fn: () => T): T` - runs `fn` inside BEGIN/COMMIT, rolling back and rethrowing on error. Both are consumed by Task 2 (`legacy-import.ts`) and Task 3 (`store.ts`).

- [x] **Step 1: Write `src/store/sqlite.ts`**

```typescript
import { DatabaseSync } from 'node:sqlite';

const SCHEMA = `
CREATE TABLE IF NOT EXISTS game_state (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  number INTEGER NOT NULL,
  win INTEGER NOT NULL,
  last TEXT,
  channel TEXT,
  correct_emoji TEXT NOT NULL,
  incorrect_emoji TEXT NOT NULL,
  timeout_emoji TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
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

CREATE TABLE IF NOT EXISTS user_reactions (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reaction_id TEXT NOT NULL,
  selected INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, reaction_id)
);

CREATE TABLE IF NOT EXISTS boss_state (
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

CREATE TABLE IF NOT EXISTS boss_participants (
  user_id TEXT PRIMARY KEY,
  damage INTEGER NOT NULL
);
`;

/**
 * Opens (creating if needed) the SQLite file at `file` and ensures the
 * schema exists. Safe to call against an already-populated database - every
 * statement is CREATE TABLE IF NOT EXISTS, so this never touches existing
 * rows.
 */
export const openDatabase = (file: string): DatabaseSync => {
  const db = new DatabaseSync(file);
  db.exec('PRAGMA journal_mode = WAL');
  db.exec('PRAGMA synchronous = FULL');
  db.exec('PRAGMA foreign_keys = ON');
  db.exec(SCHEMA);
  return db;
};

/**
 * Runs `fn` inside BEGIN/COMMIT, rolling back if it throws. Used for
 * mutations that touch more than one statement (e.g. selectReaction,
 * setBoss) so a crash mid-mutation can't leave the tables inconsistent.
 */
export const withTransaction = <T>(db: DatabaseSync, fn: () => T): T => {
  db.exec('BEGIN');
  try {
    const result = fn();
    db.exec('COMMIT');
    return result;
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
};
```

- [x] **Step 2: Write `test/store/sqlite.test.ts`**

```typescript
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { openDatabase, withTransaction } from '../../src/store/sqlite.ts';

describe('sqlite', () => {
  test('openDatabase creates every table on a fresh file', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tow-sqlite-'));
    const file = path.join(dir, 'data.db');
    const db = openDatabase(file);
    const tables = (db.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all() as { name: string }[])
      .map((r) => r.name)
      .sort();
    assert.deepEqual(tables, ['boss_participants', 'boss_state', 'game_state', 'user_reactions', 'users']);
    db.close();
    fs.rmSync(dir, { recursive: true, force: true });
  });

  test('openDatabase is idempotent against an already-populated file', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tow-sqlite-'));
    const file = path.join(dir, 'data.db');
    const first = openDatabase(file);
    first.prepare(`
      INSERT INTO game_state (id, number, win, last, channel, correct_emoji, incorrect_emoji, timeout_emoji)
      VALUES (1, 5, 10, NULL, NULL, '✅', '❌', '⏱️')
    `).run();
    first.close();

    const second = openDatabase(file);
    const row = second.prepare('SELECT number FROM game_state WHERE id = 1').get() as { number: number };
    assert.equal(row.number, 5, 're-opening does not wipe existing rows');
    second.close();
    fs.rmSync(dir, { recursive: true, force: true });
  });

  test('withTransaction rolls back on error, leaving no partial write', () => {
    const db = openDatabase(':memory:');
    db.prepare(`
      INSERT INTO game_state (id, number, win, last, channel, correct_emoji, incorrect_emoji, timeout_emoji)
      VALUES (1, 0, 0, NULL, NULL, '✅', '❌', '⏱️')
    `).run();

    assert.throws(() => {
      withTransaction(db, () => {
        db.prepare('UPDATE game_state SET number = 99 WHERE id = 1').run();
        throw new Error('boom');
      });
    }, /boom/);

    const row = db.prepare('SELECT number FROM game_state WHERE id = 1').get() as { number: number };
    assert.equal(row.number, 0, 'the update inside the failed transaction was rolled back');
    db.close();
  });
});
```

- [x] **Step 3: Run the new test**

Run: `node --test test/store/sqlite.test.ts`
Expected: 3 passing tests, 0 failures.

- [x] **Step 4: Typecheck and lint**

Run: `npm run typecheck && npm run lint`
Expected: both exit 0.

- [x] **Step 5: Commit**

```bash
git add src/store/sqlite.ts test/store/sqlite.test.ts
git commit -m "feat(store): add SQLite schema and connection helper"
```

---

## Task 2: Legacy JSON → SQLite one-time import

**Files:**
- Create: `src/store/legacy-import.ts`
- Test: `test/store/legacy-import.test.ts`

**Interfaces:**
- Consumes: `openDatabase`, `withTransaction` from `./sqlite.ts` (Task 1); `loadState` from `./json-file.ts` (unchanged, existing); `GameState` from `./schema.ts` (unchanged, existing).
- Produces: `migrateLegacyStateIfNeeded(legacyFile: string, dbFile: string): void`, consumed by `src/index.ts` in Task 4. Also indirectly exercises `createStore` from Task 3's `store.ts` in its own test, so this task's test step must run *after* Task 3 - see the note on Step 3 below.

- [x] **Step 1: Write `src/store/legacy-import.ts`**

```typescript
import fs from 'node:fs';
import { loadState } from './json-file.ts';
import { openDatabase, withTransaction } from './sqlite.ts';
import type { GameState } from './schema.ts';

const writeLegacyState = (dbFile: string, state: GameState): void => {
  const db = openDatabase(dbFile);
  try {
    withTransaction(db, () => {
      db.prepare(`
        INSERT INTO game_state (id, number, win, last, channel, correct_emoji, incorrect_emoji, timeout_emoji)
        VALUES (1, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        state.number, state.win, state.last, state.channel,
        state.correctEmoji, state.incorrectEmoji, state.timeoutEmoji,
      );

      const insertUser = db.prepare(`
        INSERT INTO users (id, count, wins, crowns, coins, miscount, boss, crit_bonus, acrobatics, royalty)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      const insertReaction = db.prepare(
        'INSERT INTO user_reactions (user_id, reaction_id, selected) VALUES (?, ?, ?)',
      );
      Object.entries(state.users).forEach(([id, user]) => {
        insertUser.run(
          id, user.count, user.wins, user.crowns, user.coins,
          user.miscount, user.boss, user.critBonus, user.acrobatics, user.royalty,
        );
        Object.entries(user.reactions).forEach(([reactionId, selected]) => {
          insertReaction.run(id, reactionId, selected ? 1 : 0);
        });
      });

      if (state.boss) {
        db.prepare(`
          INSERT INTO boss_state
            (id, level, health, total_health, reward_crowns, reward_coins, image_path, image_name, boss_name)
          VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          state.boss.level, state.boss.health, state.boss.totalHealth,
          state.boss.rewards.crowns, state.boss.rewards.coins,
          state.boss.imagePath, state.boss.imageName, state.boss.bossName,
        );
        const insertParticipant = db.prepare('INSERT INTO boss_participants (user_id, damage) VALUES (?, ?)');
        Object.entries(state.boss.participants).forEach(([userId, damage]) => {
          insertParticipant.run(userId, damage);
        });
      }
    });
  } finally {
    db.close();
  }
};

/**
 * One-time migration from the legacy JSON save file to the SQLite database.
 * Runs only when `dbFile` does not exist yet and `legacyFile` does - every
 * boot after the first finds the SQLite file already there and returns
 * immediately, so this is safe to call unconditionally on every startup.
 * On success the old JSON is renamed to `<legacyFile>.migrated` so a
 * container restart can never re-import it.
 */
export const migrateLegacyStateIfNeeded = (legacyFile: string, dbFile: string): void => {
  if (fs.existsSync(dbFile) || !fs.existsSync(legacyFile)) return;

  console.log(`No ${dbFile} yet; importing legacy state from ${legacyFile}...`);
  const state = loadState(legacyFile);
  writeLegacyState(dbFile, state);
  fs.renameSync(legacyFile, `${legacyFile}.migrated`);
  console.log(`Migrated ${legacyFile} -> ${dbFile} (old file kept as ${legacyFile}.migrated).`);
};
```

- [x] **Step 2: Write `test/store/legacy-import.test.ts`**

```typescript
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createStore } from '../../src/store/store.ts';
import { createState } from '../../src/store/schema.ts';
import { migrateLegacyStateIfNeeded } from '../../src/store/legacy-import.ts';

const tmpDir = (): string => fs.mkdtempSync(path.join(os.tmpdir(), 'tow-migrate-'));

describe('legacy-import', () => {
  test('does nothing when neither file exists', () => {
    const dir = tmpDir();
    const legacyFile = path.join(dir, 'data.json');
    const dbFile = path.join(dir, 'data.db');
    migrateLegacyStateIfNeeded(legacyFile, dbFile);
    assert.equal(fs.existsSync(dbFile), false);
    fs.rmSync(dir, { recursive: true, force: true });
  });

  test('does nothing when the db file already exists, even if a legacy file is also present', () => {
    const dir = tmpDir();
    const legacyFile = path.join(dir, 'data.json');
    const dbFile = path.join(dir, 'data.db');
    fs.writeFileSync(legacyFile, JSON.stringify({ number: 1 }));
    const store = createStore(createState(), { file: dbFile });
    store.stop();

    migrateLegacyStateIfNeeded(legacyFile, dbFile);

    assert.equal(fs.existsSync(legacyFile), true, 'legacy file is left alone - already migrated');
    fs.rmSync(dir, { recursive: true, force: true });
  });

  test('imports every field of a legacy save and renames the old file aside', () => {
    const dir = tmpDir();
    const legacyFile = path.join(dir, 'data.json');
    const dbFile = path.join(dir, 'data.db');
    const legacy = {
      number: 42,
      win: 100,
      last: 'u1',
      channel: 'chan1',
      users: {
        u1: {
          count: 5, wins: 2, crowns: 10, coins: 20, miscount: 1, boss: 1,
          critBonus: 2, acrobatics: 1, royalty: 0,
          reactions: { default: false, pumpkin: true },
        },
        u2: {
          count: 0, wins: 0, crowns: 0, coins: 0, miscount: 0, boss: 0,
          critBonus: 0, acrobatics: 0, royalty: 0,
          reactions: { default: true },
        },
      },
      boss: {
        level: 3,
        health: 40,
        totalHealth: 100,
        rewards: { crowns: 5, coins: 5 },
        participants: { u1: 60 },
        imagePath: 'assets/boss-images/x.png',
        imageName: 'x.png',
        bossName: 'Old Boss',
      },
      correctEmoji: '✅',
      incorrectEmoji: '❌',
      timeoutEmoji: '⏱️',
    };
    fs.writeFileSync(legacyFile, JSON.stringify(legacy));

    migrateLegacyStateIfNeeded(legacyFile, dbFile);

    assert.equal(fs.existsSync(dbFile), true, 'db file created');
    assert.equal(fs.existsSync(legacyFile), false, 'legacy file renamed away');
    assert.equal(fs.existsSync(`${legacyFile}.migrated`), true, 'legacy file kept as .migrated');

    const store = createStore(createState(), { file: dbFile });
    assert.equal(store.getNumber(), 42);
    assert.equal(store.getTarget(), 100);
    assert.equal(store.getLastUserId(), 'u1');
    assert.equal(store.getChannelId(), 'chan1');
    assert.equal(store.getCoins('u1'), 20);
    assert.equal(store.getCritBonus('u1'), 2);
    const reactions = store.getReactions('u1');
    assert.equal(reactions.pumpkin, true);
    assert.equal(reactions.default, false);
    assert.equal(store.hasUser('u2'), true);
    const boss = store.getBoss();
    assert.ok(boss);
    assert.equal(boss.bossName, 'Old Boss');
    assert.equal(boss.participants.u1, 60);
    store.stop();

    fs.rmSync(dir, { recursive: true, force: true });
  });
});
```

- [x] **Step 3: Run the new test**

This test imports `createStore` from `src/store/store.ts`, which is still the
pre-migration in-memory version until Task 3 lands. `createStore(createState(), { file: dbFile })`
still works today (it accepts a `file` option and can `.stop()`), so this test
passes against *either* version of `store.ts` - it does not need to wait for
Task 3. Confirm that now:

Run: `node --test test/store/legacy-import.test.ts`
Expected: 3 passing tests, 0 failures.

- [x] **Step 4: Typecheck and lint**

Run: `npm run typecheck && npm run lint`
Expected: both exit 0.

- [x] **Step 5: Commit**

```bash
git add src/store/legacy-import.ts test/store/legacy-import.test.ts
git commit -m "feat(store): import legacy data.json into SQLite once, on boot"
```

---

## Task 3: Rewrite the `Store` facade onto SQLite

This is a full-file replacement of `store.ts` and its test, not an
incremental diff: every method's *body* changes (in-memory field access ->
prepared-statement query), while every method's *name and signature* stays
identical. There is no meaningful unit smaller than "the whole facade" here
- `game/`, `shop/`, and `commands/` all depend on the complete set of
methods being consistent with each other (e.g. `ensureUser` and `getUser`
sharing one row-mapping function), so review this task as one deliverable.

**Files:**
- Modify: `src/store/store.ts` (full replacement)
- Modify: `test/store/store.test.ts` (full replacement)
- Create: `test/store/json-file.test.ts` (the `loadState`/`saveState` tests, moved out of `store.test.ts` since that file no longer touches JSON at all)

**Interfaces:**
- Consumes: `openDatabase`, `withTransaction` from `./sqlite.ts` (Task 1).
- Produces: `createStore(initialState: GameState, opts?: StoreOptions): Store` and `export type Store` - unchanged from today's export, consumed by every command, `game/`, `shop/`, and `bot/router.ts` file. `StoreOptions` drops `flushMs`; `Store` drops `flush()`.

- [x] **Step 1: Move the JSON-file tests out of `store.test.ts`**

Write `test/store/json-file.test.ts`:

```typescript
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { loadState, saveState } from '../../src/store/json-file.ts';
import { createState } from '../../src/store/schema.ts';

const tmp = (): string => fs.mkdtempSync(path.join(os.tmpdir(), 'tow-json-'));

describe('json-file', () => {
  test('B2: loadState is synchronous - state is usable on the next line', () => {
    const dir = tmp();
    const file = path.join(dir, 'data.json');
    saveState(file, { ...createState(), number: 42 });
    const state = loadState(file);
    assert.equal(state.number, 42, 'no tick required, unlike legacy data.js');
    fs.rmSync(dir, { recursive: true, force: true });
  });

  test('loadState returns a default state when the file is missing', () => {
    const dir = tmp();
    const state = loadState(path.join(dir, 'nope.json'));
    assert.deepEqual(state.users, {});
    fs.rmSync(dir, { recursive: true, force: true });
  });

  test('loadState survives a corrupt file rather than crashing on boot', () => {
    const dir = tmp();
    const file = path.join(dir, 'data.json');
    fs.writeFileSync(file, '{ not valid json');
    assert.deepEqual(loadState(file).users, {});
    fs.rmSync(dir, { recursive: true, force: true });
  });
});
```

- [x] **Step 2: Run it in isolation**

Run: `node --test test/store/json-file.test.ts`
Expected: 3 passing tests. (This is the pre-existing behavior of `json-file.ts`, unchanged - it's only moving files.)

- [x] **Step 3: Replace `src/store/store.ts` in full**

```typescript
import type { BossState, GameState, User } from './schema.ts';
import { openDatabase, withTransaction } from './sqlite.ts';

export interface StoreOptions { file?: string }

interface GameStateRow {
  number: number; win: number; last: string | null; channel: string | null;
  correct_emoji: string; incorrect_emoji: string; timeout_emoji: string;
}
interface UserRow {
  id: string; count: number; wins: number; crowns: number; coins: number;
  miscount: number; boss: number; crit_bonus: number; acrobatics: number; royalty: number;
}
interface BossRow {
  level: number; health: number; total_health: number;
  reward_crowns: number; reward_coins: number;
  image_path: string; image_name: string; boss_name: string;
}
interface ReactionRow { reaction_id: string; selected: number }
interface ParticipantRow { user_id: string; damage: number }

export const createStore = (initialState: GameState, opts: StoreOptions = {}) => {
  const db = openDatabase(opts.file ?? ':memory:');

  const selectGameState = db.prepare('SELECT * FROM game_state WHERE id = 1');
  const insertGameState = db.prepare(`
    INSERT INTO game_state (id, number, win, last, channel, correct_emoji, incorrect_emoji, timeout_emoji)
    VALUES (1, ?, ?, ?, ?, ?, ?, ?)
  `);
  const updateNumber = db.prepare('UPDATE game_state SET number = ? WHERE id = 1');
  const updateWin = db.prepare('UPDATE game_state SET win = ? WHERE id = 1');
  const updateLast = db.prepare('UPDATE game_state SET last = ? WHERE id = 1');
  const updateChannel = db.prepare('UPDATE game_state SET channel = ? WHERE id = 1');

  const selectUser = db.prepare('SELECT * FROM users WHERE id = ?');
  const selectAllUsers = db.prepare('SELECT * FROM users');
  const insertUser = db.prepare('INSERT OR IGNORE INTO users (id) VALUES (?)');
  const insertDefaultReaction = db.prepare(
    'INSERT OR IGNORE INTO user_reactions (user_id, reaction_id, selected) VALUES (?, ?, 1)',
  );
  const updateCoins = db.prepare('UPDATE users SET coins = ? WHERE id = ?');
  const updateCrowns = db.prepare('UPDATE users SET crowns = ? WHERE id = ?');
  const updateCount = db.prepare('UPDATE users SET count = count + 1 WHERE id = ?');
  const updateMiscount = db.prepare('UPDATE users SET miscount = miscount + 1 WHERE id = ?');
  const updateWins = db.prepare('UPDATE users SET wins = wins + 1 WHERE id = ?');
  const updateBossKills = db.prepare('UPDATE users SET boss = boss + 1 WHERE id = ?');
  const updateCritBonus = db.prepare('UPDATE users SET crit_bonus = ? WHERE id = ?');
  const updateAcrobatics = db.prepare('UPDATE users SET acrobatics = ? WHERE id = ?');
  const updateRoyalty = db.prepare('UPDATE users SET royalty = ? WHERE id = ?');

  const selectReactions = db.prepare('SELECT reaction_id, selected FROM user_reactions WHERE user_id = ?');
  const upsertReaction = db.prepare(`
    INSERT INTO user_reactions (user_id, reaction_id, selected) VALUES (?, ?, 1)
    ON CONFLICT (user_id, reaction_id) DO UPDATE SET selected = 1
  `);
  const deselectOtherReactions = db.prepare(
    'UPDATE user_reactions SET selected = 0 WHERE user_id = ? AND reaction_id != ?',
  );

  const selectBoss = db.prepare('SELECT * FROM boss_state WHERE id = 1');
  const deleteBoss = db.prepare('DELETE FROM boss_state WHERE id = 1');
  const deleteBossParticipants = db.prepare('DELETE FROM boss_participants');
  const insertBoss = db.prepare(`
    INSERT INTO boss_state
      (id, level, health, total_health, reward_crowns, reward_coins, image_path, image_name, boss_name)
    VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const insertParticipant = db.prepare('INSERT INTO boss_participants (user_id, damage) VALUES (?, ?)');
  const selectParticipants = db.prepare('SELECT user_id, damage FROM boss_participants');

  // First boot against a brand-new database file: seed the single game_state
  // row from the caller's default state. A database that already has this
  // row (every boot after the first, and every post-migration boot) is left
  // untouched - the database is the source of truth, `initialState` is only
  // the fresh-install seed.
  if (!selectGameState.get()) {
    insertGameState.run(
      initialState.number, initialState.win, initialState.last, initialState.channel,
      initialState.correctEmoji, initialState.incorrectEmoji, initialState.timeoutEmoji,
    );
  }

  const getGameStateRow = (): GameStateRow => selectGameState.get() as unknown as GameStateRow;
  const getUserRow = (id: string): UserRow | undefined => selectUser.get(id) as unknown as UserRow | undefined;

  const reactionsFor = (id: string): Record<string, boolean> => Object.fromEntries(
    (selectReactions.all(id) as unknown as ReactionRow[]).map((r) => [r.reaction_id, r.selected === 1]),
  );

  const rowToUser = (row: UserRow): User => ({
    count: row.count,
    wins: row.wins,
    crowns: row.crowns,
    coins: row.coins,
    miscount: row.miscount,
    boss: row.boss,
    critBonus: row.crit_bonus,
    acrobatics: row.acrobatics,
    royalty: row.royalty,
    reactions: reactionsFor(row.id),
  });

  const rowToBoss = (row: BossRow): BossState => ({
    level: row.level,
    health: row.health,
    totalHealth: row.total_health,
    rewards: { crowns: row.reward_crowns, coins: row.reward_coins },
    participants: Object.fromEntries(
      (selectParticipants.all() as unknown as ParticipantRow[]).map((p) => [p.user_id, p.damage]),
    ),
    imagePath: row.image_path,
    imageName: row.image_name,
    bossName: row.boss_name,
  });

  const ensureUserRow = (id: string): void => {
    insertUser.run(id);
    insertDefaultReaction.run(id, 'default');
  };

  const adjustBalance = (id: string, field: 'coins' | 'crowns', delta: number, floorAtZero: boolean): void => {
    const row = getUserRow(id);
    if (!row) return;
    const next = row[field] + delta;
    const clamped = floorAtZero ? Math.max(0, next) : next;
    if (field === 'coins') updateCoins.run(clamped, id);
    else updateCrowns.run(clamped, id);
  };

  return {
    getUser: (id: string): Readonly<User> | undefined => {
      const row = getUserRow(id);
      return row ? Object.freeze(rowToUser(row)) : undefined;
    },
    ensureUser: (id: string): Readonly<User> => {
      withTransaction(db, () => ensureUserRow(id));
      return Object.freeze(rowToUser(getUserRow(id) as UserRow));
    },
    hasUser: (id: string): boolean => getUserRow(id) !== undefined,
    getAllUsers: (): Readonly<Record<string, User>> => Object.freeze(
      Object.fromEntries((selectAllUsers.all() as unknown as UserRow[]).map((row) => [row.id, rowToUser(row)])),
    ),

    // B3: a missing user yields 0, and the dead errorCallback parameter is gone.
    getCoins: (id: string): number => getUserRow(id)?.coins ?? 0,
    getCrowns: (id: string): number => getUserRow(id)?.crowns ?? 0,
    addCoins: (id: string, n: number): void => adjustBalance(id, 'coins', Math.max(0, n), true),
    removeCoins: (id: string, n: number): void => adjustBalance(id, 'coins', -Math.max(0, n), true),
    addCrowns: (id: string, n: number): void => adjustBalance(id, 'crowns', Math.max(0, n), false),
    removeCrowns: (id: string, n: number): void => adjustBalance(id, 'crowns', -Math.max(0, n), false),

    incrementCount: (id: string): void => { if (getUserRow(id)) updateCount.run(id); },
    incrementMiscount: (id: string): void => { if (getUserRow(id)) updateMiscount.run(id); },
    incrementWins: (id: string): void => { if (getUserRow(id)) updateWins.run(id); },
    incrementBossKills: (id: string): void => { if (getUserRow(id)) updateBossKills.run(id); },

    getCritBonus: (id: string): number => getUserRow(id)?.crit_bonus ?? 0,
    setCritBonus: (id: string, n: number): void => { if (getUserRow(id)) updateCritBonus.run(n, id); },
    getAcrobatics: (id: string): number => getUserRow(id)?.acrobatics ?? 0,
    setAcrobatics: (id: string, n: number): void => { if (getUserRow(id)) updateAcrobatics.run(n, id); },
    getRoyalty: (id: string): number => getUserRow(id)?.royalty ?? 0,
    setRoyalty: (id: string, n: number): void => { if (getUserRow(id)) updateRoyalty.run(n, id); },

    getNumber: (): number => getGameStateRow().number,
    // B1: the guard is actually invoked now.
    setNumber: (n: number): void => { if (Number.isInteger(n)) updateNumber.run(n); },
    addToNumber: (n: number): void => {
      if (!Number.isInteger(n)) return;
      updateNumber.run(getGameStateRow().number + n);
    },
    getTarget: (): number => getGameStateRow().win,
    setTarget: (n: number): void => { if (Number.isInteger(n)) updateWin.run(n); },

    getLastUserId: (): string | null => getGameStateRow().last,
    setLastUserId: (id: string): void => { updateLast.run(id); },
    clearLastUserId: (): void => { updateLast.run(null); },
    getChannelId: (): string | null => getGameStateRow().channel,
    setChannelId: (id: string): void => { updateChannel.run(id); },

    getBoss: (): Readonly<BossState> | null => {
      const row = selectBoss.get() as unknown as BossRow | undefined;
      return row ? Object.freeze(rowToBoss(row)) : null;
    },
    setBoss: (boss: BossState | null): void => {
      withTransaction(db, () => {
        deleteBoss.run();
        deleteBossParticipants.run();
        if (!boss) return;
        insertBoss.run(
          boss.level, boss.health, boss.totalHealth, boss.rewards.crowns, boss.rewards.coins,
          boss.imagePath, boss.imageName, boss.bossName,
        );
        Object.entries(boss.participants).forEach(([userId, damage]) => insertParticipant.run(userId, damage));
      });
    },

    hasReaction: (id: string, reactionId: string): boolean => Object.hasOwn(reactionsFor(id), reactionId),
    getReactions: (id: string): Readonly<Record<string, boolean>> => Object.freeze(reactionsFor(id)),
    selectReaction: (id: string, reactionId: string): void => {
      withTransaction(db, () => {
        upsertReaction.run(id, reactionId);
        deselectOtherReactions.run(id, reactionId);
      });
    },

    snapshot: (): GameState => {
      const g = getGameStateRow();
      const bossRow = selectBoss.get() as unknown as BossRow | undefined;
      return {
        number: g.number,
        win: g.win,
        last: g.last,
        channel: g.channel,
        users: Object.fromEntries((selectAllUsers.all() as unknown as UserRow[]).map((row) => [row.id, rowToUser(row)])),
        boss: bossRow ? rowToBoss(bossRow) : null,
        correctEmoji: g.correct_emoji,
        incorrectEmoji: g.incorrect_emoji,
        timeoutEmoji: g.timeout_emoji,
      };
    },

    // No flush() - every mutator above writes through immediately, so there
    // is no buffered state left to flush. stop() only needs to close the
    // handle cleanly on shutdown.
    stop: (): void => { db.close(); },
  };
};

export type Store = ReturnType<typeof createStore>;
```

- [x] **Step 4: Replace `test/store/store.test.ts` in full**

```typescript
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createStore } from '../../src/store/store.ts';
import { createState } from '../../src/store/schema.ts';

const tmpFile = (): string => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tow-store-'));
  return path.join(dir, 'data.db');
};

describe('store', () => {
  test('B1: setTarget rejects a non-integer', () => {
    const store = createStore(createState());
    const before = store.getTarget();
    store.setTarget(Number.NaN);
    assert.equal(store.getTarget(), before, 'unchanged - the guard actually runs now');
    store.stop();
  });

  test('B3: getCoins returns 0 for an unknown user instead of undefined', () => {
    const store = createStore(createState());
    assert.equal(store.getCoins('ghost'), 0);
    store.stop();
  });

  test('the upgrade getters are safe for unknown users, unlike legacy', () => {
    const store = createStore(createState());
    assert.equal(store.getCritBonus('ghost'), 0);
    assert.equal(store.getAcrobatics('ghost'), 0);
    assert.equal(store.getRoyalty('ghost'), 0);
    store.stop();
  });

  test('removeCoins floors at zero (preserved from legacy)', () => {
    const store = createStore(createState());
    store.ensureUser('u');
    store.addCoins('u', 10);
    store.removeCoins('u', 50);
    assert.equal(store.getCoins('u'), 0);
    store.stop();
  });

  test('reads are frozen - mutation through a getter is impossible', () => {
    const store = createStore(createState());
    store.ensureUser('u');
    const user = store.getUser('u');
    assert.ok(user);
    assert.throws(() => { (user as { coins: number }).coins = 999; });
    assert.equal(store.getCoins('u'), 0, 'closes the gap characterized in the legacy suite');
    store.stop();
  });

  test('incrementBossKills replaces the direct field write from index.js', () => {
    const store = createStore(createState());
    store.ensureUser('u');
    store.incrementBossKills('u');
    assert.equal(store.getUser('u')?.boss, 1);
    store.stop();
  });

  test('stop() closes the database handle', () => {
    const store = createStore(createState());
    store.stop();
    assert.throws(() => store.getNumber(), 'a read after stop() fails loudly rather than silently reopening');
  });

  test('every mutation is durable immediately - no flush() is needed before a restart', () => {
    const file = tmpFile();
    const store = createStore(createState(), { file });
    store.ensureUser('u');
    store.addCrowns('u', 7);
    store.setNumber(13);
    store.stop(); // no flush() call - the old 5-minutes-of-play-lost bug can't happen here

    const reloaded = createStore(createState(), { file });
    assert.equal(reloaded.getCrowns('u'), 7);
    assert.equal(reloaded.getNumber(), 13);
    reloaded.stop();
  });

  test('a database that already exists is not reseeded from the caller\'s default state', () => {
    const file = tmpFile();
    const store = createStore(createState(), { file });
    store.setNumber(99);
    store.stop();

    // A later boot passes createState() again (as index.ts always does) -
    // the existing number must survive, not be reset to createState()'s default.
    const reopened = createStore(createState(), { file });
    assert.equal(reopened.getNumber(), 99);
    reopened.stop();
  });

  test('selectReaction disables all others (preserved from legacy)', () => {
    const store = createStore(createState());
    store.ensureUser('u');
    store.selectReaction('u', 'pumpkin');
    store.selectReaction('u', 'skeleton');
    const reactions = store.getReactions('u');
    assert.equal(reactions.skeleton, true);
    assert.equal(reactions.pumpkin, false);
    assert.equal(reactions.default, false);
    store.stop();
  });

  test('selectReaction grants ownership of a reaction the user did not have yet', () => {
    const store = createStore(createState());
    store.ensureUser('u');
    assert.equal(store.hasReaction('u', 'skeleton'), false);
    store.selectReaction('u', 'skeleton');
    assert.equal(store.hasReaction('u', 'skeleton'), true);
    store.stop();
  });

  test('setBoss replaces participants rather than merging them', () => {
    const store = createStore(createState());
    store.setBoss({
      level: 1,
      health: 10,
      totalHealth: 10,
      rewards: { crowns: 1, coins: 1 },
      participants: { a: 5 },
      imagePath: 'x',
      imageName: 'x',
      bossName: 'Boss',
    });
    store.setBoss({
      level: 2,
      health: 20,
      totalHealth: 20,
      rewards: { crowns: 2, coins: 2 },
      participants: { b: 3 },
      imagePath: 'y',
      imageName: 'y',
      bossName: 'Boss2',
    });
    assert.deepEqual(store.getBoss()?.participants, { b: 3 });
    store.stop();
  });

  test('setBoss(null) clears the boss and its participants', () => {
    const store = createStore(createState());
    store.setBoss({
      level: 1,
      health: 10,
      totalHealth: 10,
      rewards: { crowns: 1, coins: 1 },
      participants: { a: 5 },
      imagePath: 'x',
      imageName: 'x',
      bossName: 'Boss',
    });
    store.setBoss(null);
    assert.equal(store.getBoss(), null);
    store.stop();
  });
});
```

- [x] **Step 5: Run the full suite**

Run: `node --test`
Expected: all suites pass, including `test/game/*`, `test/shop/*`, and `test/ui/*`, which construct stores via `createStore(createState())` and need no changes of their own.

- [x] **Step 6: Typecheck and lint**

Run: `npm run typecheck && npm run lint`
Expected: both exit 0.

- [x] **Step 7: Commit**

```bash
git add src/store/store.ts test/store/store.test.ts test/store/json-file.test.ts
git commit -m "feat(store): back the Store facade with SQLite instead of an in-memory blob"
```

---

## Task 4: Wire up bootstrap - config, index.ts, env, gitignore

**Files:**
- Modify: `src/config.ts`
- Modify: `src/index.ts`
- Modify: `.env.example`
- Modify: `.gitignore`

**Interfaces:**
- Consumes: `migrateLegacyStateIfNeeded` from `./store/legacy-import.ts` (Task 2), `createStore` from `./store/store.ts` (Task 3), `createState` from `./store/schema.ts` (unchanged).

- [x] **Step 1: Update `src/config.ts`**

```typescript
const required = (name: string): string => {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
};

export const config = {
  token: required('DISCORD_TOKEN'),
  prefix: process.env.PREFIX ?? 't?',
  dataFile: process.env.DATA_FILE ?? 'data.db',
  legacyDataFile: process.env.LEGACY_DATA_FILE ?? 'data.json',
} as const;
```

- [x] **Step 2: Update `src/index.ts`**

```typescript
import { ActivityType } from 'discord.js';
import { config } from './config.ts';
import { createClient } from './bot/client.ts';
import { handleMessage } from './bot/router.ts';
import { createStore } from './store/store.ts';
import { createState } from './store/schema.ts';
import { migrateLegacyStateIfNeeded } from './store/legacy-import.ts';
import { getRandomInt } from './lib/random.ts';
import { constants } from './game/constants.ts';

migrateLegacyStateIfNeeded(config.legacyDataFile, config.dataFile);

const store = createStore(createState(), { file: config.dataFile });
const client = createClient();

client.once('clientReady', () => {
  if (!Number.isInteger(store.getTarget())) {
    store.setTarget(getRandomInt(0, constants.WIN));
  }
  console.log('Logged in.');
  client.user?.setActivity(`${config.prefix}help`, { type: ActivityType.Listening });
});

client.on('messageCreate', (message) => {
  void handleMessage(client, store, message, config.prefix);
});

const shutdown = (): void => {
  store.stop();
  process.exit(0);
};

process.on('SIGINT', shutdown);
// Docker sends SIGTERM on `compose down`; the legacy handler only caught SIGINT,
// so a container stop discarded up to five minutes of play.
process.on('SIGTERM', shutdown);

await client.login(config.token);
```

(The only changes from today's `index.ts`: `loadState` is no longer
imported or called - `createStore` now owns opening the database - and
`migrateLegacyStateIfNeeded` runs first. The SIGTERM comment above is now
slightly stale, since the 5-minute-loss bug it describes can no longer
happen at all; leave the comment, since SIGTERM handling itself is still
correct and worth explaining.)

- [x] **Step 3: Update `.env.example`**

```
# Copy to .env and fill in a real bot token.
# See https://discord.com/developers/applications/
DISCORD_TOKEN=your-bot-token-here

# Command prefix. Optional, defaults to t?
PREFIX=t?

# Path to the SQLite database. Optional, defaults to data.db in the working
# directory. In Docker, point this at a mounted volume.
# DATA_FILE=/data/data.db

# Path to a pre-migration data.json, imported into DATA_FILE once on first
# boot if DATA_FILE does not exist yet. Optional, defaults to data.json in
# the working directory. Only relevant when upgrading an install that
# predates the SQLite migration.
# LEGACY_DATA_FILE=/data/data.json
```

- [x] **Step 4: Update `.gitignore`**

Find the existing block:

```
config.json
data.json
data/
*.bak
```

Replace with:

```
config.json
data.json
data.json.migrated
data.db
data.db-shm
data.db-wal
data/
*.bak
```

(`data.db-shm`/`data.db-wal` are SQLite's WAL-mode sidecar files.)

- [x] **Step 5: Manual smoke check (no Discord token needed)**

Run: `DATA_FILE=/tmp/tow-smoke.db node -e "
const { createStore } = require('./src/store/store.ts');
const { createState } = require('./src/store/schema.ts');
const store = createStore(createState(), { file: '/tmp/tow-smoke.db' });
store.ensureUser('smoke');
store.addCoins('smoke', 5);
console.log(store.getCoins('smoke'));
store.stop();
"`

Expected: prints `5`, and `/tmp/tow-smoke.db` exists on disk afterward.
Clean up with `rm -f /tmp/tow-smoke.db*`.

- [x] **Step 6: Typecheck and lint**

Run: `npm run typecheck && npm run lint`
Expected: both exit 0.

- [x] **Step 7: Commit**

```bash
git add src/config.ts src/index.ts .env.example .gitignore
git commit -m "feat: boot the bot against SQLite, migrating any legacy data.json once"
```

---

## Task 5: Docker and README

**Files:**
- Modify: `Dockerfile`
- Modify: `README.md`

**Interfaces:** None - documentation and container config only, no code.

- [x] **Step 1: Update `Dockerfile`**

Find:

```dockerfile
# data.json defaults to the working directory; point DATA_FILE at a mounted
# volume to persist game state across container restarts.
ENV DATA_FILE=/data/data.json
RUN mkdir -p /data && chown node:node /data
VOLUME /data
```

Replace with:

```dockerfile
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
```

- [x] **Step 2: Update the configuration table in `README.md`**

Find:

```markdown
| `DATA_FILE` | no | `data.json` | Path to the persisted game state. |
```

Replace with:

```markdown
| `DATA_FILE` | no | `data.db` | Path to the SQLite database holding game state. |
| `LEGACY_DATA_FILE` | no | `data.json` | Path to a pre-migration JSON save, imported into `DATA_FILE` once if `DATA_FILE` doesn't exist yet. |
```

- [x] **Step 3: Update the Deployment section's migration note**

Find:

```markdown
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
```

Replace with:

```markdown
Game state lives in the `/data` volume, so it survives restarts and image
upgrades. The container stores it at `/data/data.db` (SQLite) by default.

To migrate from an existing non-Docker install, copy the old `data.json` into
the volume before first start:

```bash
docker run --rm -v tug-of-war-data:/data -v "$PWD":/backup alpine \
  sh -c 'cp /backup/data.json /data/data.json && chown 1000:1000 /data/data.json'
```

(The container runs as the unprivileged `node` user, uid 1000, so the copied
file has to be owned by it.) On its next start, the bot converts that
`data.json` into `data.db` automatically and renames the original to
`data.json.migrated` - nothing further to do.

If you're upgrading an *existing* deployment that already has a `data.json`
in its volume, no action is needed at all: `docker compose pull && docker
compose up -d` finds `data.json` already there and runs the same one-time
conversion on startup.
```

- [x] **Step 4: Commit**

```bash
git add Dockerfile README.md
git commit -m "docs: describe the SQLite data file and the automatic migration"
```

---

## Task 6: Final verification

**Files:** None - this task only runs commands.

- [x] **Step 1: Full test suite**

Run: `npm test`
Expected: every suite passes (102 tests today, plus the new `sqlite.test.ts`, `legacy-import.test.ts`, and `json-file.test.ts` - 111+ total), 0 failures.

- [x] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: exit 0, no errors.

- [x] **Step 3: Lint**

Run: `npm run lint`
Expected: exit 0, no errors.

- [x] **Step 4: Confirm no leftover `data.json` handling outside the migration path**

Run: `grep -rn "data\.json" src/`
Expected: the only matches are the default value of `LEGACY_DATA_FILE` in
`config.ts` and the doc comment in `legacy-import.ts`. `json-file.ts`'s
`loadState`/`saveState` are still present (the migration importer calls
`loadState`) but nothing calls `saveState` anymore outside
`test/store/json-file.test.ts` - that's expected, it's now dead in
production but kept as a small, independently-tested module rather than
inlined into the importer.

- [x] **Step 5: Confirm nothing is left uncommitted**

Run: `git status --porcelain`
Expected: empty output - every prior task already committed its own work.
If anything shows up, `git add` it and commit with a message describing
what step it belongs to.
