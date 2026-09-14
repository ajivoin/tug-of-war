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
