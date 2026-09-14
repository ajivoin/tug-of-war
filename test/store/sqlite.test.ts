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
