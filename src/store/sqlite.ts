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
