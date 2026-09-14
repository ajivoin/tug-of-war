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
